import { beforeEach, describe, expect, it } from 'vitest';

import { processInboundEmail } from '@/lib/email/inbound';
import { prisma } from '@/lib/prisma';

import { resetDatabase, uuid } from './helpers';

const workspace = uuid();

function inbound(overrides: Record<string, unknown> = {}) {
  return {
    workspace_id: workspace,
    provider: 'test-provider',
    external_message_id: `<${uuid()}@example.test>`,
    from_address: 'jane@acme.test',
    to_addresses: ['support@open-rm.test'],
    cc_addresses: [],
    subject: 'Unable to process payroll',
    text_body: 'Payroll fails with an error.',
    received_at: new Date(),
    ...overrides,
  };
}

describe('inbound email automation', () => {
  beforeEach(resetDatabase);

  it('creates one Case for a net-new managed-alias conversation', async () => {
    const alias = await prisma.emailAlias.create({
      data: { workspace_id: workspace, email_address: 'support@open-rm.test' },
    });
    await prisma.emailAutomationPolicy.create({
      data: {
        workspace_id: workspace,
        scope_type: 'alias',
        alias_id: alias.id,
        enabled: true,
        record_type: 'case',
      },
    });

    const result = await processInboundEmail(inbound({ received_alias_id: alias.id }));

    expect(result.duplicate).toBe(false);
    expect(result.related_record_type).toBe('case');
    expect(await prisma.supportCase.count({ where: { workspace_id: workspace } })).toBe(1);
    const message = await prisma.emailMessage.findUniqueOrThrow({ where: { id: result.message_id } });
    expect(message.thread_id).toBe(result.thread_id);
    expect(message.related_record_id).toBe(result.related_record_id);
  });

  it('uses In-Reply-To to attach a reply without creating another Case', async () => {
    const alias = await prisma.emailAlias.create({
      data: { workspace_id: workspace, email_address: 'support@open-rm.test' },
    });
    await prisma.emailAutomationPolicy.create({
      data: {
        workspace_id: workspace,
        scope_type: 'alias',
        alias_id: alias.id,
        enabled: true,
        record_type: 'case',
      },
    });
    const firstMessageId = '<first@example.test>';
    const first = await processInboundEmail(
      inbound({ external_message_id: firstMessageId, received_alias_id: alias.id }),
    );
    const reply = await processInboundEmail(
      inbound({
        external_message_id: '<reply@example.test>',
        in_reply_to: firstMessageId,
        received_alias_id: alias.id,
      }),
    );

    expect(reply.thread_id).toBe(first.thread_id);
    expect(reply.related_record_id).toBe(first.related_record_id);
    expect(await prisma.supportCase.count({ where: { workspace_id: workspace } })).toBe(1);
  });

  it('treats provider plus Message-ID as an idempotency key', async () => {
    const input = inbound({ external_message_id: '<retry@example.test>' });
    const first = await processInboundEmail(input);
    const retry = await processInboundEmail(input);

    expect(retry.duplicate).toBe(true);
    expect(retry.message_id).toBe(first.message_id);
    expect(await prisma.emailMessage.count({ where: { workspace_id: workspace } })).toBe(1);
  });

  it('prefers a direct user override over its profile policy', async () => {
    const userId = uuid();
    const profileId = uuid();
    await prisma.emailAutomationPolicy.createMany({
      data: [
        {
          workspace_id: workspace,
          scope_type: 'profile',
          profile_id: profileId,
          enabled: true,
          record_type: 'case',
        },
        {
          workspace_id: workspace,
          scope_type: 'user',
          user_id: userId,
          enabled: false,
          record_type: 'none',
        },
      ],
    });

    const result = await processInboundEmail(
      inbound({
        to_addresses: ['alex@open-rm.test'],
        received_user_id: userId,
        received_profile_id: profileId,
      }),
    );

    expect(result.related_record_type).toBe('none');
    expect(await prisma.supportCase.count({ where: { workspace_id: workspace } })).toBe(0);
    expect(await prisma.emailMessage.count({ where: { workspace_id: workspace } })).toBe(1);
  });
});
