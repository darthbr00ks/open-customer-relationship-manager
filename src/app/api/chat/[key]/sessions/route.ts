import { findOrCreateContact } from '@/lib/chat/contacts';
import { publicError, publicFail, publicJson, publicPreflight, requireChannel } from '@/lib/chat/public';
import { issueSession, resolveSession } from '@/lib/chat/session';
import { startSessionSchema } from '@/lib/schemas/chat-public';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ key: string }> };

/**
 * Start a guest session.
 *
 * Only channels that do not require a verified email answer this: on a
 * `required` channel the way in is `auth/verify`, which is the whole point of
 * that setting. What a guest must hand over first is per-channel too
 * (`collect_name` / `collect_email`).
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
    if (channel.auth_mode === 'required') {
      return publicFail(401, 'This channel requires a verified email address', { request, channel });
    }

    const body = await request.json().catch(() => ({}));
    const input = startSessionSchema.parse(body);

    if (channel.collect_email && !input.email) {
      return publicFail(422, 'An email address is required to start a chat here', { request, channel });
    }
    if (channel.collect_name && !input.display_name) {
      return publicFail(422, 'A name is required to start a chat here', { request, channel });
    }

    const contact = await findOrCreateContact(channel, input);
    const { token, session } = await issueSession(channel, contact, false);

    return publicJson(
      {
        token,
        expires_at: session.expires_at.toISOString(),
        is_authenticated: false,
        contact: {
          id: contact.id,
          display_name: contact.display_name,
          email: contact.email,
          is_verified: Boolean(contact.verified_at),
        },
      },
      { status: 201, request, channel },
    );
  } catch (error) {
    return publicError(error, { request, channel });
  }
}

/** Who the caller's token says they are — used by the widget on reload. */
export async function GET(request: Request, context: Context) {
  const { key } = await context.params;
  const { channel, response } = await requireChannel(request, key);
  if (!channel) return response;

  try {
    const session = await resolveSession(request, channel);
    if (!session) {
      return publicFail(401, 'A chat session is required', { request, channel });
    }
    return publicJson(
      {
        expires_at: session.session.expires_at.toISOString(),
        is_authenticated: session.session.is_authenticated,
        contact: {
          id: session.contact.id,
          display_name: session.contact.display_name,
          email: session.contact.email,
          is_verified: Boolean(session.contact.verified_at),
        },
      },
      { request, channel },
    );
  } catch (error) {
    return publicError(error, { request, channel });
  }
}

export async function OPTIONS(request: Request, context: Context) {
  const { key } = await context.params;
  return publicPreflight(request, key);
}
