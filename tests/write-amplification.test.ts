import { beforeEach, describe, expect, it } from 'vitest';

import { POST as startSession } from '@/app/api/chat/[key]/sessions/route';
import { POST as startConversation } from '@/app/api/chat/[key]/conversations/route';
import { GET as listMessages } from '@/app/api/chat/[key]/conversations/[conversation_id]/messages/route';
import { POST as createChannel } from '@/app/api/v1/chat-channels/route';
import { POST as postAgentMessage } from '@/app/api/v1/chat-messages/route';

import { prisma } from '@/lib/prisma';
import { ACTIVITY_STAMP_INTERVAL_MS } from '@/lib/chat/config';
import { pipelineReportJobId } from '@/worker/jobs/pipeline-report';

import { BASE, jsonRequest, paramsContext, resetDatabase, uuid } from './helpers';

/**
 * What a poll costs.
 *
 * The widget asks for new messages every few seconds. That is a read, and it
 * has to stay one: bookkeeping timestamps written on every poll turn an idle
 * conversation into the most write-heavy thing in the product.
 */

const workspace = uuid();

beforeEach(resetDatabase);

let keyCounter = 0;

async function openConversation() {
  keyCounter += 1;
  const key = `poll-${keyCounter}-${Date.now()}`;
  const channelResponse = await createChannel(
    jsonRequest(`${BASE}/api/v1/chat-channels`, 'POST', {
      workspace_id: workspace,
      name: 'Support',
      key,
      intake_mode: 'case',
    }),
  );
  const channel = await channelResponse.json();
  const context = paramsContext({ key });

  const session = await (
    await startSession(
      jsonRequest(`${BASE}/api/chat/${key}/sessions`, 'POST', {
        display_name: 'Visitor',
        email: `visitor-${keyCounter}@example.test`,
      }),
      context,
    )
  ).json();

  const conversation = await (
    await startConversation(
      new Request(`${BASE}/api/chat/${key}/conversations`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${session.token}` },
        body: JSON.stringify({ subject: 'Question', message: 'Is anyone there?' }),
      }),
      context,
    )
  ).json();

  const poll = (after?: string) =>
    listMessages(
      new Request(
        `${BASE}/api/chat/${key}/conversations/${conversation.id}/messages${after ? `?after=${after}` : ''}`,
        { headers: { authorization: `Bearer ${session.token}` } },
      ),
      paramsContext({ key, conversation_id: conversation.id }),
    );

  return { channel, key, session, conversation, poll };
}

describe('polling for new messages', () => {
  it('does not restamp activity on every poll', async () => {
    const { session, poll } = await openConversation();

    const before = (await prisma.chatSession.findFirst({ where: { contact_id: session.contact.id } }))!;
    const contactBefore = (await prisma.chatContact.findUnique({ where: { id: session.contact.id } }))!;

    for (let i = 0; i < 5; i += 1) {
      expect((await poll()).status).toBe(200);
    }

    const after = (await prisma.chatSession.findUnique({ where: { id: before.id } }))!;
    const contactAfter = (await prisma.chatContact.findUnique({ where: { id: session.contact.id } }))!;

    // Stamped once when the session was first used, then left alone.
    expect(after.last_used_at?.getTime()).toBe(before.last_used_at?.getTime());
    expect(contactAfter.last_seen_at?.getTime()).toBe(contactBefore.last_seen_at?.getTime());
  });

  it('restamps once the stamp has gone stale', async () => {
    const { session, poll } = await openConversation();
    const before = (await prisma.chatSession.findFirst({ where: { contact_id: session.contact.id } }))!;

    const stale = new Date(Date.now() - ACTIVITY_STAMP_INTERVAL_MS - 1000);
    await prisma.chatSession.update({ where: { id: before.id }, data: { last_used_at: stale } });
    await prisma.chatContact.update({ where: { id: session.contact.id }, data: { last_seen_at: stale } });

    await poll();

    const after = (await prisma.chatSession.findUnique({ where: { id: before.id } }))!;
    const contactAfter = (await prisma.chatContact.findUnique({ where: { id: session.contact.id } }))!;
    expect(after.last_used_at!.getTime()).toBeGreaterThan(stale.getTime());
    expect(contactAfter.last_seen_at!.getTime()).toBeGreaterThan(stale.getTime());
  });

  it('marks the thread read only when there was something to read', async () => {
    const { channel, conversation, poll } = await openConversation();

    // The opening poll returns the visitor's own message and marks it read.
    await poll();
    const first = (await prisma.chatConversation.findUnique({ where: { id: conversation.id } }))!;
    expect(first.contact_read_at).not.toBeNull();

    // An empty poll — nothing new since — leaves the marker where it was.
    const cursor = new Date().toISOString();
    await poll(cursor);
    const afterEmpty = (await prisma.chatConversation.findUnique({ where: { id: conversation.id } }))!;
    expect(afterEmpty.contact_read_at!.getTime()).toBe(first.contact_read_at!.getTime());

    // An agent replies, and the poll that collects it moves the marker.
    await postAgentMessage(
      jsonRequest(`${BASE}/api/v1/chat-messages`, 'POST', {
        workspace_id: workspace,
        conversation_id: conversation.id,
        channel_id: channel.id,
        author_type: 'agent',
        body: 'We are here.',
      }),
    );
    const withReply = await poll(cursor);
    expect((await withReply.json()).length).toBe(1);

    const afterReply = (await prisma.chatConversation.findUnique({ where: { id: conversation.id } }))!;
    expect(afterReply.contact_read_at!.getTime()).toBeGreaterThan(first.contact_read_at!.getTime());
  });
});

describe('pipeline report job id', () => {
  it('collapses readers inside one cache window and reruns after it', () => {
    const at = Date.parse('2026-08-29T00:00:00Z');

    // Everyone arriving while one report is warm shares a job.
    expect(pipelineReportJobId(workspace, at)).toBe(pipelineReportJobId(workspace, at + 60_000));

    // The window after the cache expires gets its own, so the report is not
    // frozen at whatever the first run produced.
    expect(pipelineReportJobId(workspace, at)).not.toBe(pipelineReportJobId(workspace, at + 400_000));
  });

  it('keeps workspaces apart', () => {
    const at = Date.parse('2026-08-29T00:00:00Z');
    expect(pipelineReportJobId(uuid(), at)).not.toBe(pipelineReportJobId(uuid(), at));
  });
});
