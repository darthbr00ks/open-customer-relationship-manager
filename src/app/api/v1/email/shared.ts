/** Names shared by the mailbox-connection routes. */

/** Holds the in-flight mailbox connection (state, PKCE verifier, workspace) for one callback. */
export const EMAIL_FLOW_COOKIE = 'open_rm_email_flow';

/** Registered with the provider, so it is a constant rather than something to guess at. */
export const EMAIL_CALLBACK_PATH = '/api/v1/email/callback';

/** Where a finished connection lands by default. */
export const EMAIL_SETTINGS_PATH = '/settings/email';
