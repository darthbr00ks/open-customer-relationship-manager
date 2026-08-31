import type { ObjectKey } from '@/lib/objects';

/**
 * Canonical tab order for users who have not created a personal order yet.
 * Existing users retain their own browser-local order when this changes; any
 * newly added tabs are appended automatically.
 */
export const DEFAULT_PRIMARY_TAB_ORDER: readonly ObjectKey[] = [
  'entities',
  'persons',
  'deals',
  'cases',
  'incidents',
  'requests',
  'exception_logs',
];

