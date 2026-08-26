import type { JobPayloads } from '@/lib/queue';

export type DeliveryResult = { delivered: boolean; transport: string; email: string };

/**
 * Deliver a chat verification code.
 *
 * This repository ships no mail provider, so the code is logged and the job
 * reports the transport it used. Wiring up a real deployment means replacing
 * the body of this one function — every caller goes through the queue, so
 * nothing else has to change.
 */
export async function deliverChatCode(
  payload: JobPayloads['chat-auth-code'],
): Promise<DeliveryResult> {
  console.log(
    `[worker] chat verification code for ${payload.email} on "${payload.channel_name}": ` +
      `${payload.code} (expires ${payload.expires_at})`,
  );
  return { delivered: true, transport: 'console', email: payload.email };
}
