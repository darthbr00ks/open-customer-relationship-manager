import { verifyAuthCode } from '@/lib/chat/auth-codes';
import { findOrCreateContact, markContactVerified } from '@/lib/chat/contacts';
import { publicError, publicFail, publicJson, publicPreflight, requireChannel } from '@/lib/chat/public';
import { issueSession } from '@/lib/chat/session';
import { verifyCodeSchema } from '@/lib/schemas/chat-public';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ key: string }> };

const REJECTIONS = {
  no_code: 'Request a verification code first',
  expired: 'That code has expired. Request a new one.',
  mismatch: 'That code is not correct',
  too_many_attempts: 'Too many incorrect attempts. Request a new code.',
} as const;

/**
 * Exchange a verification code for an authenticated session.
 *
 * The resulting session is what a `required` channel checks on every read and
 * write, and what lets a returning customer see the history of the threads
 * they opened from another device.
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

    const input = verifyCodeSchema.parse(await request.json().catch(() => ({})));
    const result = await verifyAuthCode(channel, input.email, input.code);
    if (!result.ok) {
      const status = result.reason === 'too_many_attempts' ? 429 : 400;
      return publicFail(status, REJECTIONS[result.reason], { request, channel });
    }

    const created = await findOrCreateContact(channel, {
      email: result.email,
      display_name: input.display_name,
    });
    const contact = await markContactVerified(created.id);
    const { token, session } = await issueSession(channel, contact, true);

    return publicJson(
      {
        token,
        expires_at: session.expires_at.toISOString(),
        is_authenticated: true,
        contact: {
          id: contact.id,
          display_name: contact.display_name,
          email: contact.email,
          is_verified: true,
        },
      },
      { status: 201, request, channel },
    );
  } catch (error) {
    return publicError(error, { request, channel });
  }
}

export async function OPTIONS(request: Request, context: Context) {
  const { key } = await context.params;
  return publicPreflight(request, key);
}
