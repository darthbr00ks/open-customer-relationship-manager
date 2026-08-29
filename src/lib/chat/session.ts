import type { ChatChannel, ChatContact, ChatSession } from '@prisma/client';

import { prisma } from '@/lib/prisma';

import { ACTIVITY_STAMP_INTERVAL_MS, MAX_SESSION_TTL_HOURS, MIN_SESSION_TTL_HOURS } from './config';
import { publicFail } from './public';
import { hashToken, newSessionToken } from './tokens';

/**
 * Visitor sessions.
 *
 * A session is a bearer token the widget keeps in the browser. It is bound to
 * one channel and one contact, and it records whether the visitor proved their
 * email — which is what a channel with `auth_mode: 'required'` insists on.
 */

export type ChatSessionContext = {
  session: ChatSession;
  contact: ChatContact;
};

/** Whether an activity stamp is missing or old enough to be worth rewriting. */
const isStale = (stamp: Date | null, now: Date): boolean =>
  stamp == null || now.getTime() - stamp.getTime() >= ACTIVITY_STAMP_INTERVAL_MS;

function expiryFor(channel: ChatChannel): Date {
  const hours = Math.min(Math.max(channel.session_ttl_hours, MIN_SESSION_TTL_HOURS), MAX_SESSION_TTL_HOURS);
  return new Date(Date.now() + hours * 3_600_000);
}

/** Issue a token for a contact. The plaintext is returned once and never stored. */
export async function issueSession(
  channel: ChatChannel,
  contact: ChatContact,
  isAuthenticated: boolean,
): Promise<{ token: string; session: ChatSession }> {
  const token = newSessionToken();
  const session = await prisma.chatSession.create({
    data: {
      workspace_id: channel.workspace_id,
      channel_id: channel.id,
      contact_id: contact.id,
      token_hash: hashToken(token),
      is_authenticated: isAuthenticated,
      expires_at: expiryFor(channel),
    },
  });
  return { token, session };
}

/** The bearer token on a request, from the header or the `token` query parameter. */
export function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization');
  if (header) {
    const [scheme, value] = header.split(' ');
    if (scheme?.toLowerCase() === 'bearer' && value) return value.trim();
  }
  const fromQuery = new URL(request.url).searchParams.get('token');
  return fromQuery && fromQuery.length > 0 ? fromQuery : null;
}

/** Look up a live session for this channel, or null. Expired and revoked tokens do not resolve. */
export async function resolveSession(
  request: Request,
  channel: ChatChannel,
): Promise<ChatSessionContext | null> {
  const token = bearerToken(request);
  if (!token) return null;

  const session = await prisma.chatSession.findFirst({
    where: {
      token_hash: hashToken(token),
      channel_id: channel.id,
      revoked_at: null,
      expires_at: { gt: new Date() },
    },
    include: { contact: true },
  });
  if (!session) return null;

  const { contact, ...rest } = session;

  // Refreshed only once the stamp has gone stale. Every poll from the widget
  // arrives here, and writing on each one would make an idle chat the most
  // write-heavy thing in the product.
  const now = new Date();
  if (isStale(rest.last_used_at, now)) {
    await prisma.chatSession.update({ where: { id: rest.id }, data: { last_used_at: now } });
    rest.last_used_at = now;
  }
  if (isStale(contact.last_seen_at, now)) {
    await prisma.chatContact.update({ where: { id: rest.contact_id }, data: { last_seen_at: now } });
    contact.last_seen_at = now;
  }

  return { session: rest, contact };
}

/**
 * Resolve the session a conversation endpoint needs, or the response to send
 * instead: 401 with no live token, and 401 again when the channel requires a
 * verified email and this session only ever proved a guest.
 */
export async function requireSession(
  request: Request,
  channel: ChatChannel,
): Promise<{ context: ChatSessionContext; response: null } | { context: null; response: Response }> {
  const context = await resolveSession(request, channel);
  if (!context) {
    return { context: null, response: publicFail(401, 'A chat session is required', { request, channel }) };
  }
  if (channel.auth_mode === 'required' && !context.session.is_authenticated) {
    return {
      context: null,
      response: publicFail(401, 'This channel requires a verified email address', { request, channel }),
    };
  }
  return { context, response: null };
}

/** Revoke every other live session for a contact, e.g. after re-verifying an address. */
export async function revokeOtherSessions(contactId: string, keepSessionId: string) {
  await prisma.chatSession.updateMany({
    where: { contact_id: contactId, revoked_at: null, id: { not: keepSessionId } },
    data: { revoked_at: new Date() },
  });
}
