/**
 * There is no `User` table — this app has no authentication yet (see README
 * "Known gaps"). `owner_user_id` / `created_by_user_id` / `updated_by_user_id`
 * are free-floating uuids, so this is a small fixed directory the UI and the
 * seed script both use to turn those ids into names like "Hector" or "Sarah"
 * instead of raw uuids. [[current-user]] extends it with "whoever is using
 * this browser right now."
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
