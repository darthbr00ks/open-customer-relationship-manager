import type { ChatChannel, ChatContact, Prisma } from '@prisma/client';

import { companyDomain } from './config';
import { contactLabel } from './contacts';

/**
 * What a new conversation opens in the CRM.
 *
 * A channel configured for prospecting opens a Deal; one configured for
 * support opens a Case; one configured for neither just keeps the thread. In
 * every mode intake first works out *who* is talking — matching an existing
 * Person and Entity before creating anything — so a returning customer's chat
 * lands on the records the workspace already has rather than a duplicate set.
 */

export type IntakeResult = {
  entity_id: string | null;
  person_id: string | null;
  deal_id: string | null;
  case_id: string | null;
  /** A line posted into the thread, or null when nothing was opened. */
  summary: string | null;
  /**
   * Whether that line is for the workspace's eyes only. A case number is the
   * customer's own reference and belongs in front of them; the fact that a
   * deal was opened is internal sales vocabulary and stays behind the scenes.
   */
  summary_is_internal: boolean;
};

type IntakeInput = {
  channel: ChatChannel;
  contact: ChatContact;
  subject: string;
  /** The visitor's first message; becomes the Deal/Case description. */
  message: string;
  /** Bumped by the caller when a generated case number collided. */
  numberAttempt?: number;
};

/** Split a display name into the Person columns, falling back to the email's local part. */
function personName(contact: ChatContact): { first_name: string; last_name: string | null } {
  const name = contact.display_name?.trim();
  if (name) {
    const [first, ...rest] = name.split(/\s+/);
    return { first_name: first!.slice(0, 100), last_name: rest.join(' ').slice(0, 100) || null };
  }
  const local = contact.email?.split('@')[0]?.trim();
  return { first_name: (local || 'Website visitor').slice(0, 100), last_name: null };
}

/** Match the visitor to a CRM Person by email, or open one. */
async function resolvePerson(tx: Prisma.TransactionClient, input: IntakeInput): Promise<string | null> {
  const { channel, contact } = input;

  if (contact.person_id) return contact.person_id;

  if (contact.email) {
    const existing = await tx.person.findFirst({
      where: { workspace_id: channel.workspace_id, primary_email: contact.email, archived_at: null },
      orderBy: { created_at: 'asc' },
    });
    if (existing) return existing.id;
  }

  // With nothing to identify them by, an anonymous visitor on a channel that
  // opens no CRM record stays out of the People list entirely.
  if (!contact.email && channel.intake_mode === 'none') return null;

  const person = await tx.person.create({
    data: {
      workspace_id: channel.workspace_id,
      ...personName(contact),
      primary_email: contact.email,
      owner_user_id: channel.default_assignee_user_id,
      created_by_user_id: channel.default_assignee_user_id,
      description: `Created from the "${channel.name}" chat channel.`,
    },
  });
  return person.id;
}

/**
 * Match the visitor to an Entity: one they are already affiliated with, then
 * one whose domain matches their email, and only then a new one — and only if
 * the channel allows intake to create entities.
 */
async function resolveEntity(
  tx: Prisma.TransactionClient,
  input: IntakeInput,
  personId: string | null,
): Promise<string | null> {
  const { channel, contact } = input;

  if (contact.entity_id) return contact.entity_id;

  if (personId) {
    const affiliation = await tx.entityPerson.findFirst({
      where: { workspace_id: channel.workspace_id, person_id: personId, status: 'current' },
      orderBy: [{ is_primary_contact: 'desc' }, { created_at: 'asc' }],
    });
    if (affiliation) return affiliation.entity_id;
  }

  const domain = companyDomain(contact.email);
  if (domain) {
    const existing = await tx.entity.findFirst({
      where: { workspace_id: channel.workspace_id, primary_domain: domain, archived_at: null },
      orderBy: { created_at: 'asc' },
    });
    if (existing) return existing.id;
  }

  if (!channel.auto_create_entity) return null;

  if (domain) {
    const entity = await tx.entity.create({
      data: {
        workspace_id: channel.workspace_id,
        name: domain,
        entity_type: 'company',
        relationship_stage: 'prospect',
        primary_domain: domain,
        primary_email: contact.email,
        owner_user_id: channel.default_assignee_user_id,
        created_by_user_id: channel.default_assignee_user_id,
        description: `Created from the "${channel.name}" chat channel.`,
      },
    });
    return entity.id;
  }

  // A Deal cannot exist without an Entity, so a consumer-mailbox visitor on a
  // prospecting channel gets one standing for them personally.
  if (channel.intake_mode !== 'deal') return null;

  const entity = await tx.entity.create({
    data: {
      workspace_id: channel.workspace_id,
      name: contactLabel(contact).slice(0, 255),
      entity_type: 'household',
      relationship_stage: 'prospect',
      primary_email: contact.email,
      owner_user_id: channel.default_assignee_user_id,
      created_by_user_id: channel.default_assignee_user_id,
      description: `Created from the "${channel.name}" chat channel.`,
    },
  });
  return entity.id;
}

/** Keep the person on the entity's contact list, without disturbing an affiliation that already exists. */
async function linkAffiliation(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  entityId: string,
  personId: string,
) {
  const existing = await tx.entityPerson.findFirst({
    where: { workspace_id: workspaceId, entity_id: entityId, person_id: personId },
  });
  if (existing) return;

  await tx.entityPerson.create({
    data: {
      workspace_id: workspaceId,
      entity_id: entityId,
      person_id: personId,
      relationship_type: 'customer_contact',
      status: 'current',
    },
  });
}

/**
 * The next case number in a workspace, in the `CASE-1042` shape the rest of
 * the app uses. Two conversations opened in the same instant can land on the
 * same number; the unique index catches it and the caller retries with the
 * attempt bumped.
 */
async function nextCaseNumber(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  attempt: number,
): Promise<string> {
  const count = await tx.supportCase.count({ where: { workspace_id: workspaceId } });
  return `CASE-${1000 + count + 1 + attempt}`;
}

/** Record where a CRM record came from, so its Activity tab explains itself. */
async function logOrigin(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  parentType: 'deal' | 'case',
  parentId: string,
  channel: ChatChannel,
  conversationId: string,
) {
  await tx.note.create({
    data: {
      workspace_id: workspaceId,
      parent_type: parentType,
      parent_id: parentId,
      kind: 'system',
      body: `Opened from the "${channel.name}" chat channel (conversation ${conversationId}).`,
      created_by_user_id: channel.default_assignee_user_id,
    },
  });
}

/**
 * Run a channel's intake for a new conversation. Called inside the same
 * transaction that creates the conversation, so a workspace never ends up with
 * a Case whose thread does not exist (or the reverse).
 */
export async function runIntake(
  tx: Prisma.TransactionClient,
  input: IntakeInput,
  conversationId: string,
): Promise<IntakeResult> {
  const { channel, subject, message, numberAttempt = 0 } = input;

  const person_id = await resolvePerson(tx, input);
  const entity_id = await resolveEntity(tx, input, person_id);
  if (entity_id && person_id) {
    await linkAffiliation(tx, channel.workspace_id, entity_id, person_id);
  }

  const result: IntakeResult = {
    entity_id,
    person_id,
    deal_id: null,
    case_id: null,
    summary: null,
    summary_is_internal: false,
  };

  if (channel.intake_mode === 'case') {
    const supportCase = await tx.supportCase.create({
      data: {
        workspace_id: channel.workspace_id,
        case_number: await nextCaseNumber(tx, channel.workspace_id, numberAttempt),
        subject: subject.slice(0, 500),
        description: message,
        entity_id,
        reported_by_person_id: person_id,
        source: 'web',
        priority: channel.case_priority,
        category: channel.case_category,
        owner_user_id: channel.default_assignee_user_id,
        created_by_user_id: channel.default_assignee_user_id,
      },
    });
    result.case_id = supportCase.id;
    result.summary = `Case ${supportCase.case_number} opened for this conversation.`;
    await logOrigin(tx, channel.workspace_id, 'case', supportCase.id, channel, conversationId);
    return result;
  }

  if (channel.intake_mode === 'deal') {
    if (!entity_id) {
      // Only reachable with `auto_create_entity` off and nothing to match on.
      result.summary = 'No matching organization on file, so no deal was opened for this conversation yet.';
      result.summary_is_internal = true;
      return result;
    }
    const deal = await tx.deal.create({
      data: {
        workspace_id: channel.workspace_id,
        name: subject.slice(0, 255),
        entity_id,
        primary_contact_person_id: person_id,
        description: message,
        stage: channel.deal_stage,
        currency_code: channel.deal_currency_code,
        owner_user_id: channel.default_assignee_user_id,
        created_by_user_id: channel.default_assignee_user_id,
        next_step: 'Reply in chat',
      },
    });
    result.deal_id = deal.id;
    result.summary = `Deal "${deal.name}" opened for this conversation.`;
    result.summary_is_internal = true;
    await logOrigin(tx, channel.workspace_id, 'deal', deal.id, channel, conversationId);
  }

  return result;
}
