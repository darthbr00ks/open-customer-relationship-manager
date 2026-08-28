import { beforeEach, describe, expect, it } from 'vitest';

import { POST as createEntity } from '@/app/api/v1/entities/route';
import { POST as createDeal } from '@/app/api/v1/deals/route';
import { POST as createDealLine } from '@/app/api/v1/deal-lines/route';
import { POST as createProduct } from '@/app/api/v1/products/route';
import { POST as createOffering } from '@/app/api/v1/offerings/route';
import { POST as createPrice } from '@/app/api/v1/prices/route';
import { POST as createPriceTier } from '@/app/api/v1/price-tiers/route';
import { POST as createBundleComponent } from '@/app/api/v1/bundle-components/route';
import { POST as createInventoryItem } from '@/app/api/v1/inventory-items/route';
import { POST as createServiceDefinition } from '@/app/api/v1/service-definitions/route';
import { GET as listQuoteLines } from '@/app/api/v1/quote-lines/route';
import { GET as listOrderLines } from '@/app/api/v1/order-lines/route';
import { GET as listSubscriptions } from '@/app/api/v1/subscriptions/route';
import { GET as listEntitlements } from '@/app/api/v1/entitlements/route';
import { GET as listServiceDeliveries } from '@/app/api/v1/service-deliveries/route';
import { GET as listInventoryItems } from '@/app/api/v1/inventory-items/route';
import { GET as listAmendments } from '@/app/api/v1/subscription-amendments/route';
import { GET as getQuoteLine } from '@/app/api/v1/quote-lines/[id]/route';
import { GET as priceOffering } from '@/app/api/v1/offerings/[id]/price/route';
import { POST as quoteDeal } from '@/app/api/v1/deals/[id]/quote/route';
import { POST as acceptQuote } from '@/app/api/v1/quotes/[id]/accept/route';
import { POST as amendSubscription } from '@/app/api/v1/subscriptions/[id]/amend/route';
import { POST as createShipment } from '@/app/api/v1/shipments/route';
import { POST as createShipmentLine } from '@/app/api/v1/shipment-lines/route';
import { POST as shipShipment } from '@/app/api/v1/shipments/[id]/ship/route';
import { POST as createUsageRecord } from '@/app/api/v1/usage-records/route';
import { GET as getOrder } from '@/app/api/v1/orders/[id]/route';

import { BASE, jsonRequest, resetDatabase, routeContext, uuid } from './helpers';

const workspace = uuid();

beforeEach(resetDatabase);

/* -------------------------------------------------------------------------- */
/* Catalog fixtures                                                            */
/* -------------------------------------------------------------------------- */

const post = async (handler: (r: Request) => Promise<Response>, path: string, body: Record<string, unknown>) => {
  const response = await handler(jsonRequest(`${BASE}${path}`, 'POST', { workspace_id: workspace, ...body }));
  const payload = await response.json();
  if (response.status !== 201) {
    throw new Error(`${path} -> ${response.status}: ${JSON.stringify(payload)}`);
  }
  return payload;
};

const list = async (handler: (r: Request) => Promise<Response>, resource: string, query = '') =>
  (await (await handler(new Request(`${BASE}/api/v1/${resource}?workspace_id=${workspace}${query}`))).json()) as Record<
    string,
    string
  >[];

const makeEntity = () =>
  post(createEntity, '/api/v1/entities', { name: 'Acme Corporation', entity_type: 'company' });

const makeProduct = (overrides: Record<string, unknown> = {}) =>
  post(createProduct, '/api/v1/products', { name: 'Relationship Management Platform', status: 'active', ...overrides });

const makeOffering = (product_id: string, overrides: Record<string, unknown>) =>
  post(createOffering, '/api/v1/offerings', { product_id, ...overrides });

const makePrice = (offering_id: string, overrides: Record<string, unknown>) =>
  post(createPrice, '/api/v1/prices', { offering_id, ...overrides });

/**
 * The catalog the spec's own example describes: a platform sold as a per-seat
 * subscription with a setup fee and usage overage, an onboarding service, and a
 * physical device.
 */
async function seedCatalog() {
  const platform = await makeProduct();
  const services = await makeProduct({ name: 'Professional Services', category: 'consulting', status: 'active' });
  const hardware = await makeProduct({ name: 'Security Device', category: 'hardware', status: 'active' });

  const plan = await makeOffering(platform.id, {
    sku: 'PLAT-PRO-MO',
    name: 'Professional Plan',
    offering_type: 'subscription',
    unit_of_measure: 'user',
    fulfillment_policy: 'digital_activation',
  });
  await makePrice(plan.id, { name: 'Setup', charge_type: 'one_time', pricing_model: 'flat', unit_amount: '1000' });
  await makePrice(plan.id, {
    name: 'Monthly',
    charge_type: 'recurring',
    pricing_model: 'per_unit',
    unit_amount: '25',
    billing_period: 'month',
  });
  await makePrice(plan.id, {
    name: 'API calls',
    charge_type: 'usage',
    pricing_model: 'per_unit',
    unit_amount: '0.02',
    included_quantity: '10000',
  });

  const onboarding = await makeOffering(services.id, {
    sku: 'SVC-ONBOARD',
    name: 'Onboarding',
    offering_type: 'service',
    unit_of_measure: 'engagement',
    fulfillment_policy: 'scheduled_work',
  });
  await makePrice(onboarding.id, { charge_type: 'one_time', pricing_model: 'flat', unit_amount: '5000' });
  await post(createServiceDefinition, '/api/v1/service-definitions', {
    offering_id: onboarding.id,
    scope_type: 'fixed',
    estimated_hours: '40',
    delivery_location: 'Remote',
    service_level_agreement: 'Kickoff within five business days.',
  });

  const device = await makeOffering(hardware.id, {
    sku: 'HW-SENSOR-1',
    name: 'Door Sensor',
    offering_type: 'good',
    unit_of_measure: 'each',
    fulfillment_policy: 'shipping',
  });
  await makePrice(device.id, { charge_type: 'one_time', pricing_model: 'per_unit', unit_amount: '120' });
  await post(createInventoryItem, '/api/v1/inventory-items', {
    offering_id: device.id,
    location_code: 'WH-1',
    quantity_on_hand: '10',
  });

  return { platform, plan, onboarding, device };
}

/* -------------------------------------------------------------------------- */
/* Catalog                                                                     */
/* -------------------------------------------------------------------------- */

describe('catalog', () => {
  it('keeps a product free of prices and prices the offering instead', async () => {
    const { plan } = await seedCatalog();

    const response = await priceOffering(
      new Request(`${BASE}/api/v1/offerings/${plan.id}/price?workspace_id=${workspace}&quantity=25`),
      routeContext(plan.id),
    );
    const quoted = await response.json();

    expect(response.status).toBe(200);
    expect(quoted.charges.map((charge: { name: string; amount: string }) => [charge.name, charge.amount])).toEqual([
      ['Setup', '1000'],
      ['Monthly', '625'],
      ['API calls', '0'],
    ]);
  });

  it('prices usage past the included allowance', async () => {
    const { plan } = await seedCatalog();

    const quoted = await (
      await priceOffering(
        new Request(`${BASE}/api/v1/offerings/${plan.id}/price?workspace_id=${workspace}&quantity=12500`),
        routeContext(plan.id),
      )
    ).json();

    const overage = quoted.charges.find((charge: { name: string }) => charge.name === 'API calls');
    expect(overage.amount).toBe('50');
    expect(overage.billable_quantity).toBe('2500');
  });

  it('prices tiers band by band', async () => {
    const product = await makeProduct({ name: 'Background Checks' });
    const offering = await makeOffering(product.id, {
      sku: 'BGC-1',
      name: 'Background Check',
      offering_type: 'service',
      unit_of_measure: 'check',
    });
    const price = await makePrice(offering.id, { charge_type: 'usage', pricing_model: 'graduated' });
    for (const tier of [
      { up_to: '100', unit_amount: '2' },
      { up_to: '500', unit_amount: '1.5' },
      { up_to: null, unit_amount: '1' },
    ]) {
      await post(createPriceTier, '/api/v1/price-tiers', { price_id: price.id, ...tier });
    }

    const quoted = await (
      await priceOffering(
        new Request(`${BASE}/api/v1/offerings/${offering.id}/price?workspace_id=${workspace}&quantity=600`),
        routeContext(offering.id),
      )
    ).json();

    // 100 x 2 + 400 x 1.50 + 100 x 1
    expect(quoted.charges[0].amount).toBe('900');
  });

  it('rejects a duplicate SKU in the same workspace', async () => {
    const product = await makeProduct();
    await makeOffering(product.id, { sku: 'DUP-1', name: 'First', offering_type: 'good' });

    const response = await createOffering(
      jsonRequest(`${BASE}/api/v1/offerings`, 'POST', {
        workspace_id: workspace,
        product_id: product.id,
        sku: 'DUP-1',
        name: 'Second',
        offering_type: 'good',
      }),
    );
    expect(response.status).toBe(409);
  });
});

/* -------------------------------------------------------------------------- */
/* Deal → Quote → Order                                                        */
/* -------------------------------------------------------------------------- */

async function seedDeal(offerings: { plan: { id: string }; onboarding: { id: string }; device: { id: string } }) {
  const entity = await makeEntity();
  const deal = await post(createDeal, '/api/v1/deals', {
    name: 'Acme platform rollout',
    entity_id: entity.id,
    stage: 'proposal',
  });

  await post(createDealLine, '/api/v1/deal-lines', {
    deal_id: deal.id,
    offering_id: offerings.plan.id,
    name: 'Professional Plan',
    quantity: '25',
    term_months: 12,
    sort_order: 0,
  });
  await post(createDealLine, '/api/v1/deal-lines', {
    deal_id: deal.id,
    offering_id: offerings.onboarding.id,
    name: 'Onboarding',
    quantity: '1',
    sort_order: 1,
  });
  await post(createDealLine, '/api/v1/deal-lines', {
    deal_id: deal.id,
    offering_id: offerings.device.id,
    name: 'Door Sensor',
    quantity: '4',
    discount_type: 'percentage',
    discount_value: '10',
    sort_order: 2,
  });

  return { entity, deal };
}

const quoteFromDeal = async (dealId: string, body: Record<string, unknown> = {}) => {
  const response = await quoteDeal(
    jsonRequest(`${BASE}/api/v1/deals/${dealId}/quote?workspace_id=${workspace}`, 'POST', body),
    routeContext(dealId),
  );
  const payload = await response.json();
  if (response.status !== 201) throw new Error(`quote -> ${response.status}: ${JSON.stringify(payload)}`);
  return payload;
};

describe('deal to quote', () => {
  it('quotes every charge on an offering as its own line', async () => {
    const catalog = await seedCatalog();
    const { deal } = await seedDeal(catalog);

    const { quote, lines } = await quoteFromDeal(deal.id);

    expect(quote.quote_number).toMatch(/^QUO-\d{4}$/);
    expect(quote.status).toBe('draft');
    expect(lines.map((line: { name: string }) => line.name)).toEqual([
      'Professional Plan — Setup',
      'Professional Plan — Monthly',
      'Professional Plan — API calls',
      'Onboarding',
      'Door Sensor',
    ]);

    const monthly = lines.find((line: { name: string }) => line.name.endsWith('Monthly'));
    // 25 seats x $25 x 12 months of the agreed term.
    expect(monthly.subtotal_amount).toBe('7500');
    expect(monthly.billing_period).toBe('month');
    expect(monthly.term_months).toBe(12);
  });

  it('carries a line discount onto the quote and into the total', async () => {
    const catalog = await seedCatalog();
    const { deal } = await seedDeal(catalog);

    const { quote, lines } = await quoteFromDeal(deal.id);
    const device = lines.find((line: { sku: string }) => line.sku === 'HW-SENSOR-1');

    expect(device.subtotal_amount).toBe('480');
    expect(device.discount_amount).toBe('48');
    expect(device.total_amount).toBe('432');

    // 1000 setup + 7500 subscription + 5000 onboarding + 480 hardware.
    expect(quote.subtotal_amount).toBe('13980');
    expect(quote.discount_amount).toBe('48');
    expect(quote.total_amount).toBe('13932');
  });

  it('snapshots the catalog so a later price change cannot rewrite the quote', async () => {
    const catalog = await seedCatalog();
    const { deal } = await seedDeal(catalog);
    const { lines } = await quoteFromDeal(deal.id);
    const monthly = lines.find((line: { name: string }) => line.name.endsWith('Monthly'));

    // The catalog moves on: the old price is closed out and a new one opens.
    await makePrice(catalog.plan.id, {
      name: 'Monthly',
      charge_type: 'recurring',
      pricing_model: 'per_unit',
      unit_amount: '30',
      billing_period: 'month',
      effective_from: new Date().toISOString().slice(0, 10),
    });

    const stored = await (
      await getQuoteLine(
        new Request(`${BASE}/api/v1/quote-lines/${monthly.id}?workspace_id=${workspace}`),
        routeContext(monthly.id),
      )
    ).json();

    expect(stored.unit_amount).toBe('25');
    expect(stored.subtotal_amount).toBe('7500');
  });

  it('uses a negotiated price on the deal line instead of the catalog', async () => {
    const catalog = await seedCatalog();
    const entity = await makeEntity();
    const deal = await post(createDeal, '/api/v1/deals', { name: 'Negotiated', entity_id: entity.id });
    await post(createDealLine, '/api/v1/deal-lines', {
      deal_id: deal.id,
      offering_id: catalog.device.id,
      name: 'Door Sensor',
      quantity: '10',
      unit_amount: '99',
    });

    const { lines } = await quoteFromDeal(deal.id);
    expect(lines).toHaveLength(1);
    expect(lines[0].unit_amount).toBe('99');
    expect(lines[0].subtotal_amount).toBe('990');
  });

  it('expands a bundle into its components', async () => {
    const catalog = await seedCatalog();
    const bundleProduct = await makeProduct({ name: 'Security Package' });
    const bundle = await makeOffering(bundleProduct.id, {
      sku: 'PKG-SECURITY',
      name: 'Security Package',
      offering_type: 'bundle',
      unit_of_measure: 'package',
    });
    await makePrice(bundle.id, { charge_type: 'one_time', pricing_model: 'per_unit', unit_amount: '5500' });

    for (const [index, child] of [catalog.device, catalog.onboarding, catalog.plan].entries()) {
      await post(createBundleComponent, '/api/v1/bundle-components', {
        parent_offering_id: bundle.id,
        child_offering_id: child.id,
        default_quantity: '1',
        sort_order: index,
      });
    }

    const entity = await makeEntity();
    const deal = await post(createDeal, '/api/v1/deals', { name: 'Bundle deal', entity_id: entity.id });
    await post(createDealLine, '/api/v1/deal-lines', {
      deal_id: deal.id,
      offering_id: bundle.id,
      name: 'Security Package',
      quantity: '2',
    });

    const { quote, lines } = await quoteFromDeal(deal.id);

    const parent = lines.find((line: { sku: string }) => line.sku === 'PKG-SECURITY');
    const children = lines.filter((line: { parent_quote_line_id: string | null }) => line.parent_quote_line_id);

    expect(parent.subtotal_amount).toBe('11000');
    expect(children.map((line: { sku: string }) => line.sku)).toEqual([
      'HW-SENSOR-1',
      'SVC-ONBOARD',
      'PLAT-PRO-MO',
    ]);
    // Components covered by the bundle price are listed, not charged again.
    expect(children.every((line: { subtotal_amount: string }) => line.subtotal_amount === '0')).toBe(true);
    expect(children[0].quantity).toBe('2');
    expect(quote.total_amount).toBe('11000');
  });

  it('refuses to quote a deal with no lines', async () => {
    const entity = await makeEntity();
    const deal = await post(createDeal, '/api/v1/deals', { name: 'Empty', entity_id: entity.id });

    const response = await quoteDeal(
      jsonRequest(`${BASE}/api/v1/deals/${deal.id}/quote?workspace_id=${workspace}`, 'POST', {}),
      routeContext(deal.id),
    );
    expect(response.status).toBe(422);
    expect((await response.json()).detail).toBe('Deal has no lines to quote');
  });
});

/* -------------------------------------------------------------------------- */
/* Accepting a quote                                                           */
/* -------------------------------------------------------------------------- */

const accept = async (quoteId: string, body: Record<string, unknown> = {}) => {
  const response = await acceptQuote(
    jsonRequest(`${BASE}/api/v1/quotes/${quoteId}/accept?workspace_id=${workspace}`, 'POST', body),
    routeContext(quoteId),
  );
  const payload = await response.json();
  return { status: response.status, payload };
};

async function sellEverything() {
  const catalog = await seedCatalog();
  const { deal, entity } = await seedDeal(catalog);
  const { quote } = await quoteFromDeal(deal.id);
  const { status, payload } = await accept(quote.id, { purchase_order_number: 'PO-99' });
  if (status !== 201) throw new Error(`accept -> ${status}: ${JSON.stringify(payload)}`);
  return { catalog, entity, deal, quote, ...payload };
}

describe('quote to order', () => {
  it('opens an order carrying the accepted quote verbatim', async () => {
    const { quote, order } = await sellEverything();

    expect(order.order_number).toMatch(/^ORD-\d{4}$/);
    expect(order.status).toBe('open');
    expect(order.quote_id).toBe(quote.id);
    expect(order.purchase_order_number).toBe('PO-99');
    expect(order.total_amount).toBe(quote.total_amount);
    // Paid and shipped are separate questions, and neither has happened yet.
    expect(order.fulfillment_status).toBe('not_started');
    expect(order.billing_status).toBe('not_invoiced');

    const orderLines = await list(listOrderLines, 'order-lines', `&order_id=${order.id}`);
    const quoteLines = await list(listQuoteLines, 'quote-lines', `&quote_id=${quote.id}`);
    expect(orderLines.map((line) => [line.name, line.total_amount])).toEqual(
      quoteLines.map((line) => [line.name, line.total_amount]),
    );
  });

  it('starts a subscription with the entitlements it grants', async () => {
    const { order, entity } = await sellEverything();

    const subscriptions = await list(listSubscriptions, 'subscriptions', `&order_id=${order.id}`);
    expect(subscriptions).toHaveLength(1);

    const [subscription] = subscriptions;
    expect(subscription!.subscription_number).toMatch(/^SUB-\d{4}$/);
    expect(subscription!.status).toBe('active');
    expect(subscription!.entity_id).toBe(entity.id);
    expect(subscription!.quantity).toBe('25');
    expect(subscription!.unit_amount).toBe('25');
    expect(subscription!.billing_period).toBe('month');
    expect(subscription!.current_period_start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(subscription!.current_period_end).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const entitlements = await list(listEntitlements, 'entitlements', `&subscription_id=${subscription!.id}`);
    expect(entitlements.map((row) => [row.code, row.included_quantity])).toEqual([
      ['user', '25'],
      ['professional_plan_api_calls', '10000'],
    ]);
    expect(entitlements[1]!.overage_unit_amount).toBe('0.02');
  });

  it('opens a service delivery from the offering service definition', async () => {
    const { order } = await sellEverything();

    const deliveries = await list(listServiceDeliveries, 'service-deliveries', `&order_id=${order.id}`);
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0]!.delivery_number).toMatch(/^SVC-\d{4}$/);
    expect(deliveries[0]!.status).toBe('not_started');
    expect(deliveries[0]!.estimated_hours).toBe('40');
    expect(deliveries[0]!.service_level_agreement).toBe('Kickoff within five business days.');
  });

  it('reserves stock for a physical line without shipping it', async () => {
    const { catalog } = await sellEverything();

    const [item] = await list(listInventoryItems, 'inventory-items', `&offering_id=${catalog.device.id}`);
    expect(item!.quantity_on_hand).toBe('10');
    expect(item!.quantity_reserved).toBe('4');
  });

  it('refuses to accept the same quote twice', async () => {
    const { quote } = await sellEverything();

    const second = await accept(quote.id);
    expect(second.status).toBe(409);
    expect(second.payload.detail).toBe('Quote has already been accepted');
  });
});

/* -------------------------------------------------------------------------- */
/* Fulfillment                                                                 */
/* -------------------------------------------------------------------------- */

describe('shipping', () => {
  it('moves stock and the order fulfillment status, leaving billing alone', async () => {
    const { catalog, order, lines } = await sellEverything();
    const deviceLine = lines.find((line: { sku: string }) => line.sku === 'HW-SENSOR-1');

    const shipment = await post(createShipment, '/api/v1/shipments', {
      order_id: order.id,
      shipment_number: 'SHP-0001',
      carrier: 'UPS',
      tracking_number: '1Z999',
      ship_from_location_code: 'WH-1',
    });
    // A partial shipment: two of the four sensors are on the truck.
    await post(createShipmentLine, '/api/v1/shipment-lines', {
      shipment_id: shipment.id,
      order_line_id: deviceLine.id,
      quantity: '2',
      backordered_quantity: '2',
    });

    const shipped = await shipShipment(
      jsonRequest(`${BASE}/api/v1/shipments/${shipment.id}/ship?workspace_id=${workspace}`, 'POST'),
      routeContext(shipment.id),
    );
    const result = await shipped.json();

    expect(shipped.status).toBe(200);
    expect(result.shipment.status).toBe('shipped');
    expect(result.order.fulfillment_status).toBe('partially_fulfilled');
    expect(result.order.billing_status).toBe('not_invoiced');

    const [item] = await list(listInventoryItems, 'inventory-items', `&offering_id=${catalog.device.id}`);
    expect(item!.quantity_on_hand).toBe('8');
    expect(item!.quantity_reserved).toBe('2');

    const orderLines = await list(listOrderLines, 'order-lines', `&order_id=${order.id}`);
    const device = orderLines.find((line) => line.sku === 'HW-SENSOR-1');
    expect(device!.quantity_fulfilled).toBe('2');
    expect(device!.fulfillment_status).toBe('partially_fulfilled');
  });

  it('completes fulfillment once the whole line has gone', async () => {
    const { order, lines } = await sellEverything();
    const deviceLine = lines.find((line: { sku: string }) => line.sku === 'HW-SENSOR-1');

    const shipment = await post(createShipment, '/api/v1/shipments', {
      order_id: order.id,
      shipment_number: 'SHP-0002',
      ship_from_location_code: 'WH-1',
    });
    await post(createShipmentLine, '/api/v1/shipment-lines', {
      shipment_id: shipment.id,
      order_line_id: deviceLine.id,
      quantity: '4',
    });
    await shipShipment(
      jsonRequest(`${BASE}/api/v1/shipments/${shipment.id}/ship?workspace_id=${workspace}`, 'POST'),
      routeContext(shipment.id),
    );

    const stored = await (
      await getOrder(new Request(`${BASE}/api/v1/orders/${order.id}?workspace_id=${workspace}`), routeContext(order.id))
    ).json();
    expect(stored.fulfillment_status).toBe('fulfilled');
  });

  it('refuses to ship a shipment twice', async () => {
    const { order, lines } = await sellEverything();
    const deviceLine = lines.find((line: { sku: string }) => line.sku === 'HW-SENSOR-1');

    const shipment = await post(createShipment, '/api/v1/shipments', {
      order_id: order.id,
      shipment_number: 'SHP-0003',
    });
    await post(createShipmentLine, '/api/v1/shipment-lines', {
      shipment_id: shipment.id,
      order_line_id: deviceLine.id,
      quantity: '1',
    });
    await shipShipment(
      jsonRequest(`${BASE}/api/v1/shipments/${shipment.id}/ship?workspace_id=${workspace}`, 'POST'),
      routeContext(shipment.id),
    );

    const again = await shipShipment(
      jsonRequest(`${BASE}/api/v1/shipments/${shipment.id}/ship?workspace_id=${workspace}`, 'POST'),
      routeContext(shipment.id),
    );
    expect(again.status).toBe(409);
  });
});

/* -------------------------------------------------------------------------- */
/* Subscriptions                                                               */
/* -------------------------------------------------------------------------- */

const amend = async (subscriptionId: string, body: Record<string, unknown>) => {
  const response = await amendSubscription(
    jsonRequest(`${BASE}/api/v1/subscriptions/${subscriptionId}/amend?workspace_id=${workspace}`, 'POST', body),
    routeContext(subscriptionId),
  );
  return { status: response.status, payload: await response.json() };
};

async function sellSubscription() {
  const { order } = await sellEverything();
  const [subscription] = await list(listSubscriptions, 'subscriptions', `&order_id=${order.id}`);
  return subscription!;
}

describe('subscription amendments', () => {
  it('adds seats, prorates the remainder, and keeps the original agreement', async () => {
    const subscription = await sellSubscription();

    const { status, payload } = await amend(subscription.id, {
      amendment_type: 'quantity_change',
      quantity: '40',
      effective_date: subscription.current_period_start,
      reason: 'Two new teams onboarded',
    });

    expect(status).toBe(200);
    expect(payload.subscription.quantity).toBe('40');
    // The change lands on the first day of the period, so the whole period is
    // repriced: 15 extra seats x $25.
    expect(payload.amendment.proration_amount).toBe('375');
    expect(payload.amendment.previous_quantity).toBe('25');
    expect(payload.amendment.new_quantity).toBe('40');
    expect(payload.amendment.amendment_type).toBe('quantity_change');
    expect(payload.amendment.reason).toBe('Two new teams onboarded');

    const entitlements = await list(listEntitlements, 'entitlements', `&subscription_id=${subscription.id}`);
    expect(entitlements[0]!.included_quantity).toBe('40');
  });

  it('records every amendment rather than overwriting the subscription', async () => {
    const subscription = await sellSubscription();

    await amend(subscription.id, { amendment_type: 'quantity_change', quantity: '30' });
    await amend(subscription.id, { amendment_type: 'price_change', unit_amount: '22' });
    await amend(subscription.id, { amendment_type: 'billing_frequency_change', billing_period: 'year' });

    const history = await list(listAmendments, 'subscription-amendments', `&subscription_id=${subscription.id}`);
    expect(history.map((row) => row.amendment_type)).toEqual([
      'billing_frequency_change',
      'price_change',
      'quantity_change',
    ]);
    // The first amendment still says what the subscription used to be.
    expect(history[2]!.previous_quantity).toBe('25');
    expect(history[1]!.previous_unit_amount).toBe('25');
    expect(history[0]!.previous_billing_period).toBe('month');
    expect(history[0]!.new_billing_period).toBe('year');
  });

  it('cancels at period end without stopping service early', async () => {
    const subscription = await sellSubscription();

    const { payload } = await amend(subscription.id, { amendment_type: 'cancel', at_period_end: true });

    expect(payload.subscription.status).toBe('active');
    expect(payload.subscription.canceled_at).toEqual(expect.any(String));
    expect(payload.subscription.cancellation_effective_date).toBe(subscription.current_period_end);
  });

  it('cancels immediately when asked to', async () => {
    const subscription = await sellSubscription();

    const { payload } = await amend(subscription.id, { amendment_type: 'cancel' });
    expect(payload.subscription.status).toBe('canceled');
  });

  it('advances the period on renewal', async () => {
    const subscription = await sellSubscription();

    const { payload } = await amend(subscription.id, { amendment_type: 'renewal' });
    expect(payload.subscription.current_period_start > subscription.current_period_end!).toBe(true);
    expect(payload.amendment.proration_amount).toBeNull();
  });

  it('rejects a quantity change with no quantity', async () => {
    const subscription = await sellSubscription();

    const { status, payload } = await amend(subscription.id, { amendment_type: 'quantity_change' });
    expect(status).toBe(422);
    expect(payload.detail).toBe('quantity is required for a quantity change');
  });

  it('refuses to resume a subscription that is not paused', async () => {
    const subscription = await sellSubscription();

    const { status } = await amend(subscription.id, { amendment_type: 'resume' });
    expect(status).toBe(409);
  });
});

/* -------------------------------------------------------------------------- */
/* Usage                                                                       */
/* -------------------------------------------------------------------------- */

describe('usage', () => {
  it('rolls a usage event onto the entitlement it consumes', async () => {
    const subscription = await sellSubscription();
    const entitlements = await list(listEntitlements, 'entitlements', `&subscription_id=${subscription.id}`);
    const apiCalls = entitlements.find((row) => row.code === 'professional_plan_api_calls')!;

    for (const quantity of ['4000', '3500']) {
      await post(createUsageRecord, '/api/v1/usage-records', {
        entity_id: subscription.entity_id,
        entitlement_id: apiCalls.id,
        metric_code: 'api_calls',
        quantity,
        unit_of_measure: 'call',
      });
    }

    const [updated] = await list(listEntitlements, 'entitlements', `&subscription_id=${subscription.id}`).then((rows) =>
      rows.filter((row) => row.id === apiCalls.id),
    );
    expect(updated!.used_quantity).toBe('7500');
    // Still inside the 10,000 the plan includes.
    expect(updated!.included_quantity).toBe('10000');
  });

  it('defaults the subscription from the entitlement being metered', async () => {
    const subscription = await sellSubscription();
    const entitlements = await list(listEntitlements, 'entitlements', `&subscription_id=${subscription.id}`);
    const apiCalls = entitlements.find((row) => row.code === 'professional_plan_api_calls')!;

    const record = await post(createUsageRecord, '/api/v1/usage-records', {
      entity_id: subscription.entity_id,
      entitlement_id: apiCalls.id,
      metric_code: 'api_calls',
      quantity: '10',
    });

    expect(record.subscription_id).toBe(subscription.id);
  });

  it('404s on a usage event for an entitlement in another workspace', async () => {
    const response = await createUsageRecord(
      jsonRequest(`${BASE}/api/v1/usage-records`, 'POST', {
        workspace_id: workspace,
        entity_id: uuid(),
        entitlement_id: uuid(),
        metric_code: 'api_calls',
        quantity: '1',
      }),
    );
    expect(response.status).toBe(404);
  });
});
