import type { AppUser } from '@prisma/client';

import { prisma } from '@/lib/prisma';

import type { AuthIdentity } from './types';

/**
 * Turning a provider's identity into this app's user.
 *
 * Records carry `owner_user_id` / `created_by_user_id` uuids, and an identity
 * provider hands out subjects like `auth0|65f0c1...` — so something has to sit
 * between them. `app_user` is that: the uuid is minted once, on first sign-in,
 * and never changes. A user who signs in through a different connection, or a
 * workspace that moves to a different provider, gets a new row and is re-linked;
 * every record they already own keeps pointing at the same uuid.
 */

/** Upsert the user behind an identity and stamp the sign-in. */
export async function upsertUserFromIdentity(
  provider: string,
  identity: AuthIdentity,
): Promise<AppUser> {
  const profile = {
    email: identity.email,
    name: identity.name ?? identity.email,
    picture_url: identity.picture_url,
    last_login_at: new Date(),
  };

  return prisma.appUser.upsert({
    where: { auth_provider_external_id: { auth_provider: provider, external_id: identity.subject } },
    create: { auth_provider: provider, external_id: identity.subject, ...profile },
    // The provider is the source of truth for the profile: a name changed there
    // should show up here on the next sign-in rather than being frozen at first.
    update: profile,
  });
}

export function findUser(id: string): Promise<AppUser | null> {
  return prisma.appUser.findUnique({ where: { id } });
}

/** How the UI refers to a user; falls back to the address, then to something printable. */
export const displayNameOf = (user: Pick<AppUser, 'name' | 'email'>): string =>
  user.name?.trim() || user.email?.trim() || 'Unnamed user';
