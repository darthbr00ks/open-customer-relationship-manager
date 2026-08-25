import type { BadgeTone, FieldDef, Section } from './types';

export const toneMap = (map: Record<string, BadgeTone>) => (value: string) => map[value] ?? 'outline';

/** Owner + audit trail fields every primary object shares — defined once, reused by every layout. */
export const OWNERSHIP_FIELDS: FieldDef[] = [{ key: 'owner_user_id', label: 'Owner', type: 'user' }];

export const SYSTEM_SECTION: Section = {
  title: 'System Information',
  fields: [
    { key: 'created_at', label: 'Created', type: 'datetime', readOnly: true },
    { key: 'created_by_user_id', label: 'Created by', type: 'user', readOnly: true },
    { key: 'updated_at', label: 'Last modified', type: 'datetime', readOnly: true },
    { key: 'updated_by_user_id', label: 'Last modified by', type: 'user', readOnly: true },
  ],
};
