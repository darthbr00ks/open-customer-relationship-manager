import { defaultAccountFor } from '@/lib/email/accounts';
import { AUTH_CODE_TTL_MINUTES } from '@/lib/chat/config';
import { sendEmail } from '@/lib/email/send';
import type { JobPayloads } from '@/lib/queue';

export type DeliveryResult = { delivered: boolean; transport: string; email: string };

/**
 * Deliver a chat verification code.
 *
 * This used to log the code and nothing else, because the repository had no way
 * to send mail. It now goes through the same `EmailProvider` the CRM composes
 * with, which is the point of the interface: one workspace's connected Gmail
 * mailbox serves both, and a deployment that swaps in SMTP gets this for free.
 *
 * With no mailbox connected it falls back to logging, so a checkout with no
 * Google project still has a working sign-in flow (the code also comes back in
 * the API response outside production — see `returnsAuthCodeInResponse`).
 */
export async function deliverChatCode(
  payload: JobPayloads['chat-auth-code'],
): Promise<DeliveryResult> {
  const logged = () => {
    console.log(
      `[worker] chat verification code for ${payload.email} on "${payload.channel_name}": ` +
        `${payload.code} (expires ${payload.expires_at})`,
    );
    return { delivered: true, transport: 'console', email: payload.email };
  };

  const account = await defaultAccountFor(payload.workspace_id);
  if (!account || account.status !== 'connected') {
    return logged();
  }

  const { message, error } = await sendEmail({
    workspace_id: payload.workspace_id,
    account,
    to: payload.email,
    subject: `Your ${payload.channel_name} verification code`,
    body_text:
      `Your verification code is ${payload.code}.\n\n` +
      `It expires in ${AUTH_CODE_TTL_MINUTES} minutes and can be used once.\n\n` +
      `If you didn't ask to start a conversation, you can ignore this message.`,
    // Not filed on a record timeline: a code is plumbing, and putting one on a
    // customer's Person page would be noise at best.
  });

  if (error) {
    // Logging the code is the fallback that keeps a visitor from being stuck
    // because the mailbox needs reconnecting.
    console.error(`[worker] emailing the verification code to ${payload.email} failed: ${error}`);
    return logged();
  }

  return { delivered: message.status === 'sent', transport: account.provider, email: payload.email };
}
