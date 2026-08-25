import { ENTITY_TYPES, RELATIONSHIP_STAGES } from '@/lib/types';

import { OWNERSHIP_FIELDS, SYSTEM_SECTION, toneMap } from './helpers';
import type { FieldDef, ObjectLayout } from './types';

export const entityStageTone = toneMap({
  customer: 'default',
  partner: 'secondary',
  prospect: 'outline',
  former_customer: 'outline',
  inactive: 'destructive',
});

const FIELDS = {
  name: { key: 'name', label: 'Name', type: 'text', required: true } as FieldDef,
  legal_name: { key: 'legal_name', label: 'Legal name', type: 'text' } as FieldDef,
  entity_type: { key: 'entity_type', label: 'Type', type: 'select', options: ENTITY_TYPES, required: true } as FieldDef,
  relationship_stage: {
    key: 'relationship_stage',
    label: 'Status',
    type: 'select',
    options: RELATIONSHIP_STAGES,
    required: true,
    badgeTone: entityStageTone,
  } as FieldDef,
  website_url: { key: 'website_url', label: 'Website', type: 'url' } as FieldDef,
  primary_domain: { key: 'primary_domain', label: 'Domain', type: 'text' } as FieldDef,
  primary_email: { key: 'primary_email', label: 'Email', type: 'email' } as FieldDef,
  primary_phone: { key: 'primary_phone', label: 'Phone', type: 'phone' } as FieldDef,
  address_line_1: { key: 'address_line_1', label: 'Street', type: 'text' } as FieldDef,
  address_line_2: { key: 'address_line_2', label: 'Street (cont.)', type: 'text' } as FieldDef,
  city: { key: 'city', label: 'City', type: 'text' } as FieldDef,
  region: { key: 'region', label: 'State / Region', type: 'text' } as FieldDef,
  postal_code: { key: 'postal_code', label: 'Postal code', type: 'text' } as FieldDef,
  country_code: { key: 'country_code', label: 'Country', type: 'text', placeholder: 'US' } as FieldDef,
  description: { key: 'description', label: 'Description', type: 'longtext' } as FieldDef,
  notes: { key: 'notes', label: 'Internal notes', type: 'longtext' } as FieldDef,
};

export const ENTITY_FIELDS = FIELDS;

export const ENTITY_LAYOUT: ObjectLayout = {
  sections: [
    {
      title: 'Entity Information',
      fields: [FIELDS.name, FIELDS.legal_name, FIELDS.entity_type, FIELDS.relationship_stage, FIELDS.website_url, FIELDS.primary_domain],
    },
    {
      title: 'Contact Information',
      fields: [
        FIELDS.primary_email,
        FIELDS.primary_phone,
        FIELDS.address_line_1,
        FIELDS.address_line_2,
        FIELDS.city,
        FIELDS.region,
        FIELDS.postal_code,
        FIELDS.country_code,
      ],
    },
    { title: 'Ownership', fields: OWNERSHIP_FIELDS },
    { title: 'Additional Information', fields: [FIELDS.description, FIELDS.notes] },
    SYSTEM_SECTION,
  ],
};

export const ENTITY_LIST_COLUMNS = [
  FIELDS.name,
  FIELDS.entity_type,
  FIELDS.relationship_stage,
  FIELDS.city,
  { ...OWNERSHIP_FIELDS[0] },
  { key: 'updated_at', label: 'Last Activity', type: 'datetime' } as FieldDef,
];

export const ENTITY_SEARCH_FIELDS = ['name', 'legal_name', 'primary_email', 'primary_domain', 'city'];
