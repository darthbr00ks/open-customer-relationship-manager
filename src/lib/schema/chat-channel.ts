import { CASE_PRIORITIES, CHAT_AUTH_MODES, CHAT_INTAKE_MODES, DEAL_STAGES } from '@/lib/types';

import { OWNERSHIP_FIELDS, SYSTEM_SECTION, toneMap } from './helpers';
import type { FieldDef, ObjectLayout } from './types';

/** Prospecting and support read differently at a glance in the channel list. */
export const chatIntakeTone = toneMap({
  deal: 'default',
  case: 'secondary',
  none: 'outline',
});

/** A channel that demands a verified email is the one worth spotting in a list. */
export const chatAuthTone = toneMap({
  none: 'outline',
  optional: 'secondary',
  required: 'default',
});

const FIELDS = {
  name: { key: 'name', label: 'Name', type: 'text', required: true, placeholder: 'Website support' } as FieldDef,
  key: {
    key: 'key',
    label: 'Key',
    type: 'text',
    required: true,
    placeholder: 'website-support',
    helpText: 'Appears in the widget URL. Lowercase letters, digits, and hyphens.',
  } as FieldDef,
  is_enabled: {
    key: 'is_enabled',
    label: 'Enabled',
    type: 'boolean',
    helpText: 'A disabled channel shows its offline message instead of accepting messages.',
  } as FieldDef,
  description: { key: 'description', label: 'Description', type: 'longtext' } as FieldDef,
  intake_mode: {
    key: 'intake_mode',
    label: 'Creates',
    type: 'select',
    options: CHAT_INTAKE_MODES,
    required: true,
    badgeTone: chatIntakeTone,
    helpText: 'Deal for prospecting, Case for support requests, None to keep the thread only.',
  } as FieldDef,
  auth_mode: {
    key: 'auth_mode',
    label: 'Authentication',
    type: 'select',
    options: CHAT_AUTH_MODES,
    required: true,
    badgeTone: chatAuthTone,
    helpText: 'Required makes visitors verify their email with a code before they can chat.',
  } as FieldDef,
  collect_name: { key: 'collect_name', label: 'Ask for a name', type: 'boolean' } as FieldDef,
  collect_email: { key: 'collect_email', label: 'Ask for an email', type: 'boolean' } as FieldDef,
  auto_create_entity: {
    key: 'auto_create_entity',
    label: 'Create organizations',
    type: 'boolean',
    helpText: 'Open an Entity from the visitor’s email domain when none matches.',
  } as FieldDef,
  greeting: { key: 'greeting', label: 'Greeting', type: 'longtext', placeholder: 'Hi! How can we help?' } as FieldDef,
  offline_message: { key: 'offline_message', label: 'Offline message', type: 'longtext' } as FieldDef,
  default_assignee_user_id: { key: 'default_assignee_user_id', label: 'Default assignee', type: 'user' } as FieldDef,
  deal_stage: { key: 'deal_stage', label: 'Deal stage', type: 'select', options: DEAL_STAGES } as FieldDef,
  deal_currency_code: { key: 'deal_currency_code', label: 'Deal currency', type: 'text' } as FieldDef,
  case_priority: { key: 'case_priority', label: 'Case priority', type: 'select', options: CASE_PRIORITIES } as FieldDef,
  case_category: { key: 'case_category', label: 'Case category', type: 'text' } as FieldDef,
  allowed_origins: {
    key: 'allowed_origins',
    label: 'Allowed origins',
    type: 'text',
    helpText: 'Comma-separated origins allowed to embed the widget. Empty allows any.',
  } as FieldDef,
  session_ttl_hours: {
    key: 'session_ttl_hours',
    label: 'Session length (hours)',
    type: 'number',
    helpText: 'How long a visitor stays signed in on one device.',
  } as FieldDef,
};

export const CHAT_CHANNEL_FIELDS = FIELDS;

export const CHAT_CHANNEL_LAYOUT: ObjectLayout = {
  sections: [
    { title: 'Channel', fields: [FIELDS.name, FIELDS.key, FIELDS.is_enabled, FIELDS.description] },
    {
      title: 'Behavior',
      fields: [
        FIELDS.intake_mode,
        FIELDS.auth_mode,
        FIELDS.collect_name,
        FIELDS.collect_email,
        FIELDS.auto_create_entity,
      ],
    },
    { title: 'Messages', fields: [FIELDS.greeting, FIELDS.offline_message] },
    {
      title: 'Record defaults',
      fields: [
        FIELDS.default_assignee_user_id,
        FIELDS.deal_stage,
        FIELDS.deal_currency_code,
        FIELDS.case_priority,
        FIELDS.case_category,
      ],
    },
    { title: 'Embedding', fields: [FIELDS.allowed_origins, FIELDS.session_ttl_hours] },
    { title: 'Ownership', fields: OWNERSHIP_FIELDS },
    SYSTEM_SECTION,
  ],
};

export const CHAT_CHANNEL_LIST_COLUMNS = [
  FIELDS.name,
  FIELDS.key,
  FIELDS.intake_mode,
  FIELDS.auth_mode,
  FIELDS.is_enabled,
  { key: 'updated_at', label: 'Last modified', type: 'datetime' } as FieldDef,
];

export const CHAT_CHANNEL_SEARCH_FIELDS = ['name', 'key', 'description'];
