import { PRODUCT_STATUSES } from '@/lib/types';

import { OWNERSHIP_FIELDS, SYSTEM_SECTION, toneMap } from './helpers';
import type { FieldDef, ObjectLayout } from './types';

export const productStatusTone = toneMap({
  draft: 'outline',
  active: 'default',
  retired: 'secondary',
  archived: 'destructive',
});

const FIELDS = {
  name: { key: 'name', label: 'Product name', type: 'text', required: true } as FieldDef,
  status: {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: PRODUCT_STATUSES,
    required: true,
    badgeTone: productStatusTone,
  } as FieldDef,
  category: {
    key: 'category',
    label: 'Category',
    type: 'text',
    placeholder: 'Hardware, consulting, software…',
  } as FieldDef,
  tax_category: {
    key: 'tax_category',
    label: 'Tax category',
    type: 'text',
    helpText: 'Feeds tax determination downstream.',
  } as FieldDef,
  description: { key: 'description', label: 'Description', type: 'longtext' } as FieldDef,
  notes: { key: 'notes', label: 'Internal notes', type: 'longtext' } as FieldDef,
};

export const PRODUCT_FIELDS = FIELDS;

export const PRODUCT_LAYOUT: ObjectLayout = {
  sections: [
    // A product carries no price: the same thing may be packaged and priced
    // several ways, and that lives on its offerings.
    { title: 'Product Information', fields: [FIELDS.name, FIELDS.status, FIELDS.category, FIELDS.tax_category] },
    { title: 'Ownership', fields: OWNERSHIP_FIELDS },
    { title: 'Additional Information', fields: [FIELDS.description, FIELDS.notes] },
    SYSTEM_SECTION,
  ],
};

export const PRODUCT_LIST_COLUMNS = [
  FIELDS.name,
  FIELDS.category,
  FIELDS.status,
  { ...OWNERSHIP_FIELDS[0] },
];

export const PRODUCT_SEARCH_FIELDS = ['name', 'category'];
