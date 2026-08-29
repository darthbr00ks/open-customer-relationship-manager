import { beforeEach, describe, expect, it } from 'vitest';

import { POST as createEntity } from '@/app/api/v1/entities/route';
import { POST as createDeal } from '@/app/api/v1/deals/route';
import { POST as createDealLine } from '@/app/api/v1/deal-lines/route';
import { POST as createProduct } from '@/app/api/v1/products/route';
import { POST as createOffering } from '@/app/api/v1/offerings/route';
import { POST as createPrice } from '@/app/api/v1/prices/route';
import { POST as createInventoryItem } from '@/app/api/v1/inventory-items/route';
import { POST as createShipment } from '@/app/api/v1/shipments/route';
import { POST as createShipmentLine } from '@/app/api/v1/shipment-lines/route';
import { POST as quoteDeal } from '@/app/api/v1/deals/[id]/quote/route';
import { POST as acceptQuote } from '@/app/api/v1/quotes/[id]/accept/route';
import { POST as shipShipment } from '@/app/api/v1/shipments/[id]/ship/route';

import { prisma } from '@/lib/prisma';
import { reserveInventory } from '@/lib/selling/flow';

import { BASE, jsonRequest, resetDatabase, routeContext, uuid } from './helpers';

/**
 * Two callers arriving at once.
 *
 * Every step in the flow that turns one commercial event into records — a quote
 * into an order, a shipment into stock movements — has to happen once even when
 * it is asked for twice. A double-click is enough to ask twice.
 */

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

/** A deal with one per-seat subscription line, quoted and ready to accept. */
async function quotedSubscription() {
  const entity = await post(createEntity, '/api/v1/entities', { name: 'Acme', entity_type: 'company' });
  const product = await post(createProduct, '/api/v1/products', { name: 'Platform', status: 'active' });
  const offering = await post(createOffering, '/api/v1/offerings', {
    product_id: product.id,
    sku: 'PLAT-SUB',
    name: 'Platform subscription',
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

  const deal = await post(createDeal, '/api/v1/deals', {
    name: 'Acme deal',
    entity_id: entity.id,
    stage: 'proposal',
    currency_code: 'USD',
  });
  await post(createDealLine, '/api/v1/deal-lines', {
    deal_id: deal.id,
    offering_id: offering.id,
    name: 'Platform',
    quantity: '10',
  });

  const quoted = await (
    await quoteDeal(
      jsonRequest(`${BASE}/api/v1/deals/${deal.id}/quote?workspace_id=${workspace}`, 'POST', {}),
      routeContext(deal.id),
    )
  ).json();

  return { entity, offering, quote: quoted.quote };
}

describe('accepting a quote twice at once', () => {
  it('opens exactly one order and provisions once', async () => {
    const { quote } = await quotedSubscription();
    const url = `${BASE}/api/v1/quotes/${quote.id}/accept?workspace_id=${workspace}`;

    const responses = await Promise.all([
      acceptQuote(jsonRequest(url, 'POST', {}), routeContext(quote.id)),
      acceptQuote(jsonRequest(url, 'POST', {}), routeContext(quote.id)),
    ]);
    const statuses = responses.map((response) => response.status).sort();

    // One wins, the other is told the quote is spoken for.
    expect(statuses).toEqual([201, 409]);

    expect(await prisma.order.count({ where: { quote_id: quote.id } })).toBe(1);
    expect(await prisma.subscription.count({ where: { workspace_id: workspace } })).toBe(1);
    expect(await prisma.entitlement.count({ where: { workspace_id: workspace } })).toBe(1);
  });

  it('leaves nothing behind from the losing attempt', async () => {
    const { quote } = await quotedSubscription();
    const url = `${BASE}/api/v1/quotes/${quote.id}/accept?workspace_id=${workspace}`;

    await Promise.all([
      acceptQuote(jsonRequest(url, 'POST', {}), routeContext(quote.id)),
      acceptQuote(jsonRequest(url, 'POST', {}), routeContext(quote.id)),
    ]);

    const orders = await prisma.order.findMany({ where: { workspace_id: workspace } });
    expect(orders).toHaveLength(1);
    // Order lines belong to the one order that survived.
    const lines = await prisma.orderLine.findMany({ where: { workspace_id: workspace } });
    expect(lines.every((line) => line.order_id === orders[0]!.id)).toBe(true);
  });

  it('still refuses a second accept made later', async () => {
    const { quote } = await quotedSubscription();
    const url = `${BASE}/api/v1/quotes/${quote.id}/accept?workspace_id=${workspace}`;

    expect((await acceptQuote(jsonRequest(url, 'POST', {}), routeContext(quote.id))).status).toBe(201);
    const second = await acceptQuote(jsonRequest(url, 'POST', {}), routeContext(quote.id));
    expect(second.status).toBe(409);
  });
});

describe('reserving stock concurrently', () => {
  it('does not hand the same units to two orders', async () => {
    const product = await post(createProduct, '/api/v1/products', { name: 'Widget', status: 'active' });
    const offering = await post(createOffering, '/api/v1/offerings', {
      product_id: product.id,
      sku: 'WIDGET',
      name: 'Widget',
      offering_type: 'good',
      unit_of_measure: 'unit',
      fulfillment_policy: 'shipping',
      status: 'active',
    });
    await post(createInventoryItem, '/api/v1/inventory-items', {
      offering_id: offering.id,
      location_code: 'MAIN',
      quantity_on_hand: '10',
      quantity_reserved: '0',
      status: 'available',
    });

    const [first, second] = await Promise.all([
      prisma.$transaction((tx) => reserveInventory(tx, workspace, offering.id, '6'), { timeout: 20000 }),
      prisma.$transaction((tx) => reserveInventory(tx, workspace, offering.id, '6'), { timeout: 20000 }),
    ]);

    const item = (await prisma.inventoryItem.findFirst({ where: { offering_id: offering.id } }))!;
    // Ten on hand and twelve asked for: everything is held, and the two units
    // that could not be are reported as a shortfall by whichever ran second.
    expect(Number(item.quantity_reserved)).toBe(10);
    expect(Number(first.reserved) + Number(second.reserved)).toBe(10);
    expect(Number(first.shortfall) + Number(second.shortfall)).toBe(2);
  });

  it('reserves what it can and reports the rest as a backorder', async () => {
    const product = await post(createProduct, '/api/v1/products', { name: 'Widget', status: 'active' });
    const offering = await post(createOffering, '/api/v1/offerings', {
      product_id: product.id,
      sku: 'WIDGET-2',
      name: 'Widget',
      offering_type: 'good',
      unit_of_measure: 'unit',
      fulfillment_policy: 'shipping',
      status: 'active',
    });
    await post(createInventoryItem, '/api/v1/inventory-items', {
      offering_id: offering.id,
      location_code: 'MAIN',
      quantity_on_hand: '3',
      status: 'available',
    });

    const result = await prisma.$transaction((tx) => reserveInventory(tx, workspace, offering.id, '5'));
    expect(result).toEqual({ reserved: '3', shortfall: '2' });
  });
});

describe('shipping the same shipment twice', () => {
  it('takes the stock once', async () => {
    const entity = await post(createEntity, '/api/v1/entities', { name: 'Acme', entity_type: 'company' });
    const product = await post(createProduct, '/api/v1/products', { name: 'Widget', status: 'active' });
    const offering = await post(createOffering, '/api/v1/offerings', {
      product_id: product.id,
      sku: 'WIDGET-3',
      name: 'Widget',
      offering_type: 'good',
      unit_of_measure: 'unit',
      fulfillment_policy: 'shipping',
      status: 'active',
    });
    await post(createPrice, '/api/v1/prices', {
      offering_id: offering.id,
      charge_type: 'one_time',
      pricing_model: 'per_unit',
      unit_amount: '120',
    });
    await post(createInventoryItem, '/api/v1/inventory-items', {
      offering_id: offering.id,
      location_code: 'WH-1',
      quantity_on_hand: '10',
      status: 'available',
    });

    const deal = await post(createDeal, '/api/v1/deals', {
      name: 'Hardware deal',
      entity_id: entity.id,
      stage: 'proposal',
      currency_code: 'USD',
    });
    await post(createDealLine, '/api/v1/deal-lines', {
      deal_id: deal.id,
      offering_id: offering.id,
      name: 'Widget',
      quantity: '4',
    });
    const quoted = await (
      await quoteDeal(
        jsonRequest(`${BASE}/api/v1/deals/${deal.id}/quote?workspace_id=${workspace}`, 'POST', {}),
        routeContext(deal.id),
      )
    ).json();
    const accepted = await (
      await acceptQuote(
        jsonRequest(`${BASE}/api/v1/quotes/${quoted.quote.id}/accept?workspace_id=${workspace}`, 'POST', {}),
        routeContext(quoted.quote.id),
      )
    ).json();

    const orderLine = accepted.lines[0];
    const shipment = await post(createShipment, '/api/v1/shipments', {
      order_id: accepted.order.id,
      shipment_number: 'SHP-0001',
      ship_from_location_code: 'WH-1',
    });
    await post(createShipmentLine, '/api/v1/shipment-lines', {
      shipment_id: shipment.id,
      order_line_id: orderLine.id,
      quantity: '4',
    });

    const url = `${BASE}/api/v1/shipments/${shipment.id}/ship?workspace_id=${workspace}`;
    const responses = await Promise.all([
      shipShipment(jsonRequest(url, 'POST', {}), routeContext(shipment.id)),
      shipShipment(jsonRequest(url, 'POST', {}), routeContext(shipment.id)),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);

    const item = (await prisma.inventoryItem.findFirst({ where: { offering_id: offering.id } }))!;
    // Four units left the shelf, not eight.
    expect(Number(item.quantity_on_hand)).toBe(6);

    const line = (await prisma.orderLine.findFirst({ where: { id: orderLine.id } }))!;
    expect(Number(line.quantity_fulfilled)).toBe(4);
    expect(line.fulfillment_status).toBe('fulfilled');
  });
});
