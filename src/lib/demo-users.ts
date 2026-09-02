/**
 * A small fixed directory of names for the seed data.
 *
 * Real users now live in `app_user` and arrive from the identity provider (see
 * README "Signing in"), but the seed script stamps `owner_user_id` /
 * `created_by_user_id` with fixed uuids that belong to nobody — so this is what
 * turns those into "Hector" or "Sarah" instead of raw uuids on a fresh install.
 * [[current-user]] extends it with "whoever is using this browser right now."
 */
export const DEMO_USERS = [
  { id: '11111111-1111-4111-8111-111111111111', name: 'Hector Medina' },
  { id: '22222222-2222-4222-8222-222222222222', name: 'Sarah Chen' },
  { id: '33333333-3333-4333-8333-333333333333', name: 'Marcus Webb' },
] as const;

export function demoUserName(id: string | null | undefined): string | null {
  if (!id) return null;
  return DEMO_USERS.find((user) => user.id === id)?.name ?? null;
}
