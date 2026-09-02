import { createHash, randomBytes } from 'node:crypto';

import { secretsMatch } from '@/lib/crypto';

/**
 * The parts of an authorization-code flow that are the same whoever the
 * provider is: PKCE, the anti-CSRF `state`, and the redirect URI.
 *
 * Two flows use this — connecting a Gmail mailbox and signing in through
 * Auth0 — and neither should be reimplementing RFC 7636 on its own.
 *
 * The pending flow is kept in a short-lived, http-only cookie rather than in
 * the database. It is worth exactly one callback, it belongs to one browser,
 * and storing it in Postgres would mean a table of rows nothing ever cleans up.
 */

/** Long enough for one consent screen and a slow reader, short enough to bound replay. */
export const OAUTH_FLOW_TTL_SECONDS = 600;

/** 256 bits, URL-safe. */
export const newState = (): string => randomBytes(32).toString('base64url');

/**
 * A PKCE code verifier: RFC 7636 allows 43–128 unreserved characters, and 32
 * random bytes in base64url lands at 43.
 */
export const newCodeVerifier = (): string => randomBytes(32).toString('base64url');

export const codeChallengeFor = (verifier: string): string =>
  createHash('sha256').update(verifier).digest('base64url');

/**
 * An OIDC `nonce`. Bound into the ID token by the issuer, so the callback can
 * tell "the token for the sign-in this browser started" from one replayed into
 * it. PKCE does not cover this: it protects the code, not the token.
 */
export const newNonce = (): string => randomBytes(16).toString('base64url');

/** What the callback needs to remember from the moment the flow started. */
export type PendingOAuthFlow = {
  state: string;
  code_verifier: string;
  /** Exact value sent as `redirect_uri`; the token exchange must repeat it. */
  redirect_uri: string;
  /** Where to send the browser once the flow finishes. Same-origin path only. */
  return_to: string;
  /** Which workspace the result belongs to, for flows that connect a mailbox. */
  workspace_id?: string;
  /**
   * `app_user.id` of whoever started the flow. Captured here because the
   * callback arrives from the provider carrying nothing of ours but this cookie.
   */
  user_id?: string | null;
  /** OIDC replay defence; set by sign-in flows, absent from the mailbox one. */
  nonce?: string;
};

export const encodePendingFlow = (flow: PendingOAuthFlow): string =>
  Buffer.from(JSON.stringify(flow), 'utf8').toString('base64url');

export function decodePendingFlow(value: string | undefined): PendingOAuthFlow | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as PendingOAuthFlow;
    if (typeof parsed.state !== 'string' || typeof parsed.code_verifier !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Check the `state` the provider echoed back against the one this browser
 * started with. This is the entire CSRF defence for the callback: without it,
 * an attacker could have a signed-in user's browser complete *their* flow and
 * attach *their* mailbox to the user's workspace.
 */
export const stateMatches = (flow: PendingOAuthFlow, returned: string | null): boolean =>
  typeof returned === 'string' && secretsMatch(flow.state, returned);

/**
 * Resolve the URL a provider redirects back to.
 *
 * `PUBLIC_BASE_URL` wins, because behind a proxy the request's own host header
 * is whatever the proxy chose to forward and the value has to match what is
 * registered with the provider exactly. Falling back to the request's origin is
 * what makes `localhost:3000` work with no configuration.
 */
export function callbackUrl(request: Request, path: string): string {
  const configured = process.env.PUBLIC_BASE_URL?.trim().replace(/\/$/, '');
  const origin = configured || new URL(request.url).origin;
  return `${origin}${path}`;
}

/**
 * Keep a post-flow redirect on this site.
 *
 * `return_to` comes off a query string, so without this an open redirect falls
 * straight out of the callback. Only a root-relative path is allowed —
 * `//evil.example` is a protocol-relative URL, not a path, which is why the
 * second character is checked too.
 */
export function safeReturnPath(value: string | null | undefined, fallback: string): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return fallback;
  return value;
}

/** Cookie options for the one-callback-long flow cookie. */
export const flowCookieOptions = (secure: boolean) =>
  ({
    httpOnly: true,
    sameSite: 'lax' as const,
    secure,
    path: '/',
    maxAge: OAUTH_FLOW_TTL_SECONDS,
  });

/**
 * Whether cookies should be marked `Secure`.
 *
 * Driven by the scheme actually in use rather than `NODE_ENV`: a production
 * build served over plain HTTP on a laptop would otherwise set a cookie the
 * browser refuses to send back, and the flow would fail with no visible cause.
 */
export function cookiesAreSecure(request: Request): boolean {
  const configured = process.env.PUBLIC_BASE_URL?.trim();
  const url = configured || request.url;
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}
