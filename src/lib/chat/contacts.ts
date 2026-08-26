import type { ChatChannel, ChatContact } from '@prisma/client';

import { prisma } from '@/lib/prisma';

import { contactDisplayName } from './display';

/** Addresses are compared lowercased so one visitor is one contact. */
export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

/**
 * The contact a visitor is talking as.
 *
 * With an email, one contact per address per channel — so the same person
 * coming back on a new device lands on their own history. Without one, a fresh
 * anonymous contact each time, because there is nothing to recognize them by.
 */
export async function findOrCreateContact(
  channel: ChatChannel,
  { email, display_name }: { email?: string | null; display_name?: string | null },
): Promise<ChatContact> {
  const name = display_name?.trim() ? display_name.trim().slice(0, 255) : null;

  if (!email) {
    return prisma.chatContact.create({
      data: { workspace_id: channel.workspace_id, channel_id: channel.id, display_name: name },
    });
  }

  const normalized = normalizeEmail(email);
  return prisma.chatContact.upsert({
    where: { channel_id_email: { channel_id: channel.id, email: normalized } },
    create: {
      workspace_id: channel.workspace_id,
      channel_id: channel.id,
      email: normalized,
      display_name: name,
    },
    // An empty name on a return visit must not wipe the one already known.
    update: name ? { display_name: name } : {},
  });
}

/** Mark a contact's address as proved by an emailed code. */
export async function markContactVerified(contactId: string): Promise<ChatContact> {
  return prisma.chatContact.update({
    where: { id: contactId },
    data: { verified_at: new Date(), last_seen_at: new Date() },
  });
}

/** How a contact should be labelled in a thread. */
export const contactLabel = contactDisplayName;
