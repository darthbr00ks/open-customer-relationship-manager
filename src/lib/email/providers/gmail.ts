import { buildMimeMessage, toBase64Url } from '../mime';
import {
  EmailProviderError,
  type AuthorizationUrlParams,
  type MailboxCredentials,
  type OAuthEmailProvider,
  type OAuthGrant,
  type OutboundEmail,
  type SendResult,
} from '../types';

/**
 * Gmail, over the Google OAuth 2.0 authorization-code flow with PKCE.
 *
 * Written against Google's HTTP endpoints directly rather than `googleapis`:
 * sending one message is a single POST, and the SDK would pull a large
 * dependency tree in for it.
 *
 * Two properties of Google's flow shape everything here:
 *
 * - The refresh token is issued **once**, on the first consent, and only when
 *   `access_type=offline` is asked for. `prompt=consent` forces a new one, which
 *   is what re-connecting a mailbox relies on.
 * - Gmail will not send as an address the grant does not own, so the connected
 *   address is authoritative and the app never lets a caller pick a `From`.
 */

const AUTHORIZATION_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const REVOKE_ENDPOINT = 'https://oauth2.googleapis.com/revoke';
const SEND_ENDPOINT = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

/**
 * `gmail.send` is the narrowest scope that can send: it grants no read access
 * to the mailbox at all. `openid`/`email` are what name the account being
 * connected, and `profile` supplies the display name shown in the UI.
 */
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'openid',
  'email',
  'profile',
] as const;

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
};

/**
 * Read the claims out of an ID token without verifying its signature.
 *
 * Safe in exactly this position and nowhere else: the token came back over TLS
 * on a direct back-channel call to Google's token endpoint, so there is no
 * third party who could have substituted it. An ID token arriving any other way
 * — through a browser redirect, say — must have its signature checked, which is
 * what `src/lib/auth/jwt.ts` does for Auth0.
 */
function idTokenClaims(idToken: string | undefined): Record<string, unknown> {
  if (!idToken) return {};
  const payload = idToken.split('.')[1];
  if (!payload) return {};
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, unknown>;
  } catch {
    return {};
  }
}

const stringClaim = (claims: Record<string, unknown>, key: string): string | null => {
  const value = claims[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
};

async function postForm(url: string, body: Record<string, string>): Promise<TokenResponse> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  });

  const payload = (await response.json().catch(() => ({}))) as TokenResponse;
  if (!response.ok) {
    const detail = payload.error_description ?? payload.error ?? response.statusText;
    throw new EmailProviderError(`Google rejected the token request: ${detail}`, {
      status: response.status,
      // `invalid_grant` is Google's way of saying the refresh token is dead —
      // revoked, expired after six months idle, or the password changed. No
      // amount of retrying brings it back; the user has to grant access again.
      needs_reauth: payload.error === 'invalid_grant',
      retryable: response.status >= 500,
    });
  }
  return payload;
}

function grantFrom(payload: TokenResponse, fallback?: Partial<OAuthGrant>): OAuthGrant {
  if (!payload.access_token) {
    throw new EmailProviderError('Google returned no access token');
  }
  const claims = idTokenClaims(payload.id_token);

  return {
    access_token: payload.access_token,
    // A refresh that returns no new refresh token means "keep using the one you
    // have" — the caller must not overwrite the stored value with null.
    refresh_token: payload.refresh_token ?? null,
    expires_at: payload.expires_in ? new Date(Date.now() + payload.expires_in * 1000) : null,
    scope: payload.scope ?? null,
    email: stringClaim(claims, 'email') ?? fallback?.email ?? '',
    display_name: stringClaim(claims, 'name') ?? fallback?.display_name ?? null,
    account_id: stringClaim(claims, 'sub') ?? fallback?.account_id ?? null,
  };
}

export class GmailProvider implements OAuthEmailProvider {
  readonly id = 'gmail';
  readonly label = 'Gmail';
  readonly requiresConnectedAccount = true as const;
  readonly scopes = SCOPES;

  private get clientId(): string {
    return process.env.GOOGLE_CLIENT_ID ?? '';
  }

  private get clientSecret(): string {
    return process.env.GOOGLE_CLIENT_SECRET ?? '';
  }

  isConfigured(): boolean {
    return this.clientId.length > 0 && this.clientSecret.length > 0;
  }

  private requireCredentials(): { id: string; secret: string } {
    if (!this.isConfigured()) {
      throw new EmailProviderError(
        'Gmail is not configured: set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.',
      );
    }
    return { id: this.clientId, secret: this.clientSecret };
  }

  authorizationUrl(params: AuthorizationUrlParams): string {
    const { id } = this.requireCredentials();
    const url = new URL(AUTHORIZATION_ENDPOINT);
    url.search = new URLSearchParams({
      client_id: id,
      redirect_uri: params.redirect_uri,
      response_type: 'code',
      scope: SCOPES.join(' '),
      state: params.state,
      code_challenge: params.code_challenge,
      code_challenge_method: 'S256',
      // Offline access is the whole point: without it the grant dies with the
      // browser session and the CRM could not send on the user's behalf later.
      access_type: 'offline',
      // Google withholds a refresh token on a repeat consent unless it is
      // forced, so re-connecting a mailbox would otherwise store tokens that
      // cannot be renewed.
      prompt: 'consent',
      include_granted_scopes: 'true',
    }).toString();

    if (params.login_hint) {
      url.searchParams.set('login_hint', params.login_hint);
    }
    return url.toString();
  }

  async exchangeCode(params: {
    code: string;
    redirect_uri: string;
    code_verifier: string;
  }): Promise<OAuthGrant> {
    const { id, secret } = this.requireCredentials();
    const payload = await postForm(TOKEN_ENDPOINT, {
      client_id: id,
      client_secret: secret,
      code: params.code,
      code_verifier: params.code_verifier,
      grant_type: 'authorization_code',
      redirect_uri: params.redirect_uri,
    });

    const grant = grantFrom(payload);
    if (!grant.email) {
      throw new EmailProviderError('Google did not say which address was connected');
    }
    if (!grant.refresh_token) {
      throw new EmailProviderError(
        'Google issued no refresh token. Remove open-rm from the account\'s third-party ' +
          'access at myaccount.google.com/permissions and connect it again.',
        { needs_reauth: true },
      );
    }
    return grant;
  }

  async refresh(refreshToken: string): Promise<OAuthGrant> {
    const { id, secret } = this.requireCredentials();
    const payload = await postForm(TOKEN_ENDPOINT, {
      client_id: id,
      client_secret: secret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });
    return grantFrom(payload);
  }

  async revoke(token: string): Promise<void> {
    await fetch(REVOKE_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token }).toString(),
    });
  }

  async send(message: OutboundEmail, mailbox: MailboxCredentials): Promise<SendResult> {
    if (!mailbox.access_token) {
      throw new EmailProviderError('This mailbox has no access token', { needs_reauth: true });
    }

    // Gmail sends as the account that granted the token whatever the header
    // says, so the stored address is used rather than anything a caller passed.
    const { raw } = buildMimeMessage({
      ...message,
      from: { email: mailbox.email, name: mailbox.display_name ?? message.from.name ?? null },
    });

    const body: Record<string, string> = { raw: toBase64Url(raw) };
    if (message.thread_id) body.threadId = message.thread_id;

    const response = await fetch(SEND_ENDPOINT, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${mailbox.access_token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const payload = (await response.json().catch(() => ({}))) as {
      id?: string;
      threadId?: string;
      error?: { message?: string; status?: string };
    };

    if (!response.ok) {
      const detail = payload.error?.message ?? response.statusText;
      throw new EmailProviderError(`Gmail refused the message: ${detail}`, {
        status: response.status,
        // 401 means the access token is no longer good. The caller has already
        // refreshed it by this point, so the grant itself is the problem.
        needs_reauth: response.status === 401,
        // 429 is the per-user rate limit; 5xx is Google having a bad minute.
        retryable: response.status === 429 || response.status >= 500,
      });
    }

    return {
      provider_message_id: payload.id ?? null,
      provider_thread_id: payload.threadId ?? null,
    };
  }
}
