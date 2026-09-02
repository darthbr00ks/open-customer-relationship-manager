/**
 * The contract every mail backend implements.
 *
 * The point of this file is that nothing above it knows what "Gmail" is.
 * `sendEmail` (`./send.ts`) writes a row, asks the registry for a provider, and
 * calls `send`. Swapping Gmail for Microsoft 365, Postmark, or an SMTP relay is
 * a new file in `./providers` plus one line in `./registry.ts` — no route, no
 * component, and no database migration has to move.
 *
 * Two kinds of provider exist:
 *
 * - A **connectionless** provider carries its own credentials in the
 *   environment (an API key, an SMTP login) and can send the moment it is
 *   configured.
 * - An **OAuth** provider sends *as a person*, so a mailbox has to be connected
 *   first. That adds the consent/exchange/refresh surface in
 *   `OAuthEmailProvider`, which `src/lib/email/accounts.ts` drives.
 */

/** An address, plus the display name that goes in front of it when there is one. */
export type EmailAddress = {
  email: string;
  name?: string | null;
};

/** A message as the app describes it, before any provider turns it into wire format. */
export type OutboundEmail = {
  from: EmailAddress;
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  reply_to?: EmailAddress | null;
  subject: string;
  /** Always present: a plain-text part is what makes a message readable everywhere. */
  text: string;
  /** Optional richer part; providers send both as `multipart/alternative`. */
  html?: string | null;
  /**
   * Thread this message belongs to, in whatever form the provider uses. Carried
   * through opaquely — the app never parses it.
   */
  thread_id?: string | null;
  /** RFC 5322 `Message-ID` this is a reply to, when replying. */
  in_reply_to?: string | null;
};

/** What a provider gives back once it has accepted a message. */
export type SendResult = {
  /** The provider's id for the message, or null if it does not issue one. */
  provider_message_id: string | null;
  /** The provider's id for the thread, so a later reply can join it. */
  provider_thread_id: string | null;
};

/**
 * The credentials one send needs, unsealed by `accounts.ts` immediately before
 * the call. Providers never read the database and never see ciphertext.
 */
export type MailboxCredentials = {
  /** The address to send as. An OAuth provider generally refuses any other. */
  email: string;
  display_name?: string | null;
  /** A live access token, already refreshed if it was close to expiring. */
  access_token?: string | null;
};

export interface EmailProvider {
  /** Stable id, stored in `email_account.provider` and read from `EMAIL_PROVIDER`. */
  readonly id: string;
  /** Shown in the UI, e.g. "Gmail". */
  readonly label: string;
  /** True when a mailbox must be connected before this provider can send. */
  readonly requiresConnectedAccount: boolean;
  /**
   * Whether the environment holds everything this provider needs. A provider
   * that is not configured is still listed, so the settings screen can say what
   * is missing rather than the connect button failing later.
   */
  isConfigured(): boolean;
  send(message: OutboundEmail, mailbox: MailboxCredentials): Promise<SendResult>;
}

/** Tokens and identity as they come back from an OAuth token endpoint. */
export type OAuthGrant = {
  access_token: string;
  /**
   * Only issued on the first consent for most providers, so a refresh that
   * returns none leaves the stored one in place.
   */
  refresh_token: string | null;
  expires_at: Date | null;
  scope: string | null;
  /** The mailbox this grant is for. */
  email: string;
  display_name: string | null;
  /** The provider's own id for the account, stable across re-consents. */
  account_id: string | null;
};

export type AuthorizationUrlParams = {
  /** Where the provider sends the browser back to. Must match its registered value. */
  redirect_uri: string;
  /** Opaque anti-CSRF value; the callback checks it against the cookie it set. */
  state: string;
  /** PKCE S256 challenge. */
  code_challenge: string;
  /** Pre-fills the account chooser when the user's address is already known. */
  login_hint?: string | null;
};

/** A provider whose mailboxes are connected by the user granting consent. */
export interface OAuthEmailProvider extends EmailProvider {
  readonly requiresConnectedAccount: true;
  /** Scopes requested at consent, for the settings screen to spell out. */
  readonly scopes: readonly string[];
  /** Where to send the browser to ask for consent. */
  authorizationUrl(params: AuthorizationUrlParams): string;
  /** Trade the authorization code for tokens and the address that was granted. */
  exchangeCode(params: {
    code: string;
    redirect_uri: string;
    code_verifier: string;
  }): Promise<OAuthGrant>;
  /** Trade a refresh token for a fresh access token. */
  refresh(refresh_token: string): Promise<OAuthGrant>;
  /** Best effort: tell the provider the grant is over. Failure is not fatal. */
  revoke?(token: string): Promise<void>;
}

export function isOAuthProvider(provider: EmailProvider): provider is OAuthEmailProvider {
  return provider.requiresConnectedAccount && 'authorizationUrl' in provider;
}

/**
 * A failure a provider understood, as opposed to a bug.
 *
 * `needs_reauth` is the one the rest of the app acts on: it means the grant is
 * gone for good and the mailbox has to be connected again, so the account is
 * parked in `needs_reauth` rather than retried forever.
 */
export class EmailProviderError extends Error {
  constructor(
    message: string,
    readonly options: {
      /** HTTP status the provider returned, when there was one. */
      status?: number;
      /** Whether the same call could plausibly succeed later. */
      retryable?: boolean;
      /** Whether the grant itself is dead. */
      needs_reauth?: boolean;
    } = {},
  ) {
    super(message);
    this.name = 'EmailProviderError';
  }

  get status(): number | undefined {
    return this.options.status;
  }

  get retryable(): boolean {
    return this.options.retryable ?? false;
  }

  get needsReauth(): boolean {
    return this.options.needs_reauth ?? false;
  }
}
