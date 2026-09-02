import { ConsoleEmailProvider } from './providers/console';
import { GmailProvider } from './providers/gmail';
import { isOAuthProvider, type EmailProvider, type OAuthEmailProvider } from './types';

/**
 * Where a mail backend is chosen.
 *
 * Adding one means writing a class against `EmailProvider` and adding a line to
 * `PROVIDERS`. Nothing else in the app names a provider: routes ask for
 * `emailProvider()`, and a connected mailbox remembers which id sent it so that
 * changing `EMAIL_PROVIDER` cannot strand rows behind a backend that no longer
 * handles them.
 */

const PROVIDERS: Record<string, () => EmailProvider> = {
  gmail: () => new GmailProvider(),
  console: () => new ConsoleEmailProvider(),
};

/** Instances are cheap but stateless, so one per id is kept rather than one per call. */
const cache = new Map<string, EmailProvider>();

export const EMAIL_PROVIDER_IDS = Object.keys(PROVIDERS);

export class UnknownEmailProviderError extends Error {
  constructor(id: string) {
    super(`Unknown email provider "${id}". Known providers: ${EMAIL_PROVIDER_IDS.join(', ')}.`);
    this.name = 'UnknownEmailProviderError';
  }
}

/**
 * The provider the deployment sends through.
 *
 * `EMAIL_PROVIDER` wins when it is set. Otherwise Gmail is used if it has
 * credentials, and the console provider stands in when it does not — but only
 * outside production, where a message that is merely logged is a development
 * convenience rather than lost mail.
 */
export function configuredEmailProviderId(): string {
  const configured = process.env.EMAIL_PROVIDER?.trim();
  if (configured) return configured;
  if (new GmailProvider().isConfigured()) return 'gmail';
  return process.env.NODE_ENV === 'production' ? 'gmail' : 'console';
}

export function emailProvider(id: string = configuredEmailProviderId()): EmailProvider {
  const cached = cache.get(id);
  if (cached) return cached;

  const factory = PROVIDERS[id];
  if (!factory) throw new UnknownEmailProviderError(id);

  const provider = factory();
  cache.set(id, provider);
  return provider;
}

/** The configured provider when mailboxes are connected to it, else null. */
export function oauthEmailProvider(id?: string): OAuthEmailProvider | null {
  const provider = emailProvider(id);
  return isOAuthProvider(provider) ? provider : null;
}

/** Everything the settings screen lists, with whether each one can actually be used. */
export function emailProviderSummaries() {
  const active = configuredEmailProviderId();
  return EMAIL_PROVIDER_IDS.map((id) => {
    const provider = emailProvider(id);
    return {
      id: provider.id,
      label: provider.label,
      requires_connected_account: provider.requiresConnectedAccount,
      configured: provider.isConfigured(),
      active: provider.id === active,
    };
  });
}
