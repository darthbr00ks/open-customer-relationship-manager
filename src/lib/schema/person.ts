import { OWNERSHIP_FIELDS, SYSTEM_SECTION } from './helpers';
import type { FieldDef, ObjectLayout } from './types';

const FIELDS = {
  first_name: { key: 'first_name', label: 'First name', type: 'text', required: true } as FieldDef,
  last_name: { key: 'last_name', label: 'Last name', type: 'text' } as FieldDef,
  preferred_name: { key: 'preferred_name', label: 'Preferred name', type: 'text' } as FieldDef,
  primary_email: { key: 'primary_email', label: 'Email', type: 'email' } as FieldDef,
  primary_phone: { key: 'primary_phone', label: 'Phone', type: 'phone' } as FieldDef,
  linkedin_url: { key: 'linkedin_url', label: 'LinkedIn', type: 'url' } as FieldDef,
  description: { key: 'description', label: 'Description', type: 'longtext' } as FieldDef,
  notes: { key: 'notes', label: 'Internal notes', type: 'longtext' } as FieldDef,
};

export const PERSON_FIELDS = FIELDS;

export const PERSON_LAYOUT: ObjectLayout = {
  sections: [
    {
      title: 'Person Information',
      fields: [FIELDS.first_name, FIELDS.last_name, FIELDS.preferred_name],
    },
    {
      title: 'Contact Information',
      fields: [FIELDS.primary_email, FIELDS.primary_phone, FIELDS.linkedin_url],
    },
    { title: 'Ownership', fields: OWNERSHIP_FIELDS },
    { title: 'Additional Information', fields: [FIELDS.description, FIELDS.notes] },
    SYSTEM_SECTION,
  ],
};

export const PERSON_LIST_COLUMNS = [
  FIELDS.first_name,
  FIELDS.last_name,
  FIELDS.primary_email,
  FIELDS.primary_phone,
  { ...OWNERSHIP_FIELDS[0] },
  { key: 'updated_at', label: 'Last Activity', type: 'datetime' } as FieldDef,
];

export const PERSON_SEARCH_FIELDS = ['first_name', 'last_name', 'preferred_name', 'primary_email'];
