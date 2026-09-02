import { createPublicKey, verify as verifySignature } from 'node:crypto';

import { AuthProviderError } from './types';

/**
 * Verifying an OIDC ID token against the issuer's published keys.
 *
 * The token comes back on a back channel over TLS, so OIDC Core §3.1.3.7 does
 * allow skipping this. It is done anyway because the consequence of getting it
 * wrong is somebody signing in as somebody else, and because the check is
 * cheap: Node can build a public key straight from a JWK, so RS256 verification
 * needs no dependency at all.
 *
 * Only RSA + SHA-256 is accepted. `alg: none` and HMAC algorithms are the two
 * classic JWT forgeries — with `HS256`, an attacker who knows the public key can
 * sign a token with it — and neither is what Auth0 issues, so both are refused
 * rather than handled.
 */

const SUPPORTED_ALGORITHMS = new Set(['RS256']);

/** Tolerance for clock drift between this host and the issuer. */
const CLOCK_SKEW_SECONDS = 60;

/** JWKS responses are cached for this long; a rotated key is picked up on a miss. */
const JWKS_TTL_MS = 10 * 60_000;

type Jwk = {
  kid?: string;
  kty?: string;
  alg?: string;
  use?: string;
  n?: string;
  e?: string;
};

export type IdTokenClaims = {
  sub: string;
  iss: string;
  aud: string | string[];
  exp: number;
  iat: number;
  nonce?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  nickname?: string;
  picture?: string;
  [claim: string]: unknown;
};

const jwksCache = new Map<string, { keys: Jwk[]; fetched_at: number }>();

async function fetchJwks(jwksUri: string, force: boolean): Promise<Jwk[]> {
  const cached = jwksCache.get(jwksUri);
  if (!force && cached && Date.now() - cached.fetched_at < JWKS_TTL_MS) {
    return cached.keys;
  }

  const response = await fetch(jwksUri);
  if (!response.ok) {
    throw new AuthProviderError(`Could not read the signing keys from ${jwksUri}`, 502);
  }

  const payload = (await response.json()) as { keys?: Jwk[] };
  const keys = payload.keys ?? [];
  jwksCache.set(jwksUri, { keys, fetched_at: Date.now() });
  return keys;
}

/**
 * The signing key for one `kid`.
 *
 * A miss forces one re-fetch: issuers rotate keys, and a token signed with a
 * new one would otherwise fail for as long as the cache holds. The re-fetch is
 * bounded to a cache miss so a stream of bogus `kid`s cannot be turned into a
 * stream of outbound requests.
 */
async function signingKey(jwksUri: string, kid: string | undefined): Promise<Jwk> {
  for (const force of [false, true]) {
    const keys = await fetchJwks(jwksUri, force);
    const match = kid ? keys.find((key) => key.kid === kid) : keys[0];
    if (match) return match;
    if (!force && kid && keys.some((key) => key.kid === kid)) break;
  }
  throw new AuthProviderError('The ID token was signed with an unknown key', 401);
}

const decodeSegment = (segment: string): Record<string, unknown> =>
  JSON.parse(Buffer.from(segment, 'base64url').toString('utf8')) as Record<string, unknown>;

/**
 * Verify an ID token's signature and its claims.
 *
 * Every check here is load-bearing: the signature says the issuer wrote it,
 * `iss`/`aud` say it was written for this application rather than another
 * tenant, `exp` says it is still current, and `nonce` says it belongs to the
 * sign-in this browser actually started rather than one replayed into it.
 */
export async function verifyIdToken(
  token: string,
  expected: { issuer: string; audience: string; jwks_uri: string; nonce?: string | null },
): Promise<IdTokenClaims> {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new AuthProviderError('The ID token is malformed', 401);
  }
  const [headerSegment, payloadSegment, signatureSegment] = parts;

  let header: Record<string, unknown>;
  let claims: IdTokenClaims;
  try {
    header = decodeSegment(headerSegment);
    claims = decodeSegment(payloadSegment) as IdTokenClaims;
  } catch {
    throw new AuthProviderError('The ID token could not be decoded', 401);
  }

  if (typeof header.alg !== 'string' || !SUPPORTED_ALGORITHMS.has(header.alg)) {
    throw new AuthProviderError(`Unsupported ID token algorithm: ${String(header.alg)}`, 401);
  }

  const jwk = await signingKey(expected.jwks_uri, header.kid as string | undefined);
  if (jwk.kty !== 'RSA' || !jwk.n || !jwk.e) {
    throw new AuthProviderError('The issuer published a key this app cannot use', 401);
  }

  const key = createPublicKey({ key: { kty: 'RSA', n: jwk.n, e: jwk.e }, format: 'jwk' });
  const signed = Buffer.from(`${headerSegment}.${payloadSegment}`, 'utf8');
  const signature = Buffer.from(signatureSegment, 'base64url');

  if (!verifySignature('sha256', signed, key, signature)) {
    throw new AuthProviderError('The ID token signature does not verify', 401);
  }

  // Issuers write `iss` with a trailing slash; comparing without one avoids a
  // mismatch that looks like an attack and is a formatting difference.
  const trimSlash = (value: string) => value.replace(/\/$/, '');
  if (trimSlash(claims.iss ?? '') !== trimSlash(expected.issuer)) {
    throw new AuthProviderError('The ID token came from a different issuer', 401);
  }

  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audiences.includes(expected.audience)) {
    throw new AuthProviderError('The ID token was issued for a different application', 401);
  }

  const now = Math.floor(Date.now() / 1000);
  if (typeof claims.exp !== 'number' || claims.exp + CLOCK_SKEW_SECONDS < now) {
    throw new AuthProviderError('The ID token has expired', 401);
  }
  if (typeof claims.iat === 'number' && claims.iat - CLOCK_SKEW_SECONDS > now) {
    throw new AuthProviderError('The ID token is dated in the future', 401);
  }

  if (expected.nonce && claims.nonce !== expected.nonce) {
    throw new AuthProviderError('The ID token does not match this sign-in attempt', 401);
  }

  if (typeof claims.sub !== 'string' || claims.sub.length === 0) {
    throw new AuthProviderError('The ID token names no subject', 401);
  }

  return claims;
}

/** Test seam and a way to drop cached keys after a rotation. */
export const clearJwksCache = (): void => void jwksCache.clear();
