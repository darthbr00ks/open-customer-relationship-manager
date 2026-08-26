import { z } from 'zod';

/**
 * Channel keys — the public half of a widget URL, e.g. `/chat/widget/support`.
 *
 * Kept in its own module with no database or framework imports so both the
 * request schemas and the browser can validate a key the same way.
 */

export const CHANNEL_KEY_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

export const channelKeySchema = z
  .string()
  .min(3)
  .max(64)
  .regex(CHANNEL_KEY_PATTERN, 'Use lowercase letters, digits, and hyphens');

/** Suggest a key from a channel's name, e.g. "Sales — EU" → "sales-eu". */
export function slugifyChannelKey(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}
