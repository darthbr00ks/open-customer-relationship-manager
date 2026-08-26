import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

/**
 * Secrets on the customer side of chat: the session bearer token and the
 * emailed verification code. Both are stored only as SHA-256 hashes, so a
 * database dump does not hand anyone a working session.
 */

/** A visitor's bearer token. 256 bits, URL-safe so it survives a query string. */
export const newSessionToken = (): string => randomBytes(32).toString('base64url');

export const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

/** Six digits, uniformly distributed — short enough to retype from an email. */
export const newAuthCode = (): string => String(randomInt(0, 1_000_000)).padStart(6, '0');

/**
 * Codes are salted with the channel id so the same digits issued for two
 * channels do not share a hash.
 */
export const hashAuthCode = (channelId: string, code: string): string =>
  createHash('sha256').update(`${channelId}:${code}`).digest('hex');

/** Constant-time comparison of two hex digests. */
export function hashesMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  if (left.length !== right.length || left.length === 0) return false;
  return timingSafeEqual(left, right);
}
