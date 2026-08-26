/**
 * Tunables for the chat tool. Everything that varies per channel lives on the
 * `ChatChannel` row instead — these are the limits that hold across channels.
 */

/** A visitor's message; long enough for a real question, short enough to bound a row. */
export const MAX_MESSAGE_LENGTH = 4000;

/** Verification codes are short-lived and single-use. */
export const AUTH_CODE_TTL_MINUTES = 10;
/** Wrong guesses tolerated on one code before it is burned. */
export const AUTH_CODE_MAX_ATTEMPTS = 5;
/** Codes a single address may request per channel inside the window below. */
export const AUTH_CODE_MAX_PER_WINDOW = 5;
export const AUTH_CODE_WINDOW_MINUTES = 15;

/** Bounds on `session_ttl_hours`: one hour to one year. */
export const MIN_SESSION_TTL_HOURS = 1;
export const MAX_SESSION_TTL_HOURS = 8760;

/** Page size for the public message and conversation endpoints. */
export const PUBLIC_PAGE_SIZE = 200;

/**
 * Mailbox providers whose domain says nothing about who the visitor works
 * for, so a conversation from one of them never opens an Entity named after
 * the domain.
 */
export const CONSUMER_EMAIL_DOMAINS = new Set([
  'aol.com',
  'gmail.com',
  'googlemail.com',
  'gmx.com',
  'hotmail.com',
  'icloud.com',
  'live.com',
  'mail.com',
  'me.com',
  'msn.com',
  'outlook.com',
  'proton.me',
  'protonmail.com',
  'qq.com',
  'yahoo.com',
  'yandex.com',
  'zoho.com',
  '163.com',
]);

/**
 * Whether the API may hand a verification code straight back to the caller.
 *
 * There is no mail provider wired up (see README), so outside production the
 * code is returned in the response and logged by the worker; that is what
 * makes the authenticated flow usable on a laptop. Setting
 * `CHAT_RETURN_AUTH_CODE=false` turns it off even in development.
 */
export function returnsAuthCodeInResponse(): boolean {
  if (process.env.CHAT_RETURN_AUTH_CODE === 'true') return true;
  if (process.env.CHAT_RETURN_AUTH_CODE === 'false') return false;
  return process.env.NODE_ENV !== 'production';
}

/** Split a channel's `allowed_origins` into a list; empty means "any origin". */
export function parseAllowedOrigins(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

/** The domain part of an email, lowercased, or null when it is a consumer mailbox. */
export function companyDomain(email: string | null | undefined): string | null {
  if (!email) return null;
  const domain = email.split('@')[1]?.trim().toLowerCase();
  if (!domain || CONSUMER_EMAIL_DOMAINS.has(domain)) return null;
  return domain;
}
