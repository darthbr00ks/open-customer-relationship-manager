import { createSign, generateKeyPairSync } from 'node:crypto';

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { GET as getSessionRoute } from '@/app/api/auth/session/route';
import { actorFor, requireActor } from '@/lib/auth/current-user';
import { clearJwksCache, verifyIdToken } from '@/lib/auth/jwt';
import { Auth0Provider } from '@/lib/auth/providers/auth0';
import { DevAuthProvider } from '@/lib/auth/providers/dev';
import { authEnabled, authProvider, configuredAuthProviderId } from '@/lib/auth/registry';
import {
  SESSION_COOKIE,
  decodeSession,
  encodeSession,
  sessionFromRequest,
} from '@/lib/auth/session';
import { upsertUserFromIdentity } from '@/lib/auth/users';
import {
  callbackUrl,
  codeChallengeFor,
  decodePendingFlow,
  encodePendingFlow,
  newCodeVerifier,
  safeReturnPath,
  stateMatches,
} from '@/lib/oauth';
import { BASE, jsonRequest, resetDatabase, uuid } from './helpers';

const SESSION_SECRET = 'a'.repeat(48);

beforeAll(() => {
  process.env.AUTH_SESSION_SECRET = SESSION_SECRET;
});

beforeEach(resetDatabase);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  clearJwksCache();
});

const cookieRequest = (url: string, cookie: string) => {
  const request = jsonRequest(url, 'GET');
  request.headers.set('cookie', cookie);
  return request;
};

const session = (overrides: Record<string, unknown> = {}) =>
  encodeSession({
    user_id: uuid(),
    provider: 'auth0',
    subject: 'auth0|abc',
    name: 'Ada Lovelace',
    email: 'ada@example.test',
    picture_url: null,
    ...overrides,
  });

/* -------------------------------------------------------------------------- */
/* Session cookie                                                              */
/* -------------------------------------------------------------------------- */

describe('session cookie', () => {
  it('round-trips a session', () => {
    const userId = uuid();
    const decoded = decodeSession(session({ user_id: userId }));

    expect(decoded?.user_id).toBe(userId);
    expect(decoded?.name).toBe('Ada Lovelace');
    expect(decoded?.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it('rejects an edited payload', () => {
    const cookie = session();
    const [body, signature] = cookie.split('.');

    const forged = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    forged.user_id = uuid();
    const tampered = `${Buffer.from(JSON.stringify(forged), 'utf8').toString('base64url')}.${signature}`;

    expect(decodeSession(tampered)).toBeNull();
  });

  it('rejects a cookie signed with another secret', () => {
    const cookie = session();
    vi.stubEnv('AUTH_SESSION_SECRET', 'b'.repeat(48));
    // Rotating the secret is how every session is invalidated at once.
    expect(decodeSession(cookie)).toBeNull();
  });

  it('rejects an expired session', () => {
    expect(
      decodeSession(
        encodeSession(
          {
            user_id: uuid(),
            provider: 'auth0',
            subject: 'auth0|abc',
            name: 'Ada',
            email: null,
            picture_url: null,
          },
          -10,
        ),
      ),
    ).toBeNull();
  });

  it('rejects nonsense rather than throwing', () => {
    for (const value of [null, '', 'no-dot', 'a.b.c', '....']) {
      expect(decodeSession(value)).toBeNull();
    }
  });

  it('refuses to sign with a short or missing secret', () => {
    vi.stubEnv('AUTH_SESSION_SECRET', 'too-short');
    expect(() => session()).toThrow(/AUTH_SESSION_SECRET/);
  });

  it('reads the cookie off a request', () => {
    const cookie = session();
    const request = cookieRequest(`${BASE}/`, `theme=dark; ${SESSION_COOKIE}=${cookie}; other=1`);

    expect(sessionFromRequest(request)?.name).toBe('Ada Lovelace');
    expect(sessionFromRequest(jsonRequest(`${BASE}/`, 'GET'))).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/* OAuth flow helpers                                                          */
/* -------------------------------------------------------------------------- */

describe('OAuth flow helpers', () => {
  it('derives the PKCE challenge as RFC 7636 specifies', () => {
    // The worked example from RFC 7636 Appendix B.
    expect(codeChallengeFor('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    );
  });

  it('produces a verifier inside the allowed length', () => {
    const verifier = newCodeVerifier();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(verifier.length).toBeLessThanOrEqual(128);
    expect(/^[A-Za-z0-9\-._~]+$/.test(verifier)).toBe(true);
  });

  it('round-trips a pending flow and rejects a broken one', () => {
    const flow = {
      state: 'state-value',
      code_verifier: 'verifier',
      redirect_uri: 'https://crm.test/cb',
      return_to: '/settings/email',
    };
    expect(decodePendingFlow(encodePendingFlow(flow))).toEqual(flow);
    expect(decodePendingFlow('not-base64url-json')).toBeNull();
    expect(decodePendingFlow(undefined)).toBeNull();
  });

  it('only accepts the state it issued', () => {
    const flow = { state: 'expected', code_verifier: 'v', redirect_uri: '', return_to: '/' };
    expect(stateMatches(flow, 'expected')).toBe(true);
    expect(stateMatches(flow, 'other')).toBe(false);
    expect(stateMatches(flow, null)).toBe(false);
    // A prefix must not pass: the comparison is over the whole value.
    expect(stateMatches(flow, 'expect')).toBe(false);
  });

  it('refuses an off-site return path', () => {
    expect(safeReturnPath('/deals/1', '/')).toBe('/deals/1');
    expect(safeReturnPath('//evil.example', '/')).toBe('/');
    expect(safeReturnPath('https://evil.example', '/')).toBe('/');
    expect(safeReturnPath('javascript:alert(1)', '/')).toBe('/');
    expect(safeReturnPath(null, '/fallback')).toBe('/fallback');
  });

  it('prefers PUBLIC_BASE_URL for the callback, since a proxy rewrites the host', () => {
    const request = jsonRequest('http://internal:3000/api/v1/email/connect', 'GET');
    expect(callbackUrl(request, '/cb')).toBe('http://internal:3000/cb');

    vi.stubEnv('PUBLIC_BASE_URL', 'https://crm.example.com/');
    expect(callbackUrl(request, '/cb')).toBe('https://crm.example.com/cb');
  });
});

/* -------------------------------------------------------------------------- */
/* ID token verification                                                       */
/* -------------------------------------------------------------------------- */

describe('verifyIdToken', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = publicKey.export({ format: 'jwk' }) as { n: string; e: string };

  const ISSUER = 'https://tenant.eu.auth0.com/';
  const AUDIENCE = 'client-id';
  const JWKS_URI = 'https://tenant.eu.auth0.com/.well-known/jwks.json';

  const stubJwks = (keys: unknown[] = [{ kty: 'RSA', kid: 'key-1', n: jwk.n, e: jwk.e }]) =>
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ keys }), { status: 200 })));

  const signToken = (
    claims: Record<string, unknown>,
    header: Record<string, unknown> = { alg: 'RS256', kid: 'key-1' },
  ) => {
    const encode = (value: unknown) =>
      Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
    const body = `${encode(header)}.${encode(claims)}`;
    const signature = createSign('RSA-SHA256').update(body).sign(privateKey).toString('base64url');
    return `${body}.${signature}`;
  };

  const validClaims = (overrides: Record<string, unknown> = {}) => ({
    sub: 'auth0|123',
    iss: ISSUER,
    aud: AUDIENCE,
    exp: Math.floor(Date.now() / 1000) + 600,
    iat: Math.floor(Date.now() / 1000),
    nonce: 'nonce-value',
    email: 'ada@example.test',
    name: 'Ada Lovelace',
    ...overrides,
  });

  const expected = { issuer: ISSUER, audience: AUDIENCE, jwks_uri: JWKS_URI, nonce: 'nonce-value' };

  it('accepts a properly signed token', async () => {
    stubJwks();
    const claims = await verifyIdToken(signToken(validClaims()), expected);
    expect(claims.sub).toBe('auth0|123');
    expect(claims.email).toBe('ada@example.test');
  });

  it('tolerates a trailing-slash difference in the issuer', async () => {
    stubJwks();
    await expect(
      verifyIdToken(signToken(validClaims()), { ...expected, issuer: 'https://tenant.eu.auth0.com' }),
    ).resolves.toBeTruthy();
  });

  it('rejects a token signed by a different key', async () => {
    const other = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const otherJwk = other.publicKey.export({ format: 'jwk' }) as { n: string; e: string };
    stubJwks([{ kty: 'RSA', kid: 'key-1', n: otherJwk.n, e: otherJwk.e }]);

    await expect(verifyIdToken(signToken(validClaims()), expected)).rejects.toThrow(/signature/);
  });

  it('rejects alg: none and HMAC', async () => {
    stubJwks();
    const encode = (value: unknown) =>
      Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');

    // `alg: none` with an empty signature is the oldest JWT forgery there is.
    const unsigned = `${encode({ alg: 'none' })}.${encode(validClaims())}.`;
    await expect(verifyIdToken(unsigned, expected)).rejects.toThrow(/Unsupported/);

    await expect(
      verifyIdToken(signToken(validClaims(), { alg: 'HS256', kid: 'key-1' }), expected),
    ).rejects.toThrow(/Unsupported/);
  });

  it('rejects the wrong issuer, audience, or nonce', async () => {
    stubJwks();

    await expect(
      verifyIdToken(signToken(validClaims({ iss: 'https://evil.example/' })), expected),
    ).rejects.toThrow(/issuer/);

    await expect(
      verifyIdToken(signToken(validClaims({ aud: 'another-client' })), expected),
    ).rejects.toThrow(/different application/);

    await expect(
      verifyIdToken(signToken(validClaims({ nonce: 'replayed' })), expected),
    ).rejects.toThrow(/sign-in attempt/);
  });

  it('accepts an audience array that contains this client', async () => {
    stubJwks();
    await expect(
      verifyIdToken(signToken(validClaims({ aud: ['other', AUDIENCE] })), expected),
    ).resolves.toBeTruthy();
  });

  it('rejects an expired token', async () => {
    stubJwks();
    await expect(
      verifyIdToken(signToken(validClaims({ exp: Math.floor(Date.now() / 1000) - 3600 })), expected),
    ).rejects.toThrow(/expired/);
  });

  it('rejects a token signed with a key the issuer does not publish', async () => {
    stubJwks([{ kty: 'RSA', kid: 'another-key', n: jwk.n, e: jwk.e }]);
    await expect(verifyIdToken(signToken(validClaims()), expected)).rejects.toThrow(/unknown key/);
  });
});

/* -------------------------------------------------------------------------- */
/* Providers and registry                                                      */
/* -------------------------------------------------------------------------- */

describe('Auth0Provider', () => {
  const provider = new Auth0Provider();

  beforeEach(() => {
    vi.stubEnv('AUTH0_DOMAIN', 'tenant.eu.auth0.com');
    vi.stubEnv('AUTH0_CLIENT_ID', 'client-id');
    vi.stubEnv('AUTH0_CLIENT_SECRET', 'client-secret');
  });

  it('builds an OIDC authorization URL with PKCE and a nonce', () => {
    const url = new URL(
      provider.authorizationUrl({
        redirect_uri: 'https://crm.test/api/auth/callback',
        state: 'state-value',
        code_challenge: 'challenge-value',
        nonce: 'nonce-value',
        login_hint: 'ada@example.test',
      }),
    );

    expect(url.origin + url.pathname).toBe('https://tenant.eu.auth0.com/authorize');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('scope')).toBe('openid profile email');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('nonce')).toBe('nonce-value');
    expect(url.searchParams.get('login_hint')).toBe('ada@example.test');
    expect(url.searchParams.has('audience')).toBe(false);
  });

  it('strips a scheme from AUTH0_DOMAIN so both spellings work', () => {
    vi.stubEnv('AUTH0_DOMAIN', 'https://tenant.eu.auth0.com/');
    expect(provider.issuer).toBe('https://tenant.eu.auth0.com/');
    expect(provider.jwksUri).toBe('https://tenant.eu.auth0.com/.well-known/jwks.json');
  });

  it('ends the provider session on logout, not just ours', () => {
    const url = new URL(provider.logoutUrl({ return_to: 'https://crm.test/' }));
    expect(url.origin + url.pathname).toBe('https://tenant.eu.auth0.com/v2/logout');
    expect(url.searchParams.get('returnTo')).toBe('https://crm.test/');
  });

  it('refuses to start a flow with no credentials', () => {
    vi.stubEnv('AUTH0_CLIENT_SECRET', '');
    expect(() =>
      provider.authorizationUrl({
        redirect_uri: 'https://crm.test/cb',
        state: 's',
        code_challenge: 'c',
        nonce: 'n',
      }),
    ).toThrow(/not configured/);
  });
});

describe('auth registry', () => {
  it('uses the stand-in when nothing is configured', () => {
    vi.stubEnv('AUTH_PROVIDER', '');
    vi.stubEnv('AUTH0_DOMAIN', '');
    vi.stubEnv('AUTH0_CLIENT_ID', '');
    vi.stubEnv('AUTH0_CLIENT_SECRET', '');

    expect(configuredAuthProviderId()).toBe('dev');
    expect(authEnabled()).toBe(false);
  });

  it('switches to Auth0 once it has credentials', () => {
    vi.stubEnv('AUTH_PROVIDER', '');
    vi.stubEnv('AUTH0_DOMAIN', 'tenant.eu.auth0.com');
    vi.stubEnv('AUTH0_CLIENT_ID', 'client-id');
    vi.stubEnv('AUTH0_CLIENT_SECRET', 'client-secret');

    expect(configuredAuthProviderId()).toBe('auth0');
    expect(authProvider().label).toBe('Auth0');
    expect(authEnabled()).toBe(true);
  });

  it('does not lock everyone out when a provider is named but unconfigured', () => {
    vi.stubEnv('AUTH_PROVIDER', 'auth0');
    vi.stubEnv('AUTH0_DOMAIN', '');
    vi.stubEnv('AUTH0_CLIENT_ID', '');
    vi.stubEnv('AUTH0_CLIENT_SECRET', '');

    expect(authEnabled()).toBe(false);
  });

  it('rejects a provider it does not know', () => {
    expect(() => authProvider('carrier-pigeon')).toThrow(/Unknown auth provider/);
  });

  it('never signs anyone in through the stand-in', async () => {
    const dev = new DevAuthProvider();
    expect(dev.requiresSignIn).toBe(false);
    expect(dev.logoutUrl()).toBeNull();
    expect(() => dev.authorizationUrl()).toThrow(/No identity provider/);
    await expect(dev.exchangeCode()).rejects.toThrow(/No identity provider/);
  });
});

/* -------------------------------------------------------------------------- */
/* Users                                                                       */
/* -------------------------------------------------------------------------- */

describe('upsertUserFromIdentity', () => {
  const identity = {
    subject: 'auth0|123',
    email: 'ada@example.test',
    name: 'Ada Lovelace',
    picture_url: null,
    expires_at: null,
  };

  it('keeps one uuid across sign-ins, so owned records stay owned', async () => {
    const first = await upsertUserFromIdentity('auth0', identity);
    const second = await upsertUserFromIdentity('auth0', { ...identity, name: 'Ada L.' });

    expect(second.id).toBe(first.id);
    // The provider is the source of truth for the profile.
    expect(second.name).toBe('Ada L.');
    expect(second.last_login_at?.getTime()).toBeGreaterThanOrEqual(first.last_login_at!.getTime());
  });

  it('treats the same subject from a different provider as a different user', async () => {
    const viaAuth0 = await upsertUserFromIdentity('auth0', identity);
    const viaOther = await upsertUserFromIdentity('okta', identity);
    expect(viaOther.id).not.toBe(viaAuth0.id);
  });

  it('falls back to the address when the provider offers no name', async () => {
    const user = await upsertUserFromIdentity('auth0', { ...identity, name: null });
    expect(user.name).toBe('ada@example.test');
  });
});

/* -------------------------------------------------------------------------- */
/* Who is calling                                                              */
/* -------------------------------------------------------------------------- */

describe('actorFor', () => {
  const signedOut = () => {
    vi.stubEnv('AUTH_PROVIDER', 'dev');
    vi.stubEnv('AUTH0_DOMAIN', '');
  };

  it('trusts the cookie over anything in the query string', () => {
    const userId = uuid();
    const request = cookieRequest(
      `${BASE}/api/v1/email/messages?acting_user_id=${uuid()}`,
      `${SESSION_COOKIE}=${session({ user_id: userId })}`,
    );

    expect(actorFor(request).user_id).toBe(userId);
  });

  it('accepts the caller-supplied id only when auth is off', () => {
    signedOut();
    const claimed = uuid();
    expect(actorFor(jsonRequest(`${BASE}/x?acting_user_id=${claimed}`, 'GET')).user_id).toBe(claimed);
    // Not a uuid: ignored rather than passed through to a uuid column.
    expect(actorFor(jsonRequest(`${BASE}/x?acting_user_id=nonsense`, 'GET')).user_id).toBeNull();
  });

  it('turns an unauthenticated call away with 401 when auth is on', () => {
    vi.stubEnv('AUTH_PROVIDER', 'auth0');
    vi.stubEnv('AUTH0_DOMAIN', 'tenant.eu.auth0.com');
    vi.stubEnv('AUTH0_CLIENT_ID', 'client-id');
    vi.stubEnv('AUTH0_CLIENT_SECRET', 'client-secret');

    const { actor, response } = requireActor(jsonRequest(`${BASE}/x`, 'GET'));
    expect(actor).toBeNull();
    expect(response?.status).toBe(401);
  });

  it('lets a call through when there is no identity provider', () => {
    signedOut();
    const { actor, response } = requireActor(jsonRequest(`${BASE}/x`, 'GET'));
    expect(response).toBeNull();
    expect(actor).not.toBeNull();
  });
});

describe('GET /api/auth/session', () => {
  it('reports nobody signed in, and whether that matters', async () => {
    vi.stubEnv('AUTH_PROVIDER', 'dev');

    const body = await (await getSessionRoute(jsonRequest(`${BASE}/api/auth/session`, 'GET'))).json();
    expect(body.auth_enabled).toBe(false);
    expect(body.user).toBeNull();
  });

  it('reports the signed-in user without leaking the cookie', async () => {
    const userId = uuid();
    const request = cookieRequest(
      `${BASE}/api/auth/session`,
      `${SESSION_COOKIE}=${session({ user_id: userId })}`,
    );

    const body = await (await getSessionRoute(request)).json();
    expect(body.user).toEqual({
      id: userId,
      name: 'Ada Lovelace',
      email: 'ada@example.test',
      picture_url: null,
    });
    expect(JSON.stringify(body)).not.toContain('subject');
  });
});
