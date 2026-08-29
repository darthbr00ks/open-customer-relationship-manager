import { beforeEach, describe, expect, it } from 'vitest';

import { POST as createEntity } from '@/app/api/v1/entities/route';
import { POST as createDeal } from '@/app/api/v1/deals/route';
import { POST as createDealLine } from '@/app/api/v1/deal-lines/route';
import { POST as createProduct } from '@/app/api/v1/products/route';
import { POST as createOffering } from '@/app/api/v1/offerings/route';
import { POST as createPrice } from '@/app/api/v1/prices/route';
import { PUT as upsertEntity } from '@/app/api/v1/entities/[id]/route';
import { POST as quoteDeal } from '@/app/api/v1/deals/[id]/quote/route';
import { POST as acceptQuote } from '@/app/api/v1/quotes/[id]/accept/route';

import { prisma } from '@/lib/prisma';
import { discountAmount } from '@/lib/selling/pricing';
import { amendSubscription } from '@/lib/selling/subscriptions';
import { parseCsvRecordsWithRows } from '@/lib/csv';

import { BASE, jsonRequest, resetDatabase, routeContext, uuid } from './helpers';

const workspace = uuid();

beforeEach(resetDatabase);

const post = async (handler: (r: Request) => Promise<Response>, path: string, body: Record<string, unknown>) => {
  const response = await handler(jsonRequest(`${BASE}${path}`, 'POST', { workspace_id: workspace, ...body }));
  const payload = await response.json();
  if (response.status !== 201) {
    throw new Error(`${path} -> ${response.status}: ${JSON.stringify(payload)}`);
  }
  return payload;
};

/* -------------------------------------------------------------------------- */
/* One offering sold twice on the same order                                   */
/* -------------------------------------------------------------------------- */

describe('the same plan on two deal lines', () => {
  it('opens a subscription per line and gives each its own entitlements', async () => {
    const entity = await post(createEntity, '/api/v1/entities', { name: 'Acme', entity_type: 'company' });
    const product = await post(createProduct, '/api/v1/products', { name: 'Platform', status: 'active' });
    const offering = await post(createOffering, '/api/v1/offerings', {
      product_id: product.id,
      sku: 'PLAT',
      name: 'Platform',
      offering_type: 'subscription',
      unit_of_measure: 'seat',
      fulfillment_policy: 'digital_activation',
      status: 'active',
    });
    await post(createPrice, '/api/v1/prices', {
      offering_id: offering.id,
      name: 'Monthly',
      charge_type: 'recurring',
      pricing_model: 'per_unit',
      unit_amount: '50.00',
      billing_period: 'month',
    });
    // The overage charge is what used to collide: both lines produced an
    // entitlement with the same code on the same subscription.
    await post(createPrice, '/api/v1/prices', {
      offering_id: offering.id,
      name: 'API overage',
      charge_type: 'usage',
      pricing_model: 'per_unit',
      unit_amount: '0.02',
      included_quantity: '10000',
    });

    const deal = await post(createDeal, '/api/v1/deals', {
      name: 'Acme deal',
      entity_id: entity.id,
      stage: 'proposal',
      currency_code: 'USD',
    });
    // Two business units buying the same plan, with different seat counts.
    await post(createDealLine, '/api/v1/deal-lines', {
      deal_id: deal.id,
      offering_id: offering.id,
      name: 'Platform — EU',
      quantity: '10',
      sort_order: 0,
    });
    await post(createDealLine, '/api/v1/deal-lines', {
      deal_id: deal.id,
      offering_id: offering.id,
      name: 'Platform — US',
      quantity: '25',
      sort_order: 1,
    });

    const quoted = await (
      await quoteDeal(
        jsonRequest(`${BASE}/api/v1/deals/${deal.id}/quote?workspace_id=${workspace}`, 'POST', {}),
        routeContext(deal.id),
      )
    ).json();

    const response = await acceptQuote(
      jsonRequest(`${BASE}/api/v1/quotes/${quoted.quote.id}/accept?workspace_id=${workspace}`, 'POST', {}),
      routeContext(quoted.quote.id),
    );
    expect(response.status).toBe(201);

    const subscriptions = await prisma.subscription.findMany({
      where: { workspace_id: workspace },
      orderBy: { subscription_number: 'asc' },
    });
    expect(subscriptions).toHaveLength(2);
    expect(subscriptions.map((row) => String(row.quantity))).toEqual(['10', '25']);

    // Each subscription carries its own seat allowance and its own overage
    // allowance, rather than both overages landing on one of them.
    for (const subscription of subscriptions) {
      const codes = (
        await prisma.entitlement.findMany({
          where: { subscription_id: subscription.id },
          orderBy: { code: 'asc' },
        })
      ).map((row) => row.code);
      expect(codes).toEqual(['platform_api_overage', 'seat']);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Scheduled amendments                                                        */
/* -------------------------------------------------------------------------- */

describe('amending a subscription', () => {
  const makeSubscription = async () => {
    const entity = await post(createEntity, '/api/v1/entities', { name: 'Acme', entity_type: 'company' });
    return prisma.subscription.create({
      data: {
        workspace_id: workspace,
        subscription_number: 'SUB-0001',
        name: 'Platform',
        entity_id: entity.id,
        status: 'active',
        start_date: new Date('2026-08-01'),
        current_period_start: new Date('2026-08-01'),
        current_period_end: new Date('2026-08-31'),
        billing_period: 'month',
        billing_interval_count: 1,
        quantity: '10',
        unit_of_measure: 'seat',
        unit_amount: '50.00',
        currency_code: 'USD',
      },
    });
  };

  it('records a future-dated change without applying it', async () => {
    const subscription = await makeSubscription();

    const { amendment, proration, subscription: after } = await amendSubscription({
      workspace_id: workspace,
      subscription_id: subscription.id,
      amendment_type: 'quantity_change',
      quantity: '100',
      effective_date: new Date('2027-01-01'),
    });

    // The amendment says what will happen, and is marked as not yet applied.
    expect(amendment.effective_date.toISOString().slice(0, 10)).toBe('2027-01-01');
    expect(amendment.applied_at).toBeNull();
    expect(String(amendment.new_quantity)).toBe('100');

    // Nothing has changed yet, and nothing has been charged for it.
    expect(String(after.quantity)).toBe('10');
    expect(proration).toBeNull();

    const stored = (await prisma.subscription.findUnique({ where: { id: subscription.id } }))!;
    expect(String(stored.quantity)).toBe('10');
  });

  it('applies a change dated today and prorates the rest of the period', async () => {
    const subscription = await makeSubscription();

    const { amendment, proration, subscription: after } = await amendSubscription({
      workspace_id: workspace,
      subscription_id: subscription.id,
      amendment_type: 'quantity_change',
      quantity: '20',
    });

    expect(amendment.applied_at).not.toBeNull();
    expect(String(after.quantity)).toBe('20');
    expect(proration).not.toBeNull();
  });

  it('leaves the entitlement alone until a scheduled change lands', async () => {
    const subscription = await makeSubscription();
    await prisma.entitlement.create({
      data: {
        workspace_id: workspace,
        subscription_id: subscription.id,
        entity_id: subscription.entity_id,
        code: 'seat',
        name: 'Included seat',
        unit_of_measure: 'seat',
        included_quantity: '10',
      },
    });

    await amendSubscription({
      workspace_id: workspace,
      subscription_id: subscription.id,
      amendment_type: 'quantity_change',
      quantity: '100',
      effective_date: new Date('2027-01-01'),
    });

    const entitlement = (await prisma.entitlement.findFirst({ where: { subscription_id: subscription.id } }))!;
    expect(String(entitlement.included_quantity)).toBe('10');
  });
});

/* -------------------------------------------------------------------------- */
/* Error mapping                                                               */
/* -------------------------------------------------------------------------- */

describe('errors the client caused', () => {
  it('answers an unknown reference with 422, not 500', async () => {
    const entity = await post(createEntity, '/api/v1/entities', { name: 'Acme', entity_type: 'company' });
    const deal = await post(createDeal, '/api/v1/deals', {
      name: 'Acme deal',
      entity_id: entity.id,
      stage: 'proposal',
      currency_code: 'USD',
    });

    // Well-formed uuid, nothing behind it: the database is the first thing to
    // notice, and the caller should still be told it is their mistake.
    const response = await createDealLine(
      jsonRequest(`${BASE}/api/v1/deal-lines`, 'POST', {
        workspace_id: workspace,
        deal_id: deal.id,
        offering_id: uuid(),
        name: 'Ghost',
        quantity: '1',
      }),
    );
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ detail: 'A referenced record does not exist' });
  });

  it('answers a PUT aimed at another workspace with 404, not 500', async () => {
    const mine = await post(createEntity, '/api/v1/entities', { name: 'Acme', entity_type: 'company' });
    const otherWorkspace = uuid();

    const response = await upsertEntity(
      jsonRequest(`${BASE}/api/v1/entities/${mine.id}?workspace_id=${otherWorkspace}`, 'PUT', {
        name: 'Reached across the boundary',
        entity_type: 'company',
      }),
      routeContext(mine.id),
    );
    expect(response.status).toBe(404);

    // And the record is untouched.
    const stored = (await prisma.entity.findUnique({ where: { id: mine.id } }))!;
    expect(stored.name).toBe('Acme');
    expect(stored.workspace_id).toBe(workspace);
  });
});

/* -------------------------------------------------------------------------- */
/* Smaller regressions                                                         */
/* -------------------------------------------------------------------------- */

describe('csv row numbers', () => {
  it('reports the row the user will find, not the record index', () => {
    const records = parseCsvRecordsWithRows('name\nAcme\n\nBeta\n');
    expect(records.map((entry) => entry.row)).toEqual([2, 4]);
    expect(records.map((entry) => entry.values.name)).toEqual(['Acme', 'Beta']);
  });

  it('counts a quoted field spanning lines as the row it starts on', () => {
    const records = parseCsvRecordsWithRows('name,notes\nAcme,"line one\nline two"\nBeta,short');
    expect(records.map((entry) => entry.row)).toEqual([2, 3]);
  });
});

describe('percentage discounts', () => {
  it('rounds the half up rather than dropping it', () => {
    // 0.005% of 1.0000 is 0.00005, which rounds to 0.0001 at four decimals.
    expect(discountAmount('1', 'percentage', '0.005')).toBe('0.0001');
  });

  it('still never discounts past the subtotal', () => {
    expect(discountAmount('40', 'percentage', '250')).toBe('40');
    expect(discountAmount('40', 'percentage', '-10')).toBe('0');
  });
});
