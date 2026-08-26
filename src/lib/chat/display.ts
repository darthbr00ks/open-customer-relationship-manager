/** Display helpers shared by the inbox and the widget. No server imports. */

/** What to call a visitor: their name, else their address, else nothing useful. */
export function contactDisplayName(
  contact: { display_name?: string | null; email?: string | null } | null | undefined,
): string {
  if (!contact) return 'Visitor';
  return contact.display_name?.trim() || contact.email || 'Anonymous visitor';
}
