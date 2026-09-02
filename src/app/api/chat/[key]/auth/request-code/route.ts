import { requestAuthCode } from '@/lib/chat/auth-codes';
import { publicError, publicFail, publicJson, publicPreflight, requireChannel } from '@/lib/chat/public';
import { requestCodeSchema } from '@/lib/schemas/chat-public';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ key: string }> };

/**
 * Send a verification code to an address.
 *
 * Available on any channel whose `auth_mode` is not `none` — on an `optional`
 * channel a visitor can choose to be recognized, on a `required` one they have
 * to be. The response is the same whether or not the address has ever chatted
 * here before, so this endpoint cannot be used to enumerate customers.
 */
export async function POST(request: Request, context: Context) {
  const { key } = await context.params;
  const { channel, response } = await requireChannel(request, key);
  if (!channel) return response;

  try {
    if (!channel.is_enabled) {
      return publicFail(403, channel.offline_message ?? 'This chat channel is not accepting messages.', {
        request,
        channel,
      });
    }
    if (channel.auth_mode === 'none') {
      return publicFail(400, 'This channel does not use email verification', { request, channel });
    }

    const { email } = requestCodeSchema.parse(await request.json().catch(() => ({})));
    const result = await requestAuthCode(channel, email);

    if (!result.ok) {
      return publicFail(429, 'Too many verification codes requested. Try again shortly.', {
        request,
        channel,
      });
    }

    return publicJson(
      {
        sent: true,
        expires_at: result.expires_at.toISOString(),
        // Present only outside production, or where no mailbox is connected.
        ...(result.code ? { debug_code: result.code } : {}),
      },
      { status: 202, request, channel },
    );
  } catch (error) {
    return publicError(error, { request, channel });
  }
}

export async function OPTIONS(request: Request, context: Context) {
  const { key } = await context.params;
  return publicPreflight(request, key);
}
