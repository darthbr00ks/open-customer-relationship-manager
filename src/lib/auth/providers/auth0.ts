import { verifyIdToken } from '../jwt';
import {
  AuthProviderError,
  type AuthIdentity,
  type AuthProvider,
  type AuthorizationUrlParams,
} from '../types';

/**
 * Auth0, over OIDC authorization code + PKCE.
 *
 * Written against the endpoints rather than `@auth0/nextjs-auth0` for the same
 * reason as Gmail: the flow is three requests, and an SDK would bring its own
 * session model, its own routes, and its own opinion about where the user lives
 * — all of which this app already has, and all of which would be Auth0-shaped
 * and so undo the point of `AuthProvider`.
 *
 * PKCE is used even though this is a confidential client with a secret. It
 * costs one hash and it closes code interception at the redirect, which a
 * client secret does nothing about.
 */

type TokenResponse = {
  access_token?: string;
  id_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

export class Auth0Provider implements AuthProvider {
  readonly id = 'auth0';
  readonly label = 'Auth0';
  readonly requiresSignIn = true;

  /** `AUTH0_DOMAIN` is written bare (`example.eu.auth0.com`); the issuer is the https form. */
  private get domain(): string {
    return (process.env.AUTH0_DOMAIN ?? '').trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
  }

  private get clientId(): string {
    return process.env.AUTH0_CLIENT_ID ?? '';
  }

  private get clientSecret(): string {
    return process.env.AUTH0_CLIENT_SECRET ?? '';
  }

  /** Trailing slash included: that is what Auth0 puts in the `iss` claim. */
  get issuer(): string {
    return `https://${this.domain}/`;
  }

  get jwksUri(): string {
    return `https://${this.domain}/.well-known/jwks.json`;
  }

  isConfigured(): boolean {
    return this.domain.length > 0 && this.clientId.length > 0 && this.clientSecret.length > 0;
  }

  private requireConfig(): void {
    if (!this.isConfigured()) {
      throw new AuthProviderError(
        'Auth0 is not configured: set AUTH0_DOMAIN, AUTH0_CLIENT_ID and AUTH0_CLIENT_SECRET.',
        500,
      );
    }
  }

  authorizationUrl(params: AuthorizationUrlParams): string {
    this.requireConfig();

    const url = new URL(`https://${this.domain}/authorize`);
    url.search = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: params.redirect_uri,
      response_type: 'code',
      // `openid` is what makes this OIDC rather than bare OAuth; the other two
      // are what fill in a name and an address for the user menu.
      scope: 'openid profile email',
      state: params.state,
      nonce: params.nonce,
      code_challenge: params.code_challenge,
      code_challenge_method: 'S256',
    }).toString();

    if (params.login_hint) url.searchParams.set('login_hint', params.login_hint);

    // An API audience is only needed when the app calls an Auth0-protected API
    // with the access token. Sign-in does not, so it stays optional.
    const audience = process.env.AUTH0_AUDIENCE?.trim();
    if (audience) url.searchParams.set('audience', audience);

    return url.toString();
  }

  async exchangeCode(params: {
    code: string;
    redirect_uri: string;
    code_verifier: string;
    nonce: string;
  }): Promise<AuthIdentity> {
    this.requireConfig();

    const response = await fetch(`https://${this.domain}/oauth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code: params.code,
        code_verifier: params.code_verifier,
        redirect_uri: params.redirect_uri,
      }).toString(),
    });

    const payload = (await response.json().catch(() => ({}))) as TokenResponse;
    if (!response.ok) {
      const detail = payload.error_description ?? payload.error ?? response.statusText;
      throw new AuthProviderError(`Auth0 rejected the sign-in: ${detail}`, 401);
    }
    if (!payload.id_token) {
      throw new AuthProviderError('Auth0 returned no ID token', 502);
    }

    const claims = await verifyIdToken(payload.id_token, {
      issuer: this.issuer,
      audience: this.clientId,
      jwks_uri: this.jwksUri,
      nonce: params.nonce,
    });

    return {
      subject: claims.sub,
      email: typeof claims.email === 'string' ? claims.email : null,
      name:
        (typeof claims.name === 'string' && claims.name) ||
        (typeof claims.nickname === 'string' && claims.nickname) ||
        (typeof claims.email === 'string' && claims.email) ||
        null,
      picture_url: typeof claims.picture === 'string' ? claims.picture : null,
      expires_at: payload.expires_in ? new Date(Date.now() + payload.expires_in * 1000) : null,
    };
  }

  /**
   * Auth0 keeps its own session, so clearing this app's cookie alone would let
   * the next sign-in go straight through without a challenge — which looks
   * exactly like sign-out not working.
   */
  logoutUrl(params: { return_to: string }): string {
    const url = new URL(`https://${this.domain}/v2/logout`);
    url.search = new URLSearchParams({
      client_id: this.clientId,
      returnTo: params.return_to,
    }).toString();
    return url.toString();
  }
}
