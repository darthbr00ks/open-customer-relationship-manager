/**
 * The contract every identity provider implements.
 *
 * Same shape, and same reasoning, as `src/lib/email/types.ts`: the app knows
 * about sessions and users, not about Auth0. A provider's whole job is to turn
 * a browser round trip into an `AuthIdentity`; from there `src/lib/auth/users.ts`
 * maps it onto a stable uuid and `src/lib/auth/session.ts` issues the cookie.
 * Moving to Okta, Entra ID, or Keycloak is a file in `./providers` and a line in
 * `./registry.ts`.
 */

/** What a provider proved about the person who just signed in. */
export type AuthIdentity = {
  /** The provider's stable identifier for them — the OIDC `sub` claim. */
  subject: string;
  email: string | null;
  /** Best display name the provider offered; the app falls back to the address. */
  name: string | null;
  picture_url: string | null;
  /** When the provider's own session expires, when it says. */
  expires_at: Date | null;
};

export type AuthorizationUrlParams = {
  redirect_uri: string;
  state: string;
  code_challenge: string;
  /** Replay defence: the same value must come back inside the ID token. */
  nonce: string;
  /** Pre-fills the address on the provider's form when it is already known. */
  login_hint?: string | null;
};

export interface AuthProvider {
  /** Stable id, stored in `app_user.auth_provider` and read from `AUTH_PROVIDER`. */
  readonly id: string;
  /** Shown on the sign-in screen, e.g. "Auth0". */
  readonly label: string;
  /**
   * Whether this provider actually challenges anyone. False for the stand-in
   * that keeps the app usable with no identity provider configured, and the one
   * switch the rest of the app checks when deciding whether to guard a route.
   */
  readonly requiresSignIn: boolean;
  /** Whether the environment holds everything the provider needs. */
  isConfigured(): boolean;
  /** Where to send the browser to sign in. */
  authorizationUrl(params: AuthorizationUrlParams): string;
  /** Trade the authorization code for the identity it proves. */
  exchangeCode(params: {
    code: string;
    redirect_uri: string;
    code_verifier: string;
    nonce: string;
  }): Promise<AuthIdentity>;
  /**
   * Where to send the browser to end the provider's own session. Null when the
   * provider has none to end — clearing this app's cookie is then the whole of
   * signing out.
   */
  logoutUrl(params: { return_to: string }): string | null;
}

export class AuthProviderError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = 'AuthProviderError';
  }
}
