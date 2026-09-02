import { AuthProviderError, type AuthIdentity, type AuthProvider } from '../types';

/**
 * The provider that stands in when no identity provider is configured.
 *
 * It authenticates nobody. `requiresSignIn` is false, so route guards stay out
 * of the way and the app behaves exactly as it did before there was any auth at
 * all: a name typed into the user menu, stored per browser. That matters for a
 * repository people clone — `npm run dev` has to work without an Auth0 tenant.
 *
 * It also keeps `AuthProvider` honest, the way the console provider does for
 * email: the interface cannot grow anything Auth0-specific while this file has
 * to satisfy it.
 *
 * It refuses to run in production. A deployment that reaches for it there has
 * misconfigured `AUTH_PROVIDER`, and the sharp failure is far better than an
 * unauthenticated CRM on the open internet.
 */
export class DevAuthProvider implements AuthProvider {
  readonly id = 'dev';
  readonly label = 'No sign-in (development)';
  readonly requiresSignIn = false;

  isConfigured(): boolean {
    return process.env.NODE_ENV !== 'production';
  }

  authorizationUrl(): string {
    throw new AuthProviderError(
      'No identity provider is configured. Set AUTH_PROVIDER=auth0 along with ' +
        'AUTH0_DOMAIN, AUTH0_CLIENT_ID and AUTH0_CLIENT_SECRET to enable sign-in.',
      500,
    );
  }

  async exchangeCode(): Promise<AuthIdentity> {
    throw new AuthProviderError('No identity provider is configured', 500);
  }

  logoutUrl(): string | null {
    return null;
  }
}
