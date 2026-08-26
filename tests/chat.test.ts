import { beforeEach, describe, expect, it } from 'vitest';

import { GET as getChannelConfig } from '@/app/api/chat/[key]/route';
import { GET as getSession, POST as startSession } from '@/app/api/chat/[key]/sessions/route';
import { POST as requestCode } from '@/app/api/chat/[key]/auth/request-code/route';
import { POST as verifyCode } from '@/app/api/chat/[key]/auth/verify/route';
import {
  GET as listConversations,
  POST as startConversation,
} from '@/app/api/chat/[key]/conversations/route';
import {
  GET as listMessages,
  POST as postMessage,
} from '@/app/api/chat/[key]/conversations/[conversation_id]/messages/route';
import { POST as createChannel } from '@/app/api/v1/chat-channels/route';
import { POST as postAgentMessage } from '@/app/api/v1/chat-messages/route';
import { prisma } from '@/lib/prisma';

import { BASE, jsonRequest, paramsContext, resetDatabase, uuid } from './helpers';

const workspace = uuid();

beforeEach(resetDatabase);

/* -------------------------------------------------------------------------- */
/* Fixtures                                                                    */
/* -------------------------------------------------------------------------- */

let keyCounter = 0;

const makeChannel = async (overrides: Record<string, unknown> = {}) => {
  keyCounter += 1;
  const response = await createChannel(
    jsonRequest(`${BASE}/api/v1/chat-channels`, 'POST', {
      workspace_id: workspace,
      name: 'Support',
      key: `channel-${keyCounter}-${Date.now()}`,
      ...overrides,
    }),
  );
  expect(response.status).toBe(201);
  return response.json();
};

const authed = (url: string, method: string, token: string, body?: unknown) => {
  const request = jsonRequest(url, method, body);
  request.headers.set('authorization', `Bearer ${token}`);
  return request;
};

/** A guest session on a channel that does not require verification. */
const guestSession = async (key: string, input: Record<string, unknown>) => {
  const response = await startSession(
    jsonRequest(`${BASE}/api/chat/${key}/sessions`, 'POST', input),
    paramsContext({ key }),
  );
  expect(response.status).toBe(201);
  return (await response.json()).token as string;
};

const openConversation = async (key: string, token: string, body: Record<string, unknown>) => {
  const response = await startConversation(
    authed(`${BASE}/api/chat/${key}/conversations`, 'POST', token, body),
    paramsContext({ key }),
  );
  expect(response.status).toBe(201);
  return response.json();
};

/* -------------------------------------------------------------------------- */
/* Configuration                                                               */
/* -------------------------------------------------------------------------- */

describe('channel configuration', () => {
  it('exposes only the public half of a channel', async () => {
    const channel = await makeChannel({ greeting: 'Hi there', auth_mode: 'required', intake_mode: 'deal' });

    const response = await getChannelConfig(
      new Request(`${BASE}/api/chat/${channel.key}`),
      paramsContext({ key: channel.key }),
    );
    const config = await response.json();

    expect(response.status).toBe(200);
    expect(config).toMatchObject({
      name: 'Support',
      greeting: 'Hi there',
      auth_mode: 'required',
      intake_mode: 'deal',
      requires_authentication: true,
    });
    expect(config.workspace_id).toBeUndefined();
  });

  it('404s an unknown channel key', async () => {
    const response = await getChannelConfig(
      new Request(`${BASE}/api/chat/nope`),
      paramsContext({ key: 'nope' }),
    );
    expect(response.status).toBe(404);
  });

  it('turns visitors away from a disabled channel', async () => {
    const channel = await makeChannel({ is_enabled: false, offline_message: 'Back Monday.' });

    const response = await startSession(
      jsonRequest(`${BASE}/api/chat/${channel.key}/sessions`, 'POST', {
        display_name: 'Ada',
        email: 'ada@example.com',
      }),
      paramsContext({ key: channel.key }),
    );

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe('Back Monday.');
  });

  it('enforces what the channel says it collects', async () => {
    const channel = await makeChannel({ collect_email: true, collect_name: true });

    const response = await startSession(
      jsonRequest(`${BASE}/api/chat/${channel.key}/sessions`, 'POST', { display_name: 'Ada' }),
      paramsContext({ key: channel.key }),
    );

    expect(response.status).toBe(422);
  });
});

/* -------------------------------------------------------------------------- */
/* Intake: the per-instance deal/case choice                                   */
/* -------------------------------------------------------------------------- */

describe('intake', () => {
  it('opens a case, a person, and an entity for a support channel', async () => {
    const channel = await makeChannel({ intake_mode: 'case', case_priority: 'high', case_category: 'Billing' });
    const token = await guestSession(channel.key, { display_name: 'Ada Lovelace', email: 'ada@acme-widgets.com' });

    const conversation = await openConversation(channel.key, token, {
      subject: 'Invoice is wrong',
      message: 'The latest invoice charged me twice.',
    });

    const stored = await prisma.chatConversation.findFirstOrThrow({ where: { id: conversation.id } });
    expect(stored.case_id).not.toBeNull();
    expect(stored.deal_id).toBeNull();

    const supportCase = await prisma.supportCase.findFirstOrThrow({ where: { id: stored.case_id! } });
    expect(supportCase).toMatchObject({
      subject: 'Invoice is wrong',
      description: 'The latest invoice charged me twice.',
      priority: 'high',
      category: 'Billing',
      source: 'web',
    });
    expect(supportCase.case_number).toMatch(/^CASE-\d+$/);

    const person = await prisma.person.findFirstOrThrow({ where: { id: supportCase.reported_by_person_id! } });
    expect(person).toMatchObject({ first_name: 'Ada', last_name: 'Lovelace', primary_email: 'ada@acme-widgets.com' });

    const entity = await prisma.entity.findFirstOrThrow({ where: { id: supportCase.entity_id! } });
    expect(entity.primary_domain).toBe('acme-widgets.com');

    // The person is put on the organization's contact list.
    const affiliation = await prisma.entityPerson.findFirst({
      where: { entity_id: entity.id, person_id: person.id },
    });
    expect(affiliation?.relationship_type).toBe('customer_contact');
  });

  it('opens a deal for a prospecting channel', async () => {
    const channel = await makeChannel({ intake_mode: 'deal', deal_stage: 'discovery' });
    const token = await guestSession(channel.key, { display_name: 'Grace Hopper', email: 'grace@navy-systems.com' });

    const conversation = await openConversation(channel.key, token, {
      message: 'We are evaluating tools for a 200-seat rollout.',
    });

    const stored = await prisma.chatConversation.findFirstOrThrow({ where: { id: conversation.id } });
    expect(stored.deal_id).not.toBeNull();
    expect(stored.case_id).toBeNull();

    const deal = await prisma.deal.findFirstOrThrow({ where: { id: stored.deal_id! } });
    expect(deal.stage).toBe('discovery');
    expect(deal.entity_id).toBe(stored.entity_id);
    // With no subject given, the visitor's first line names the thread and the deal.
    expect(deal.name).toBe('We are evaluating tools for a 200-seat rollout.');

    // The prospect sees their own message, not the workspace's sales vocabulary.
    const visible = await listMessages(
      authed(`${BASE}/api/chat/${channel.key}/conversations/${conversation.id}/messages`, 'GET', token),
      paramsContext({ key: channel.key, conversation_id: conversation.id }),
    );
    const bodies = (await visible.json()).map((message: { body: string }) => message.body);
    expect(bodies).toEqual(['We are evaluating tools for a 200-seat rollout.']);
  });

  it('opens nothing in the CRM when the channel is set to conversation only', async () => {
    const channel = await makeChannel({ intake_mode: 'none', collect_email: false, collect_name: false });
    const token = await guestSession(channel.key, {});

    const conversation = await openConversation(channel.key, token, { message: 'Just a quick question.' });

    const stored = await prisma.chatConversation.findFirstOrThrow({ where: { id: conversation.id } });
    expect(stored.case_id).toBeNull();
    expect(stored.deal_id).toBeNull();
    expect(await prisma.person.count({ where: { workspace_id: workspace } })).toBe(0);
  });

  it('does not invent an organization from a consumer mailbox', async () => {
    const channel = await makeChannel({ intake_mode: 'case' });
    const token = await guestSession(channel.key, { display_name: 'Ada', email: 'ada@gmail.com' });

    const conversation = await openConversation(channel.key, token, { message: 'Help please.' });

    const stored = await prisma.chatConversation.findFirstOrThrow({ where: { id: conversation.id } });
    expect(stored.entity_id).toBeNull();
    expect(stored.person_id).not.toBeNull();
    expect(await prisma.entity.count({ where: { workspace_id: workspace } })).toBe(0);
  });

  it('reuses the person a returning visitor already matched', async () => {
    const channel = await makeChannel({ intake_mode: 'case' });
    const token = await guestSession(channel.key, { display_name: 'Ada', email: 'ada@acme-widgets.com' });

    const first = await openConversation(channel.key, token, { message: 'First question.' });
    const second = await openConversation(channel.key, token, { message: 'Second question.' });

    const [one, two] = await Promise.all([
      prisma.chatConversation.findFirstOrThrow({ where: { id: first.id } }),
      prisma.chatConversation.findFirstOrThrow({ where: { id: second.id } }),
    ]);

    expect(two.person_id).toBe(one.person_id);
    expect(two.entity_id).toBe(one.entity_id);
    expect(await prisma.person.count({ where: { workspace_id: workspace } })).toBe(1);
    expect(await prisma.supportCase.count({ where: { workspace_id: workspace } })).toBe(2);
  });
});

/* -------------------------------------------------------------------------- */
/* Authentication: the per-instance auth choice                                */
/* -------------------------------------------------------------------------- */

describe('authentication', () => {
  it('refuses a guest session on a channel that requires verification', async () => {
    const channel = await makeChannel({ auth_mode: 'required' });

    const response = await startSession(
      jsonRequest(`${BASE}/api/chat/${channel.key}/sessions`, 'POST', {
        display_name: 'Ada',
        email: 'ada@acme-widgets.com',
      }),
      paramsContext({ key: channel.key }),
    );

    expect(response.status).toBe(401);
  });

  it('lets a verified visitor in and keeps an unverified one out', async () => {
    const channel = await makeChannel({ auth_mode: 'required', intake_mode: 'case' });

    // Without any session at all.
    const anonymous = await listConversations(
      new Request(`${BASE}/api/chat/${channel.key}/conversations`),
      paramsContext({ key: channel.key }),
    );
    expect(anonymous.status).toBe(401);

    const sent = await requestCode(
      jsonRequest(`${BASE}/api/chat/${channel.key}/auth/request-code`, 'POST', {
        email: 'ada@acme-widgets.com',
      }),
      paramsContext({ key: channel.key }),
    );
    expect(sent.status).toBe(202);
    const { debug_code } = await sent.json();
    expect(debug_code).toMatch(/^\d{6}$/);

    const wrong = await verifyCode(
      jsonRequest(`${BASE}/api/chat/${channel.key}/auth/verify`, 'POST', {
        email: 'ada@acme-widgets.com',
        code: '000000',
      }),
      paramsContext({ key: channel.key }),
    );
    expect(wrong.status).toBe(400);

    const verified = await verifyCode(
      jsonRequest(`${BASE}/api/chat/${channel.key}/auth/verify`, 'POST', {
        email: 'ada@acme-widgets.com',
        code: debug_code,
        display_name: 'Ada Lovelace',
      }),
      paramsContext({ key: channel.key }),
    );
    expect(verified.status).toBe(201);
    const session = await verified.json();
    expect(session.is_authenticated).toBe(true);
    expect(session.contact.is_verified).toBe(true);

    const conversation = await openConversation(channel.key, session.token, { message: 'Signed-in question.' });
    expect(conversation.id).toEqual(expect.any(String));
  });

  it('burns a code once it has been used', async () => {
    const channel = await makeChannel({ auth_mode: 'optional' });
    const sent = await requestCode(
      jsonRequest(`${BASE}/api/chat/${channel.key}/auth/request-code`, 'POST', { email: 'ada@acme.com' }),
      paramsContext({ key: channel.key }),
    );
    const { debug_code } = await sent.json();

    const body = { email: 'ada@acme.com', code: debug_code };
    const first = await verifyCode(
      jsonRequest(`${BASE}/api/chat/${channel.key}/auth/verify`, 'POST', body),
      paramsContext({ key: channel.key }),
    );
    const second = await verifyCode(
      jsonRequest(`${BASE}/api/chat/${channel.key}/auth/verify`, 'POST', body),
      paramsContext({ key: channel.key }),
    );

    expect(first.status).toBe(201);
    expect(second.status).toBe(400);
  });

  it('rejects verification on a channel that does not use it', async () => {
    const channel = await makeChannel({ auth_mode: 'none' });

    const response = await requestCode(
      jsonRequest(`${BASE}/api/chat/${channel.key}/auth/request-code`, 'POST', { email: 'ada@acme.com' }),
      paramsContext({ key: channel.key }),
    );

    expect(response.status).toBe(400);
  });

  it('reports who a token belongs to', async () => {
    const channel = await makeChannel({ collect_name: true, collect_email: true });
    const token = await guestSession(channel.key, { display_name: 'Ada', email: 'ada@acme.com' });

    const response = await getSession(
      authed(`${BASE}/api/chat/${channel.key}/sessions`, 'GET', token),
      paramsContext({ key: channel.key }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      is_authenticated: false,
      contact: { display_name: 'Ada', email: 'ada@acme.com', is_verified: false },
    });
  });
});

/* -------------------------------------------------------------------------- */
/* Messaging both ways                                                         */
/* -------------------------------------------------------------------------- */

describe('messaging', () => {
  it('carries messages in both directions and hides internal notes', async () => {
    const channel = await makeChannel({ intake_mode: 'case' });
    const token = await guestSession(channel.key, { display_name: 'Ada', email: 'ada@acme-widgets.com' });
    const conversation = await openConversation(channel.key, token, { message: 'My export is empty.' });

    const agentReply = await postAgentMessage(
      jsonRequest(`${BASE}/api/v1/chat-messages`, 'POST', {
        workspace_id: workspace,
        conversation_id: conversation.id,
        body: 'Looking into it now.',
        author_name: 'Sarah',
      }),
    );
    expect(agentReply.status).toBe(201);

    const note = await postAgentMessage(
      jsonRequest(`${BASE}/api/v1/chat-messages`, 'POST', {
        workspace_id: workspace,
        conversation_id: conversation.id,
        body: 'Probably the same bug as CASE-1002.',
        is_internal: true,
      }),
    );
    expect(note.status).toBe(201);

    const visible = await listMessages(
      authed(`${BASE}/api/chat/${channel.key}/conversations/${conversation.id}/messages`, 'GET', token),
      paramsContext({ key: channel.key, conversation_id: conversation.id }),
    );
    const bodies = (await visible.json()).map((message: { body: string }) => message.body);

    expect(bodies).toContain('My export is empty.');
    expect(bodies).toContain('Looking into it now.');
    // A case number is the customer's own reference, so that system line is shown.
    expect(bodies.some((body: string) => body.startsWith('Case CASE-'))).toBe(true);
    expect(bodies).not.toContain('Probably the same bug as CASE-1002.');

    // The agent's reply moves the thread's activity timestamps.
    const stored = await prisma.chatConversation.findFirstOrThrow({ where: { id: conversation.id } });
    expect(stored.last_agent_message_at).not.toBeNull();
  });

  it('reopens a closed thread when the visitor writes again', async () => {
    const channel = await makeChannel({ intake_mode: 'none', collect_email: false, collect_name: false });
    const token = await guestSession(channel.key, {});
    const conversation = await openConversation(channel.key, token, { message: 'First.' });

    await prisma.chatConversation.update({
      where: { id: conversation.id },
      data: { status: 'closed', closed_at: new Date() },
    });

    const response = await postMessage(
      authed(
        `${BASE}/api/chat/${channel.key}/conversations/${conversation.id}/messages`,
        'POST',
        token,
        { body: 'Actually, one more thing.' },
      ),
      paramsContext({ key: channel.key, conversation_id: conversation.id }),
    );
    expect(response.status).toBe(201);

    const stored = await prisma.chatConversation.findFirstOrThrow({ where: { id: conversation.id } });
    expect(stored.status).toBe('open');
    expect(stored.closed_at).toBeNull();
  });

  it('only returns messages newer than `after`', async () => {
    const channel = await makeChannel({ intake_mode: 'none', collect_email: false, collect_name: false });
    const token = await guestSession(channel.key, {});
    const conversation = await openConversation(channel.key, token, { message: 'First.' });

    const cutoff = new Date().toISOString();
    await postMessage(
      authed(
        `${BASE}/api/chat/${channel.key}/conversations/${conversation.id}/messages`,
        'POST',
        token,
        { body: 'Second.' },
      ),
      paramsContext({ key: channel.key, conversation_id: conversation.id }),
    );

    const response = await listMessages(
      authed(
        `${BASE}/api/chat/${channel.key}/conversations/${conversation.id}/messages?after=${encodeURIComponent(cutoff)}`,
        'GET',
        token,
      ),
      paramsContext({ key: channel.key, conversation_id: conversation.id }),
    );
    const bodies = (await response.json()).map((message: { body: string }) => message.body);

    expect(bodies).toEqual(['Second.']);
  });

  it('keeps one visitor out of another visitor’s thread', async () => {
    const channel = await makeChannel({ intake_mode: 'case' });
    const adaToken = await guestSession(channel.key, { display_name: 'Ada', email: 'ada@acme-widgets.com' });
    const bobToken = await guestSession(channel.key, { display_name: 'Bob', email: 'bob@other-co.com' });

    const adaConversation = await openConversation(channel.key, adaToken, { message: 'Private matter.' });

    const response = await listMessages(
      authed(
        `${BASE}/api/chat/${channel.key}/conversations/${adaConversation.id}/messages`,
        'GET',
        bobToken,
      ),
      paramsContext({ key: channel.key, conversation_id: adaConversation.id }),
    );

    expect(response.status).toBe(404);

    const bobList = await listConversations(
      authed(`${BASE}/api/chat/${channel.key}/conversations`, 'GET', bobToken),
      paramsContext({ key: channel.key }),
    );
    expect(await bobList.json()).toEqual([]);
  });

  it('rejects a token issued for a different channel', async () => {
    const first = await makeChannel({ intake_mode: 'none', collect_email: false, collect_name: false });
    const second = await makeChannel({ intake_mode: 'none', collect_email: false, collect_name: false });
    const token = await guestSession(first.key, {});

    const response = await listConversations(
      authed(`${BASE}/api/chat/${second.key}/conversations`, 'GET', token),
      paramsContext({ key: second.key }),
    );

    expect(response.status).toBe(401);
  });

  it('refuses an agent reply into another workspace’s conversation', async () => {
    const channel = await makeChannel({ intake_mode: 'none', collect_email: false, collect_name: false });
    const token = await guestSession(channel.key, {});
    const conversation = await openConversation(channel.key, token, { message: 'Hello.' });

    const response = await postAgentMessage(
      jsonRequest(`${BASE}/api/v1/chat-messages`, 'POST', {
        workspace_id: uuid(),
        conversation_id: conversation.id,
        body: 'Should not land.',
      }),
    );

    expect(response.status).toBe(404);
  });
});
