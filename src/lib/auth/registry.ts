import { Auth0Provider } from './providers/auth0';
import { DevAuthProvider } from './providers/dev';
import type { AuthProvider } from './types';

/**
 * Where the identity provider is chosen.
 *
 * `AUTH_PROVIDER` names it; with nothing set, Auth0 is used if it has
 * credentials and the no-sign-in stand-in otherwise. Adding a provider means a
 * class against `AuthProvider` and one line here.
 */

const PROVIDERS: Record<string, () => AuthProvider> = {
  auth0: () => new Auth0Provider(),
  dev: () => new DevAuthProvider(),
};

const cache = new Map<string, AuthProvider>();

export const AUTH_PROVIDER_IDS = Object.keys(PROVIDERS);

export function configuredAuthProviderId(): string {
  const configured = process.env.AUTH_PROVIDER?.trim();
  if (configured) return configured;
  return new Auth0Provider().isConfigured() ? 'auth0' : 'dev';
}

export function authProvider(id: string = configuredAuthProviderId()): AuthProvider {
  const cached = cache.get(id);
  if (cached) return cached;

  const factory = PROVIDERS[id];
  if (!factory) {
    throw new Error(
      `Unknown auth provider "${id}". Known providers: ${AUTH_PROVIDER_IDS.join(', ')}.`,
    );
  }

  const provider = factory();
  cache.set(id, provider);
  return provider;
}

/**
 * Whether this deployment actually requires anyone to sign in.
 *
 * The single question the route guard, the API handlers, and the user menu all
 * ask. Both halves have to hold: a provider that wants a sign-in but is missing
 * its credentials would otherwise lock everyone out of an app that cannot
 * complete a sign-in either.
 */
export function authEnabled(): boolean {
  const provider = authProvider();
  return provider.requiresSignIn && provider.isConfigured();
}
