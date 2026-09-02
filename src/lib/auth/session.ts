import { createHmac, timingSafeEqual } from 'node:crypto';

import { readCookie } from '@/lib/cookies';

/**
 * The signed cookie that carries "who is signed in" between requests.
 *
 * Stateless on purpose. A session table would have to be read on every request
 * and swept on a schedule; an HMAC-signed cookie costs one hash, survives a
 * restart, and needs no cleanup. What it gives up is instant revocation —
 * signing out clears the cookie on that browser rather than killing a session
 * everywhere — so the lifetime is kept short and rotating `AUTH_SESSION_SECRET`
 * invalidates every session at once when that is what is wanted.
 *
 * The payload is signed, not encrypted: nothing in it is secret (a user id, a
 * display name, an address the user typed themselves), and the signature is
 * what stops it being edited. Anything genuinely secret belongs in the
 * database — see `src/lib/email/accounts.ts`.
 */

export const SESSION_COOKIE = 'open_rm_session';

/** A working day plus the evening. Long enough not to nag, short enough to bound a stolen cookie. */
export const SESSION_TTL_SECONDS = 12 * 60 * 60;

export type SessionPayload = {
  /** `app_user.id` — the uuid stamped on records this user owns. */
  user_id: string;
  /** Which provider vouched for them, so a provider swap invalidates old cookies. */
  provider: string;
  /** The provider's subject, kept for support questions and re-linking. */
  subject: string;
  name: string;
  email: string | null;
  picture_url: string | null;
  /** Seconds since the epoch, matching the cookie's own `Max-Age`. */
  exp: number;
};

export class MissingSessionSecretError extends Error {
  constructor() {
    super(
      'AUTH_SESSION_SECRET is not set. Generate one with `openssl rand -base64 32` — ' +
        'sessions cannot be signed without it.',
    );
    this.name = 'MissingSessionSecretError';
  }
}

function sessionSecret(): string {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new MissingSessionSecretError();
  }
  return secret;
}

export function hasSessionSecret(): boolean {
  try {
    sessionSecret();
    return true;
  } catch {
    return false;
  }
}

const sign = (body: string): string =>
  createHmac('sha256', sessionSecret()).update(body).digest('base64url');

/** Encode and sign a session. The result is the cookie value. */
export function encodeSession(
  payload: Omit<SessionPayload, 'exp'>,
  ttlSeconds = SESSION_TTL_SECONDS,
): string {
  const full: SessionPayload = { ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds };
  const body = Buffer.from(JSON.stringify(full), 'utf8').toString('base64url');
  return `${body}.${sign(body)}`;
}

/**
 * Verify a cookie and return its session, or null.
 *
 * Every rejection returns null rather than throwing: a tampered, stale, or
 * simply absent cookie all mean the same thing to a caller — nobody is signed
 * in — and a route that has to distinguish them is a route with a bug.
 */
export function decodeSession(value: string | null | undefined): SessionPayload | null {
  if (!value) return null;

  const separator = value.lastIndexOf('.');
  if (separator <= 0) return null;

  const body = value.slice(0, separator);
  const signature = value.slice(separator + 1);

  let expected: string;
  try {
    expected = sign(body);
  } catch {
    // No secret configured: nothing can be trusted, so nobody is signed in.
    return null;
  }

  const left = Buffer.from(signature, 'base64url');
  const right = Buffer.from(expected, 'base64url');
  if (left.length !== right.length || left.length === 0 || !timingSafeEqual(left, right)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionPayload;
    if (typeof payload.user_id !== 'string' || typeof payload.exp !== 'number') return null;
    if (payload.exp * 1000 <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/** `Set-Cookie` attributes for the session. */
export const sessionCookieOptions = (secure: boolean) => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure,
  path: '/',
  maxAge: SESSION_TTL_SECONDS,
});

/** Read the session straight off a request, for route handlers and the proxy. */
export const sessionFromRequest = (request: Request): SessionPayload | null =>
  decodeSession(readCookie(request, SESSION_COOKIE));
