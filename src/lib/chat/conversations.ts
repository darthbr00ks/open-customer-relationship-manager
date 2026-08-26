import type { ChatChannel, ChatContact, ChatConversation, ChatMessage } from '@prisma/client';

import { isUniqueViolation } from '@/lib/api/resource';
import { prisma } from '@/lib/prisma';

import { contactLabel } from './contacts';
import { runIntake } from './intake';

/**
 * Conversation and message writes, shared by the customer endpoints under
 * `/api/chat/*` and the agent endpoints under `/api/v1/*` so both sides
 * maintain the same invariants: one thread carries one set of CRM links, the
 * inbox ordering column always moves with the newest message, and a reply to a
 * closed thread reopens it.
 */

/** A subject for a thread the visitor did not name: their first line, trimmed. */
export function deriveSubject(message: string): string {
  const firstLine = message.trim().split('\n')[0]?.trim() ?? '';
  if (!firstLine) return 'New chat conversation';
  return firstLine.length > 80 ? `${firstLine.slice(0, 77)}…` : firstLine;
}

/**
 * Open a conversation, run the channel's intake, and record the visitor's
 * first message — all in one transaction, so a workspace never ends up with a
 * Case whose thread is missing or a thread whose Case never got created.
 *
 * Generated case numbers can collide under concurrency; the unique index
 * catches that and the whole transaction is retried with the next number.
 */
export async function startConversation(
  channel: ChatChannel,
  contact: ChatContact,
  { subject, message }: { subject?: string | null; message: string },
): Promise<ChatConversation> {
  const finalSubject = subject?.trim() ? subject.trim() : deriveSubject(message);

  for (let attempt = 0; ; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const now = new Date();
        const conversation = await tx.chatConversation.create({
          data: {
            workspace_id: channel.workspace_id,
            channel_id: channel.id,
            contact_id: contact.id,
            subject: finalSubject.slice(0, 500),
            assigned_user_id: channel.default_assignee_user_id,
            last_message_at: now,
            last_contact_message_at: now,
            contact_read_at: now,
          },
        });

        const intake = await runIntake(
          tx,
          { channel, contact, subject: finalSubject, message, numberAttempt: attempt },
          conversation.id,
        );

        await tx.chatMessage.create({
          data: {
            workspace_id: channel.workspace_id,
            conversation_id: conversation.id,
            author_type: 'contact',
            author_contact_id: contact.id,
            author_name: contactLabel(contact),
            body: message,
          },
        });

        if (intake.summary) {
          await tx.chatMessage.create({
            data: {
              workspace_id: channel.workspace_id,
              conversation_id: conversation.id,
              author_type: 'system',
              body: intake.summary,
              is_internal: intake.summary_is_internal,
            },
          });
        }

        // Remember what intake matched so the visitor's next conversation
        // reuses the same Person and Entity instead of matching again.
        if (intake.person_id || intake.entity_id) {
          await tx.chatContact.update({
            where: { id: contact.id },
            data: {
              person_id: contact.person_id ?? intake.person_id,
              entity_id: contact.entity_id ?? intake.entity_id,
            },
          });
        }

        return tx.chatConversation.update({
          where: { id: conversation.id },
          data: {
            entity_id: intake.entity_id,
            person_id: intake.person_id,
            deal_id: intake.deal_id,
            case_id: intake.case_id,
          },
        });
      });
    } catch (error) {
      if (isUniqueViolation(error) && attempt < 4) continue;
      throw error;
    }
  }
}

/** Append the visitor's message, reopening the thread if support had closed it. */
export async function addContactMessage(
  conversation: ChatConversation,
  contact: ChatContact,
  body: string,
): Promise<ChatMessage> {
  const now = new Date();

  const [message] = await prisma.$transaction([
    prisma.chatMessage.create({
      data: {
        workspace_id: conversation.workspace_id,
        conversation_id: conversation.id,
        author_type: 'contact',
        author_contact_id: contact.id,
        author_name: contactLabel(contact),
        body,
      },
    }),
    prisma.chatConversation.update({
      where: { id: conversation.id },
      data: {
        last_message_at: now,
        last_contact_message_at: now,
        contact_read_at: now,
        status: conversation.status === 'closed' ? 'open' : conversation.status,
        closed_at: conversation.status === 'closed' ? null : conversation.closed_at,
      },
    }),
  ]);

  return message;
}

/**
 * Append a message from the CRM side. An internal note keeps the thread fresh
 * in the inbox but is never shown to the visitor and does not count as a reply.
 */
export async function addAgentMessage(
  conversation: ChatConversation,
  {
    body,
    author_user_id,
    author_name,
    is_internal = false,
  }: { body: string; author_user_id?: string | null; author_name?: string | null; is_internal?: boolean },
): Promise<ChatMessage> {
  const now = new Date();

  const [message] = await prisma.$transaction([
    prisma.chatMessage.create({
      data: {
        workspace_id: conversation.workspace_id,
        conversation_id: conversation.id,
        author_type: 'user',
        author_user_id: author_user_id ?? null,
        author_name: author_name ?? null,
        body,
        is_internal,
      },
    }),
    prisma.chatConversation.update({
      where: { id: conversation.id },
      data: {
        last_message_at: now,
        agent_read_at: now,
        ...(is_internal ? {} : { last_agent_message_at: now }),
      },
    }),
  ]);

  return message;
}

/* -------------------------------------------------------------------------- */
/* Serialization                                                               */
/* -------------------------------------------------------------------------- */

const iso = (value: Date | null) => (value ? value.toISOString() : null);

/**
 * The message shape the visitor's browser sees. Internal notes never reach it.
 *
 * An agent's reply falls back to a generic "Support" rather than exposing a
 * CRM user id; a system line is nobody's, so it keeps no author at all.
 */
export function publicMessage(message: ChatMessage) {
  const author =
    message.author_type === 'user' ? message.author_name ?? 'Support' : message.author_name;

  return {
    id: message.id,
    conversation_id: message.conversation_id,
    author_type: message.author_type,
    author_name: message.author_type === 'system' ? null : author,
    body: message.body,
    created_at: message.created_at.toISOString(),
  };
}

/** The conversation shape the visitor's browser sees: no CRM ids, no assignment. */
export function publicConversation(conversation: ChatConversation, lastMessage?: ChatMessage | null) {
  return {
    id: conversation.id,
    subject: conversation.subject,
    status: conversation.status,
    created_at: conversation.created_at.toISOString(),
    last_message_at: conversation.last_message_at.toISOString(),
    last_message_preview: lastMessage ? lastMessage.body.slice(0, 140) : null,
    /** Lets the widget badge threads the workspace has replied to since the visitor last looked. */
    has_unread: Boolean(
      conversation.last_agent_message_at &&
        (!conversation.contact_read_at || conversation.last_agent_message_at > conversation.contact_read_at),
    ),
  };
}

/** The full row, for the agent inbox. */
export function agentConversation(conversation: ChatConversation) {
  return {
    ...conversation,
    created_at: conversation.created_at.toISOString(),
    updated_at: conversation.updated_at.toISOString(),
    last_message_at: conversation.last_message_at.toISOString(),
    last_contact_message_at: iso(conversation.last_contact_message_at),
    last_agent_message_at: iso(conversation.last_agent_message_at),
    agent_read_at: iso(conversation.agent_read_at),
    contact_read_at: iso(conversation.contact_read_at),
    closed_at: iso(conversation.closed_at),
  };
}

export function agentMessage(message: ChatMessage) {
  return { ...message, created_at: message.created_at.toISOString() };
}
