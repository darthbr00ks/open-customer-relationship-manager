import { randomUUID } from 'node:crypto';

import type { EmailAutomationPolicy, Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';

export type NormalizedInboundEmail = {
  workspace_id: string;
  provider: string;
  external_message_id: string;
  from_address: string;
  to_addresses: string[];
  cc_addresses?: string[];
  bcc_addresses?: string[];
  subject: string;
  text_body?: string | null;
  html_body?: string | null;
  in_reply_to?: string | null;
  reference_message_ids?: string[];
  received_alias_id?: string | null;
  received_user_id?: string | null;
  received_profile_id?: string | null;
  received_at: Date;
  raw_headers?: Record<string, string>;
  raw_storage_key?: string | null;
};

export type InboundEmailResult = {
  duplicate: boolean;
  message_id: string;
  thread_id: string | null;
  related_record_type: 'none' | 'case' | 'deal';
  related_record_id: string | null;
  policy_id: string | null;
};

type Tx = Prisma.TransactionClient;

const REF_PATTERN = /ref:crm:([A-Za-z0-9_-]{8,64})/i;

function normalizeAddress(value: string): string {
  return value.trim().toLowerCase();
}

function embeddedReference(email: NormalizedInboundEmail): string | null {
  const header = Object.entries(email.raw_headers ?? {}).find(
    ([key]) => key.toLowerCase() === 'x-openrm-thread-id',
  )?.[1];
  if (header?.trim()) return header.trim();
  return REF_PATTERN.exec(`${email.text_body ?? ''}\n${email.html_body ?? ''}`)?.[1] ?? null;
}

async function resolveThread(tx: Tx, email: NormalizedInboundEmail) {
  const reference = embeddedReference(email);
  if (reference) {
    const thread = await tx.emailThread.findFirst({
      where: { workspace_id: email.workspace_id, external_reference_id: reference },
    });
    if (thread) return thread;
  }

  const ids = [email.in_reply_to, ...(email.reference_message_ids ?? [])].filter(
    (value): value is string => Boolean(value),
  );
  if (ids.length === 0) return null;

  const parent = await tx.emailMessage.findFirst({
    where: {
      workspace_id: email.workspace_id,
      external_message_id: { in: ids },
      thread_id: { not: null },
    },
    orderBy: { received_at: 'desc' },
  });
  return parent?.thread_id
    ? tx.emailThread.findFirst({ where: { id: parent.thread_id, workspace_id: email.workspace_id } })
    : null;
}

export async function resolveInboundPolicy(
  tx: Tx,
  email: Pick<
    NormalizedInboundEmail,
    'workspace_id' | 'received_alias_id' | 'received_user_id' | 'received_profile_id'
  >,
): Promise<EmailAutomationPolicy | null> {
  const base = { workspace_id: email.workspace_id };

  // Managed aliases are company-controlled delivery contexts. Personal policy
  // must never override support@, sales@, and similar endpoints.
  if (email.received_alias_id) {
    return (
      (await tx.emailAutomationPolicy.findFirst({
        where: { ...base, scope_type: 'alias', alias_id: email.received_alias_id },
      })) ??
      tx.emailAutomationPolicy.findFirst({ where: { ...base, scope_type: 'system' } })
    );
  }

  if (email.received_user_id) {
    const user = await tx.emailAutomationPolicy.findFirst({
      where: { ...base, scope_type: 'user', user_id: email.received_user_id },
    });
    if (user) return user;
  }
  if (email.received_profile_id) {
    const profile = await tx.emailAutomationPolicy.findFirst({
      where: { ...base, scope_type: 'profile', profile_id: email.received_profile_id },
    });
    if (profile) return profile;
  }
  return tx.emailAutomationPolicy.findFirst({ where: { ...base, scope_type: 'system' } });
}

async function findSender(tx: Tx, workspaceId: string, address: string) {
  return tx.person.findFirst({
    where: { workspace_id: workspaceId, primary_email: { equals: address, mode: 'insensitive' } },
  });
}

function senderDisplayName(address: string): string {
  const local = address.split('@')[0] || 'Email sender';
  return local
    .split(/[._+-]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}

async function resolveDealParty(tx: Tx, email: NormalizedInboundEmail) {
  const address = normalizeAddress(email.from_address);
  let person = await findSender(tx, email.workspace_id, address);
  if (person) {
    const affiliation = await tx.entityPerson.findFirst({
      where: { workspace_id: email.workspace_id, person_id: person.id, status: 'current' },
      orderBy: [{ is_primary_contact: 'desc' }, { created_at: 'asc' }],
    });
    if (affiliation) return { person, entity_id: affiliation.entity_id };
  }

  const domain = address.split('@')[1]?.toLowerCase() || null;
  let entity = domain
    ? await tx.entity.findFirst({
        where: { workspace_id: email.workspace_id, primary_domain: { equals: domain, mode: 'insensitive' } },
      })
    : null;
  if (!entity) {
    entity = await tx.entity.create({
      data: {
        workspace_id: email.workspace_id,
        name: domain ?? senderDisplayName(address),
        entity_type: 'company',
        primary_domain: domain,
        relationship_stage: 'prospect',
      },
    });
  }
  if (!person) {
    const [first_name, ...rest] = senderDisplayName(address).split(' ');
    person = await tx.person.create({
      data: {
        workspace_id: email.workspace_id,
        first_name,
        last_name: rest.join(' ') || null,
        primary_email: address,
      },
    });
  }
  await tx.entityPerson.upsert({
    where: {
      workspace_id_entity_id_person_id: {
        workspace_id: email.workspace_id,
        entity_id: entity.id,
        person_id: person.id,
      },
    },
    create: {
      workspace_id: email.workspace_id,
      entity_id: entity.id,
      person_id: person.id,
      relationship_type: 'customer_contact',
      is_primary_contact: true,
    },
    update: {},
  });
  return { person, entity_id: entity.id };
}

function ownerId(policy: EmailAutomationPolicy, email: NormalizedInboundEmail): string | null {
  if (policy.default_owner_type === 'user') return policy.default_owner_id;
  if (!policy.default_owner_type && !email.received_alias_id) return email.received_user_id ?? null;
  // Queues and round-robin are intentionally handed to the assignment engine.
  return null;
}

async function createRecord(tx: Tx, policy: EmailAutomationPolicy, email: NormalizedInboundEmail) {
  const body = email.text_body?.trim() || 'Inbound email (HTML body stored on the email message).';
  const sender = await findSender(tx, email.workspace_id, normalizeAddress(email.from_address));
  const owner_user_id = ownerId(policy, email);

  if (policy.record_type === 'case') {
    const supportCase = await tx.supportCase.create({
      data: {
        workspace_id: email.workspace_id,
        case_number: `EMAIL-${randomUUID().slice(0, 8).toUpperCase()}`,
        subject: email.subject || '(no subject)',
        description: body,
        source: 'email',
        owner_user_id,
        reported_by_person_id: sender?.id ?? null,
      },
    });
    return { type: 'case' as const, id: supportCase.id };
  }

  if (policy.record_type === 'deal') {
    const party = await resolveDealParty(tx, email);
    const deal = await tx.deal.create({
      data: {
        workspace_id: email.workspace_id,
        name: email.subject || `${party.person.first_name} - Inbound inquiry`,
        description: body,
        entity_id: party.entity_id,
        primary_contact_person_id: party.person.id,
        owner_user_id,
      },
    });
    return { type: 'deal' as const, id: deal.id };
  }
  return { type: 'none' as const, id: null };
}

async function processOnce(email: NormalizedInboundEmail): Promise<InboundEmailResult> {
  return prisma.$transaction(async (tx) => {
    const duplicate = await tx.emailMessage.findUnique({
      where: {
        workspace_id_provider_external_message_id: {
          workspace_id: email.workspace_id,
          provider: email.provider,
          external_message_id: email.external_message_id,
        },
      },
    });
    if (duplicate) {
      return {
        duplicate: true,
        message_id: duplicate.id,
        thread_id: duplicate.thread_id,
        related_record_type: duplicate.related_record_type,
        related_record_id: duplicate.related_record_id,
        policy_id: null,
      };
    }

    let thread = await resolveThread(tx, email);
    let policy: EmailAutomationPolicy | null = null;
    let record = thread
      ? { type: thread.related_record_type, id: thread.related_record_id }
      : { type: 'none' as const, id: null };

    if (!thread) {
      policy = await resolveInboundPolicy(tx, email);
      if (policy?.enabled && policy.record_type !== 'none') {
        record = await createRecord(tx, policy, email);
      }
      const participants = [email.from_address, ...email.to_addresses, ...(email.cc_addresses ?? [])]
        .map(normalizeAddress)
        .filter((value, index, all) => all.indexOf(value) === index);
      thread = await tx.emailThread.create({
        data: {
          workspace_id: email.workspace_id,
          external_reference_id: randomUUID().replaceAll('-', ''),
          related_record_type: record.type,
          related_record_id: record.id,
          case_id: record.type === 'case' ? record.id : null,
          deal_id: record.type === 'deal' ? record.id : null,
          participants,
          last_message_at: email.received_at,
        },
      });
    }

    const message = await tx.emailMessage.create({
      data: {
        workspace_id: email.workspace_id,
        provider: email.provider,
        external_message_id: email.external_message_id,
        thread_id: thread.id,
        direction: 'inbound',
        from_address: normalizeAddress(email.from_address),
        to_addresses: email.to_addresses.map(normalizeAddress),
        cc_addresses: (email.cc_addresses ?? []).map(normalizeAddress),
        bcc_addresses: (email.bcc_addresses ?? []).map(normalizeAddress),
        subject: email.subject || '(no subject)',
        text_body: email.text_body,
        html_body: email.html_body,
        in_reply_to: email.in_reply_to,
        reference_message_ids: email.reference_message_ids ?? [],
        received_alias_id: email.received_alias_id,
        received_user_id: email.received_user_id,
        related_record_type: thread.related_record_type,
        related_record_id: thread.related_record_id,
        raw_headers: email.raw_headers,
        raw_storage_key: email.raw_storage_key,
        received_at: email.received_at,
      },
    });
    await tx.emailThread.update({
      where: { id: thread.id },
      data: { last_message_at: email.received_at },
    });

    return {
      duplicate: false,
      message_id: message.id,
      thread_id: thread.id,
      related_record_type: thread.related_record_type,
      related_record_id: thread.related_record_id,
      policy_id: policy?.id ?? null,
    };
  });
}

export async function processInboundEmail(email: NormalizedInboundEmail): Promise<InboundEmailResult> {
  try {
    return await processOnce(email);
  } catch (error) {
    // A provider retry can race the first request. The unique key is the final
    // arbiter; after the winner commits, return its message as the idempotent result.
    if ((error as { code?: string }).code !== 'P2002') throw error;
    const existing = await prisma.emailMessage.findUnique({
      where: {
        workspace_id_provider_external_message_id: {
          workspace_id: email.workspace_id,
          provider: email.provider,
          external_message_id: email.external_message_id,
        },
      },
    });
    if (!existing) throw error;
    return {
      duplicate: true,
      message_id: existing.id,
      thread_id: existing.thread_id,
      related_record_type: existing.related_record_type,
      related_record_id: existing.related_record_id,
      policy_id: null,
    };
  }
}

