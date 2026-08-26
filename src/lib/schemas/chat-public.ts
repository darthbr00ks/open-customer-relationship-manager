import { z } from 'zod';

import { MAX_MESSAGE_LENGTH } from '@/lib/chat/config';

/**
 * Payloads accepted from the customer's browser.
 *
 * Deliberately narrow: a visitor may say who they are and what they want, and
 * nothing else. Ownership, CRM links, priority and assignment are the channel
 * configuration's business, never the caller's.
 */

const email = () => z.email().max(320);
const displayName = () => z.string().trim().max(255);

export const startSessionSchema = z.object({
  email: email().optional(),
  display_name: displayName().optional(),
});

export const requestCodeSchema = z.object({ email: email() });

export const verifyCodeSchema = z.object({
  email: email(),
  code: z.string().trim().min(4).max(12),
  display_name: displayName().optional(),
});

export const startConversationSchema = z.object({
  subject: z.string().trim().max(500).optional(),
  message: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH),
});

export const postMessageSchema = z.object({
  body: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH),
});

/** The visitor may close a thread they opened, and reopen it by writing again. */
export const updateConversationSchema = z.object({ status: z.literal('closed') });
