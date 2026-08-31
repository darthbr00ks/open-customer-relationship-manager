import { z } from 'zod';

const nullableUuid = z.uuid().nullish();

export const inboundEmailSchema = z
  .object({
    workspace_id: z.uuid(),
    provider: z.string().trim().min(1).max(50),
    external_message_id: z.string().trim().min(1).max(998),
    from_address: z.email().max(320),
    to_addresses: z.array(z.email().max(320)).min(1),
    cc_addresses: z.array(z.email().max(320)).default([]),
    bcc_addresses: z.array(z.email().max(320)).default([]),
    subject: z.string().max(998).default('(no subject)'),
    text_body: z.string().nullish(),
    html_body: z.string().nullish(),
    in_reply_to: z.string().max(998).nullish(),
    reference_message_ids: z.array(z.string().max(998)).default([]),
    received_alias_id: nullableUuid,
    received_user_id: nullableUuid,
    received_profile_id: nullableUuid,
    received_at: z.coerce.date().default(() => new Date()),
    raw_headers: z.record(z.string(), z.string()).default({}),
    raw_storage_key: z.string().max(2048).nullish(),
  })
  .refine((value) => !(value.received_alias_id && value.received_user_id), {
    message: 'Choose either an alias or a direct user delivery context',
    path: ['received_alias_id'],
  });

export const emailAliasCreateSchema = z.object({
  workspace_id: z.uuid(),
  email_address: z.email().max(320).transform((value) => value.toLowerCase()),
  display_name: z.string().max(255).nullish(),
  active: z.boolean().default(true),
});

export const emailAliasUpdateSchema = emailAliasCreateSchema
  .omit({ workspace_id: true })
  .partial();

const policyFields = {
  enabled: z.boolean(),
  record_type: z.enum(['none', 'case', 'deal']),
  only_create_for_net_new: z.literal(true),
  default_owner_type: z.enum(['user', 'queue', 'round_robin']).nullish(),
  default_owner_id: nullableUuid,
};

export const emailPolicyCreateSchema = z
  .object({
    workspace_id: z.uuid(),
    scope_type: z.enum(['system', 'alias', 'profile', 'user']),
    alias_id: nullableUuid,
    profile_id: nullableUuid,
    user_id: nullableUuid,
    ...policyFields,
    enabled: policyFields.enabled.default(false),
    record_type: policyFields.record_type.default('none'),
    only_create_for_net_new: policyFields.only_create_for_net_new.default(true),
  })
  .superRefine((value, context) => {
    const targets = [value.alias_id, value.profile_id, value.user_id].filter(Boolean);
    const expected = value.scope_type === 'system' ? null : `${value.scope_type}_id`;
    const selectedTarget =
      value.scope_type === 'alias'
        ? value.alias_id
        : value.scope_type === 'profile'
          ? value.profile_id
          : value.scope_type === 'user'
            ? value.user_id
            : null;
    if (targets.length !== (expected ? 1 : 0) || (expected && !selectedTarget)) {
      context.addIssue({
        code: 'custom',
        message: `Scope ${value.scope_type} requires only ${expected ?? 'no target id'}`,
        path: ['scope_type'],
      });
    }
    if (value.default_owner_type && !value.default_owner_id) {
      context.addIssue({
        code: 'custom',
        message: 'default_owner_id is required when default_owner_type is set',
        path: ['default_owner_id'],
      });
    }
  });

export const emailPolicyUpdateSchema = z.object(policyFields).partial();
