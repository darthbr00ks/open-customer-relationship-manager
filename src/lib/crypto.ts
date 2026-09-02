import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Symmetric encryption for secrets this app holds on someone else's behalf.
 *
 * Chat's tokens are only ever hashed (`src/lib/chat/tokens.ts`) because nothing
 * needs to read them back. An OAuth refresh token is the opposite case: the
 * server has to present the original to Google every time an access token
 * expires, so it must be reversible — which makes "encrypted with a key that
 * lives outside the database" the strongest thing available. A database dump on
 * its own then buys an attacker nothing.
 *
 * Ciphertext is `v1.<iv>.<tag>.<ciphertext>`, each part base64url. The version
 * prefix is what lets the algorithm or the key change later without guessing at
 * the shape of rows already written.
 */

const VERSION = 'v1';
const ALGORITHM = 'aes-256-gcm';
/** 96 bits, the nonce size AES-GCM is specified for. */
const IV_BYTES = 12;
const KEY_BYTES = 32;

export class MissingEncryptionKeyError extends Error {
  constructor() {
    super(
      'SECRET_ENCRYPTION_KEY is not set. Generate one with `openssl rand -base64 32` ' +
        'and put it in your environment — connected mailboxes cannot be stored without it.',
    );
    this.name = 'MissingEncryptionKeyError';
  }
}

/**
 * Decode the configured key.
 *
 * Base64 or hex, and 32 bytes either way. A passphrase is deliberately not
 * accepted: stretching one here would quietly turn "hunter2" into something
 * that looks like a key, and the failure would be invisible.
 */
function encryptionKey(): Buffer {
  const configured = process.env.SECRET_ENCRYPTION_KEY;
  if (!configured) {
    throw new MissingEncryptionKeyError();
  }

  const decoded = /^[0-9a-fA-F]{64}$/.test(configured)
    ? Buffer.from(configured, 'hex')
    : Buffer.from(configured, 'base64');

  if (decoded.length !== KEY_BYTES) {
    throw new Error(
      `SECRET_ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes (got ${decoded.length}). ` +
        'Generate one with `openssl rand -base64 32`.',
    );
  }
  return decoded;
}

/** Whether a key is configured, for a settings screen that would rather explain than throw. */
export function hasEncryptionKey(): boolean {
  try {
    encryptionKey();
    return true;
  } catch {
    return false;
  }
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return [
    VERSION,
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.');
}

/** Reverses `encryptSecret`. Throws if the key is wrong or the value was tampered with. */
export function decryptSecret(value: string): string {
  const [version, iv, tag, ciphertext] = value.split('.');
  if (version !== VERSION || !iv || !tag || !ciphertext) {
    throw new Error('Ciphertext is not in the expected format');
  }

  const decipher = createDecipheriv(ALGORITHM, encryptionKey(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

/** Encrypt only when there is something to encrypt, so optional columns stay null. */
export const encryptOptional = (value: string | null | undefined): string | null =>
  value ? encryptSecret(value) : null;

export const decryptOptional = (value: string | null | undefined): string | null =>
  value ? decryptSecret(value) : null;

/**
 * Constant-time string comparison for secrets that arrive from outside — an
 * OAuth `state`, a signature. Length is not secret, so an early return on it
 * leaks nothing that the request itself did not already.
 */
export function secretsMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length || left.length === 0) return false;
  return timingSafeEqual(left, right);
}
