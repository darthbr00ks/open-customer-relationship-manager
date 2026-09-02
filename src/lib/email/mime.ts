import { randomBytes } from 'node:crypto';

import type { EmailAddress, OutboundEmail } from './types';

/**
 * Turning a message into RFC 5322 wire format.
 *
 * Gmail's send endpoint takes a raw message rather than a JSON body, and so
 * does every SMTP transport, so this belongs to the email module rather than to
 * one provider. Two rules do most of the work:
 *
 * - **Headers are ASCII.** A display name or a subject with anything else in it
 *   is encoded per RFC 2047 (`=?UTF-8?B?...?=`).
 * - **Bodies are base64.** That sidesteps line-length limits, trailing
 *   whitespace, and the `From ` -at-start-of-line quoting rule in one move, at
 *   the cost of a third more bytes.
 */

/** RFC 5322: a line, CRLF included, may not exceed 1000 octets. Base64 is wrapped well inside it. */
const BASE64_LINE_LENGTH = 76;
const CRLF = '\r\n';

/** Rejects the CR/LF that would otherwise let a value inject a header of its own. */
function assertNoHeaderInjection(value: string, field: string): void {
  if (/[\r\n]/.test(value)) {
    throw new Error(`${field} may not contain a line break`);
  }
}

const isAscii = (value: string): boolean => /^[\x20-\x7e]*$/.test(value);

/** RFC 2047 encoded-word, so a name like "José" survives a header. */
function encodeHeaderValue(value: string): string {
  if (isAscii(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
}

/**
 * A single address, in `Display Name <local@domain>` form.
 *
 * A display name that is already ASCII is quoted rather than encoded — that is
 * both the common case and the readable one in a raw message.
 */
export function formatAddress(address: EmailAddress): string {
  assertNoHeaderInjection(address.email, 'Email address');
  const name = address.name?.trim();
  if (!name) return address.email;

  assertNoHeaderInjection(name, 'Display name');
  const encoded = isAscii(name) ? `"${name.replace(/(["\\])/g, '\\$1')}"` : encodeHeaderValue(name);
  return `${encoded} <${address.email}>`;
}

export const formatAddressList = (addresses: readonly EmailAddress[]): string =>
  addresses.map(formatAddress).join(', ');

/**
 * A loose address check.
 *
 * Deliberately not RFC 5321 — the grammar allows things no mail server accepts,
 * and the provider is the real authority either way. This exists to catch a
 * typo before a message is written down, and to keep a stray comma or angle
 * bracket out of a header.
 */
export function isValidEmailAddress(email: string): boolean {
  if (email.length > 320 || /[\s,<>()[\]\\";:]/.test(email)) return false;
  const parts = email.split('@');
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (!local || local.length > 64 || !domain || domain.length > 255) return false;
  // A domain has at least one dot and no empty label.
  return /^[^.]+(\.[^.]+)+$/.test(domain);
}

const base64Body = (value: string): string => {
  const encoded = Buffer.from(value, 'utf8').toString('base64');
  const lines: string[] = [];
  for (let i = 0; i < encoded.length; i += BASE64_LINE_LENGTH) {
    lines.push(encoded.slice(i, i + BASE64_LINE_LENGTH));
  }
  return lines.join(CRLF);
};

/** Unique enough that it cannot appear in the parts it separates. */
const newBoundary = (): string => `--=_openrm_${randomBytes(16).toString('hex')}`;

/**
 * A `Message-ID` for messages we originate.
 *
 * Providers that stamp their own take precedence; this is what makes threading
 * work for the ones that do not.
 */
export function newMessageId(fromAddress: string): string {
  const domain = fromAddress.split('@')[1] ?? 'localhost';
  return `<${randomBytes(16).toString('hex')}.${Date.now()}@${domain}>`;
}

export type BuiltMessage = {
  /** The full RFC 5322 message. */
  raw: string;
  /** The `Message-ID` header value that was used. */
  message_id: string;
};

/**
 * Render a message.
 *
 * With an HTML part the result is `multipart/alternative` with plain text
 * first, which is the ordering that tells a client the text part is the
 * fallback. Without one it is a plain `text/plain` message.
 */
export function buildMimeMessage(message: OutboundEmail, options: { date?: Date } = {}): BuiltMessage {
  if (message.to.length === 0) {
    throw new Error('A message needs at least one recipient');
  }
  assertNoHeaderInjection(message.subject, 'Subject');

  const messageId = newMessageId(message.from.email);
  const headers: string[] = [
    `From: ${formatAddress(message.from)}`,
    `To: ${formatAddressList(message.to)}`,
  ];

  if (message.cc?.length) headers.push(`Cc: ${formatAddressList(message.cc)}`);
  // Bcc is deliberately absent: the recipients go to the provider through the
  // envelope, and writing the header would show every blind copy to everyone.
  if (message.reply_to) headers.push(`Reply-To: ${formatAddress(message.reply_to)}`);

  headers.push(
    `Subject: ${encodeHeaderValue(message.subject)}`,
    `Message-ID: ${messageId}`,
    `Date: ${(options.date ?? new Date()).toUTCString()}`,
    'MIME-Version: 1.0',
  );

  if (message.in_reply_to) {
    assertNoHeaderInjection(message.in_reply_to, 'In-Reply-To');
    // `References` is what threads a conversation in most clients; `In-Reply-To`
    // alone only names the immediate parent.
    headers.push(`In-Reply-To: ${message.in_reply_to}`, `References: ${message.in_reply_to}`);
  }

  if (!message.html) {
    headers.push('Content-Type: text/plain; charset="UTF-8"', 'Content-Transfer-Encoding: base64');
    return { raw: `${headers.join(CRLF)}${CRLF}${CRLF}${base64Body(message.text)}`, message_id: messageId };
  }

  const boundary = newBoundary();
  headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);

  const body = [
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    base64Body(message.text),
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    base64Body(message.html),
    `--${boundary}--`,
    '',
  ].join(CRLF);

  return { raw: `${headers.join(CRLF)}${CRLF}${CRLF}${body}`, message_id: messageId };
}

/** Gmail's `messages.send` wants the raw message base64url-encoded. */
export const toBase64Url = (raw: string): string => Buffer.from(raw, 'utf8').toString('base64url');

/**
 * Turn a typed recipient list into addresses.
 *
 * Accepts comma or semicolon separated input, with or without display names,
 * because that is what comes off a clipboard.
 */
export function parseAddressList(value: string): EmailAddress[] {
  return value
    .split(/[,;]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const angled = part.match(/^(.*?)<([^>]+)>$/);
      if (angled) {
        const name = angled[1].trim().replace(/^"(.*)"$/, '$1');
        return { email: angled[2].trim(), name: name || null };
      }
      return { email: part, name: null };
    });
}

/** The addresses back as a string, which is how `email_message` stores them. */
export const joinAddresses = (addresses: readonly EmailAddress[]): string =>
  addresses.map((address) => address.email).join(', ');
