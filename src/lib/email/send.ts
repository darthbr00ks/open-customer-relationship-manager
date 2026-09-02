import type { EmailAccount, EmailMessage, NoteParentType } from '@prisma/client';

import { prisma } from '@/lib/prisma';

import { credentialsFor } from './accounts';
import { isValidEmailAddress, joinAddresses, parseAddressList } from './mime';
import { emailProvider } from './registry';
import { EmailProviderError, type EmailAddress, type OutboundEmail } from './types';

/**
 * Sending one message, start to finish.
 *
 * The order matters: the row is written *before* the provider is called, so a
 * send that fails halfway is a `failed` message somebody can see and retry
 * rather than an event that left no trace. Only after the provider accepts does
 * the message get filed on a record's timeline.
 *
 * The send is inline rather than queued. Handing a message to Gmail is one HTTPS
 * round trip, and someone who just clicked Send should learn immediately that
 * the address was wrong — unlike the import and reporting jobs on the worker,
 * which are slow because of how much data they touch.
 */

/** RFC 5322 caps a header line at 998 octets, and `email_message.subject` matches. */
export const MAX_SUBJECT_LENGTH = 998;
/** Bounds one message; the column is unbounded text but a request should not be. */
export const MAX_BODY_LENGTH = 100_000;
/** Enough for a real thread, few enough that a mistake is not a mailing list. */
export const MAX_RECIPIENTS = 50;

export type SendEmailInput = {
  workspace_id: string;
  /** The mailbox to send through. */
  account: EmailAccount;
  to: string;
  cc?: string | null;
  bcc?: string | null;
  subject: string;
  body_text: string;
  body_html?: string | null;
  reply_to?: string | null;
  /** The CRM record this message belongs to, filed the way notes are. */
  parent_type?: NoteParentType | null;
  parent_id?: string | null;
  /** Provider thread to reply into, and the message being replied to. */
  thread_id?: string | null;
  in_reply_to?: string | null;
  created_by_user_id?: string | null;
};

export class InvalidEmailError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidEmailError';
  }
}

/** Parse one recipient field and reject anything that is not plausibly an address. */
function recipients(value: string | null | undefined, field: string): EmailAddress[] {
  const parsed = parseAddressList(value ?? '');
  for (const address of parsed) {
    if (!isValidEmailAddress(address.email)) {
      throw new InvalidEmailError(`${field} contains an invalid address: ${address.email}`);
    }
  }
  if (parsed.length > MAX_RECIPIENTS) {
    throw new InvalidEmailError(`${field} has more than ${MAX_RECIPIENTS} recipients`);
  }
  return parsed;
}

export type SendEmailResult = {
  message: EmailMessage;
  /** Null when the provider accepted it; the reason when it did not. */
  error: string | null;
};

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const to = recipients(input.to, 'to');
  if (to.length === 0) {
    throw new InvalidEmailError('A message needs at least one recipient');
  }
  const cc = recipients(input.cc, 'cc');
  const bcc = recipients(input.bcc, 'bcc');

  const subject = input.subject.trim();
  if (!subject) throw new InvalidEmailError('A message needs a subject');
  if (subject.length > MAX_SUBJECT_LENGTH) {
    throw new InvalidEmailError(`The subject may not exceed ${MAX_SUBJECT_LENGTH} characters`);
  }

  const bodyText = input.body_text;
  if (!bodyText.trim()) throw new InvalidEmailError('A message needs a body');
  if (bodyText.length > MAX_BODY_LENGTH || (input.body_html?.length ?? 0) > MAX_BODY_LENGTH) {
    throw new InvalidEmailError(`A message body may not exceed ${MAX_BODY_LENGTH} characters`);
  }

  if (input.reply_to && !isValidEmailAddress(input.reply_to)) {
    throw new InvalidEmailError(`reply_to is not a valid address: ${input.reply_to}`);
  }

  if (input.account.workspace_id !== input.workspace_id) {
    throw new InvalidEmailError('That mailbox belongs to another workspace');
  }

  const message = await prisma.emailMessage.create({
    data: {
      workspace_id: input.workspace_id,
      account_id: input.account.id,
      parent_type: input.parent_type ?? null,
      parent_id: input.parent_id ?? null,
      to_addresses: joinAddresses(to),
      cc_addresses: cc.length ? joinAddresses(cc) : null,
      bcc_addresses: bcc.length ? joinAddresses(bcc) : null,
      subject,
      body_text: bodyText,
      body_html: input.body_html ?? null,
      created_by_user_id: input.created_by_user_id ?? null,
    },
  });

  const outbound: OutboundEmail = {
    from: { email: input.account.email, name: input.account.display_name },
    to,
    cc: cc.length ? cc : undefined,
    bcc: bcc.length ? bcc : undefined,
    reply_to: input.reply_to ? { email: input.reply_to } : null,
    subject,
    text: bodyText,
    html: input.body_html ?? null,
    thread_id: input.thread_id ?? null,
    in_reply_to: input.in_reply_to ?? null,
  };

  try {
    const credentials = await credentialsFor(input.account);
    const result = await emailProvider(input.account.provider).send(outbound, credentials);

    const sent = await prisma.emailMessage.update({
      where: { id: message.id },
      data: {
        status: 'sent',
        sent_at: new Date(),
        provider_message_id: result.provider_message_id,
        provider_thread_id: result.provider_thread_id,
        error: null,
      },
    });

    await fileOnTimeline(sent, input.account);
    return { message: sent, error: null };
  } catch (error) {
    const detail =
      error instanceof EmailProviderError || error instanceof Error
        ? error.message
        : 'Sending failed';

    const failed = await prisma.emailMessage.update({
      where: { id: message.id },
      data: { status: 'failed', error: detail },
    });
    return { message: failed, error: detail };
  }
}

/**
 * Note the message on the record it was about.
 *
 * A system note is what already carries "Hector moved this to Negotiation"
 * through the Activity tab, so a sent email lands in the same stream instead of
 * in a feed of its own that nobody thinks to open. Failing to write it must not
 * turn a sent message into a failed one — the mail has already left.
 */
async function fileOnTimeline(message: EmailMessage, account: EmailAccount): Promise<void> {
  if (!message.parent_type || !message.parent_id) return;

  try {
    await prisma.note.create({
      data: {
        workspace_id: message.workspace_id,
        parent_type: message.parent_type,
        parent_id: message.parent_id,
        kind: 'system',
        body: `Emailed ${message.to_addresses} from ${account.email} — “${message.subject}”`,
        created_by_user_id: message.created_by_user_id,
      },
    });
  } catch (error) {
    console.error('email: filing the sent message on the record timeline failed', error);
  }
}
