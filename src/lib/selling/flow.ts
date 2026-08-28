/**
 * The sales flow: Deal → Quote → Order → Subscription / Service Delivery /
 * Shipment.
 *
 * Each step here is the one that must not be reversible by a catalog edit. A
 * Quote snapshots the catalog; accepting it snapshots the Quote onto an Order;
 * the Order's lines then open the ongoing records — a subscription, an
 * engagement, a stock reservation — that outlive the transaction that created
 * them.
 */

import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';

import { buildLines, componentQuantity, type LineDraft } from './catalog';
import { fromScaled, maxScaled, minScaled, toScaled } from './money';
import { periodBounds } from './periods';
import { rollUp, type PriceLike } from './pricing';
import { withDocumentNumber } from './numbering';

type Tx = Prisma.TransactionClient;

/** A failure the API should report as a specific status rather than a 500. */
export class SellingError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'SellingError';
  }
}

const decimal = (value: unknown): string => (value == null ? '0' : String(value));

/** A code the usage feed can refer to, derived from a human label. */
export const slugCode = (label: string) =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64) || 'usage';

/* -------------------------------------------------------------------------- */
/* Deal → Quote                                                                */
/* -------------------------------------------------------------------------- */

export type CreateQuoteFromDealInput = {
  workspace_id: string;
  deal_id: string;
  name?: string;
  currency_code?: string;
  price_book_id?: string | null;
  valid_until?: Date | null;
  contract_term_months?: number | null;
  payment_terms?: string | null;
  owner_user_id?: string | null;
  created_by_user_id?: string | null;
};

/**
 * Build a formal proposal from what the salesperson has been considering.
 *
 * Deal Lines point at the live catalog; the Quote Lines this produces do not.
 * Bundle offerings are expanded into their visible components so the customer
 * sees what they are getting, with each component keeping its own type — that
 * is what lets one line ship, one get scheduled, and one start billing monthly.
 */
export async function createQuoteFromDeal(input: CreateQuoteFromDealInput) {
  const { workspace_id } = input;

  const deal = await prisma.deal.findFirst({ where: { id: input.deal_id, workspace_id } });
  if (!deal) throw new SellingError(404, 'Deal not found');

  const dealLines = await prisma.dealLine.findMany({
    where: { deal_id: deal.id, workspace_id },
    orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
  });
  if (dealLines.length === 0) {
    throw new SellingError(422, 'Deal has no lines to quote');
  }

  const currency = input.currency_code ?? deal.currency_code ?? 'USD';
  const priceBookId = input.price_book_id ?? null;
  const asOf = new Date();

  const offeringIds = [...new Set(dealLines.map((line) => line.offering_id))];
  const bundleComponents = await prisma.bundleComponent.findMany({
    where: { workspace_id, parent_offering_id: { in: offeringIds } },
    orderBy: { sort_order: 'asc' },
  });
  const componentOfferingIds = bundleComponents.map((component) => component.child_offering_id);

  const offerings = await prisma.offering.findMany({
    where: { workspace_id, id: { in: [...offeringIds, ...componentOfferingIds] } },
  });
  const offeringById = new Map(offerings.map((offering) => [offering.id, offering]));

  const prices = await prisma.price.findMany({
    where: { workspace_id, offering_id: { in: [...offeringIds, ...componentOfferingIds] } },
    include: { tiers: true },
  });
  const pricesFor = (offeringId: string): (PriceLike & { id: string })[] =>
    prices
      .filter((price) => price.offering_id === offeringId)
      .map((price) => ({
        id: price.id,
        name: price.name,
        unit_of_measure: price.unit_of_measure,
        currency_code: price.currency_code,
        charge_type: price.charge_type,
        pricing_model: price.pricing_model,
        unit_amount: price.unit_amount == null ? null : String(price.unit_amount),
        billing_period: price.billing_period,
        billing_interval_count: price.billing_interval_count,
        minimum_quantity: price.minimum_quantity == null ? null : String(price.minimum_quantity),
        included_quantity: price.included_quantity == null ? null : String(price.included_quantity),
        effective_from: price.effective_from,
        effective_until: price.effective_until,
        price_book_id: price.price_book_id,
        tiers: price.tiers.map((tier) => ({
          up_to: tier.up_to == null ? null : String(tier.up_to),
          unit_amount: tier.unit_amount == null ? null : String(tier.unit_amount),
          flat_amount: tier.flat_amount == null ? null : String(tier.flat_amount),
        })),
      }));

  /** Parent lines and the component lines that hang under them, per deal line. */
  const groups: { parents: (LineDraft & { deal_line_id: string })[]; children: LineDraft[] }[] = [];

  for (const [index, dealLine] of dealLines.entries()) {
    const offering = offeringById.get(dealLine.offering_id);
    if (!offering) throw new SellingError(422, `Offering ${dealLine.offering_id} is not in this workspace`);

    const selection = { currency_code: currency, on: asOf, price_book_id: priceBookId };
    const termMonths = dealLine.term_months ?? input.contract_term_months ?? null;

    const parents = buildLines({
      offering,
      prices: pricesFor(offering.id),
      quantity: decimal(dealLine.quantity),
      selection,
      unit_amount_override: dealLine.unit_amount == null ? undefined : String(dealLine.unit_amount),
      term_months: termMonths,
      discount_type: dealLine.discount_type,
      discount_value: dealLine.discount_value == null ? undefined : String(dealLine.discount_value),
      sort_order: index,
    }).map((line) => ({ ...line, deal_line_id: dealLine.id }));

    const children: LineDraft[] = [];
    if (offering.offering_type === 'bundle') {
      const components = bundleComponents.filter((component) => component.parent_offering_id === offering.id);
      for (const [componentIndex, component] of components.entries()) {
        if (!component.is_visible_to_customer) continue;
        const child = offeringById.get(component.child_offering_id);
        if (!child) continue;

        children.push(
          ...buildLines({
            offering: child,
            // A component covered by the bundle price is listed at zero rather
            // than left out: the customer should see what the bundle contains.
            prices: component.is_separately_priced ? pricesFor(child.id) : [],
            quantity: componentQuantity(component, decimal(dealLine.quantity)),
            selection,
            unit_amount_override: component.is_separately_priced ? undefined : '0',
            term_months: termMonths,
            sort_order: index,
            is_optional: !component.is_required,
          }).map((line) => ({ ...line, sort_order: line.sort_order + componentIndex + 1 })),
        );
      }
    }

    groups.push({ parents, children });
  }

  return withDocumentNumber(
    'QUO',
    () => prisma.quote.count({ where: { workspace_id } }),
    (quote_number) =>
      prisma.$transaction(async (tx) => {
        const quote = await tx.quote.create({
          data: {
            workspace_id,
            quote_number,
            name: input.name ?? `${deal.name} quote`,
            deal_id: deal.id,
            entity_id: deal.entity_id,
            primary_contact_person_id: deal.primary_contact_person_id,
            status: 'draft',
            currency_code: currency,
            price_book_id: priceBookId,
            valid_until: input.valid_until ?? null,
            payment_terms: input.payment_terms ?? null,
            contract_term_months: input.contract_term_months ?? null,
            owner_user_id: input.owner_user_id ?? deal.owner_user_id,
            created_by_user_id: input.created_by_user_id ?? null,
          },
        });

        const created = [];
        for (const group of groups) {
          let parentId: string | null = null;
          for (const draft of group.parents) {
            const { deal_line_id, ...rest } = draft;
            const line = await tx.quoteLine.create({
              data: { workspace_id, quote_id: quote.id, deal_line_id, ...rest },
            });
            parentId ??= line.id;
            created.push(line);
          }
          for (const draft of group.children) {
            created.push(
              await tx.quoteLine.create({
                data: { workspace_id, quote_id: quote.id, parent_quote_line_id: parentId, ...draft },
              }),
            );
          }
        }

        const totals = rollUp(
          created.map((line) => ({
            subtotal_amount: decimal(line.subtotal_amount),
            discount_amount: decimal(line.discount_amount),
            tax_amount: decimal(line.tax_amount),
            is_optional: line.is_optional,
          })),
        );

        return {
          quote: await tx.quote.update({ where: { id: quote.id }, data: totals }),
          lines: created,
        };
      }),
  );
}

/* -------------------------------------------------------------------------- */
/* Quote → Order                                                               */
/* -------------------------------------------------------------------------- */

export type AcceptQuoteInput = {
  workspace_id: string;
  quote_id: string;
  purchase_order_number?: string | null;
  payment_terms?: string | null;
  created_by_user_id?: string | null;
};

export type ProvisioningSummary = {
  subscriptions: string[];
  service_deliveries: string[];
  /** Order lines whose stock could not be fully reserved, and by how much. */
  backordered: { order_line_id: string; quantity: string }[];
};

/**
 * Accept a quote: open the Order, copy every line's snapshot onto it, and start
 * whatever each line promised.
 *
 * Optional lines the customer did not take are not carried over — they were an
 * offer, not a sale.
 */
export async function acceptQuote(input: AcceptQuoteInput) {
  const { workspace_id } = input;

  const quote = await prisma.quote.findFirst({ where: { id: input.quote_id, workspace_id } });
  if (!quote) throw new SellingError(404, 'Quote not found');
  if (quote.status === 'accepted') throw new SellingError(409, 'Quote has already been accepted');
  if (quote.status === 'declined' || quote.status === 'expired') {
    throw new SellingError(409, `Cannot accept a ${quote.status} quote`);
  }

  const quoteLines = await prisma.quoteLine.findMany({
    where: { quote_id: quote.id, workspace_id },
    orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
  });
  const sold = quoteLines.filter((line) => !line.is_optional);
  if (sold.length === 0) throw new SellingError(422, 'Quote has no lines to order');

  return withDocumentNumber(
    'ORD',
    () => prisma.order.count({ where: { workspace_id } }),
    (order_number) =>
      prisma.$transaction(async (tx) => {
        const order = await tx.order.create({
          data: {
            workspace_id,
            order_number,
            quote_id: quote.id,
            deal_id: quote.deal_id,
            entity_id: quote.entity_id,
            bill_to_entity_id: quote.bill_to_entity_id,
            ship_to_entity_id: quote.ship_to_entity_id,
            primary_contact_person_id: quote.primary_contact_person_id,
            billing_contact_person_id: quote.billing_contact_person_id,
            status: 'open',
            currency_code: quote.currency_code,
            ordered_at: new Date(),
            payment_terms: input.payment_terms ?? quote.payment_terms,
            purchase_order_number: input.purchase_order_number ?? null,
            owner_user_id: quote.owner_user_id,
            created_by_user_id: input.created_by_user_id ?? null,
          },
        });

        // Quote line id → order line id, so a bundle's components stay attached
        // to their parent on the order too.
        const orderLineByQuoteLine = new Map<string, string>();
        const orderLines = [];
        for (const line of sold) {
          const created = await tx.orderLine.create({
            data: {
              workspace_id,
              order_id: order.id,
              quote_line_id: line.id,
              parent_order_line_id: line.parent_quote_line_id
                ? (orderLineByQuoteLine.get(line.parent_quote_line_id) ?? null)
                : null,
              offering_id: line.offering_id,
              price_id: line.price_id,
              name: line.name,
              description: line.description,
              sku: line.sku,
              offering_type: line.offering_type,
              charge_type: line.charge_type,
              pricing_model: line.pricing_model,
              fulfillment_policy: line.fulfillment_policy,
              unit_of_measure: line.unit_of_measure,
              quantity: line.quantity,
              unit_amount: line.unit_amount,
              currency_code: line.currency_code,
              billing_period: line.billing_period,
              billing_interval_count: line.billing_interval_count,
              included_quantity: line.included_quantity,
              term_months: line.term_months,
              discount_type: line.discount_type,
              discount_value: line.discount_value,
              subtotal_amount: line.subtotal_amount,
              discount_amount: line.discount_amount,
              tax_amount: line.tax_amount,
              total_amount: line.total_amount,
              sort_order: line.sort_order,
              notes: line.notes,
            },
          });
          orderLineByQuoteLine.set(line.id, created.id);
          orderLines.push(created);
        }

        const totals = rollUp(
          orderLines.map((line) => ({
            subtotal_amount: decimal(line.subtotal_amount),
            discount_amount: decimal(line.discount_amount),
            tax_amount: decimal(line.tax_amount),
          })),
          { discount_type: quote.discount_type, discount_value: quote.discount_value?.toString() },
        );

        const provisioning = await provisionOrder(tx, order, orderLines);

        await tx.quote.update({
          where: { id: quote.id },
          data: { status: 'accepted', accepted_at: new Date() },
        });

        return {
          order: await tx.order.update({ where: { id: order.id }, data: totals }),
          lines: orderLines,
          provisioning,
        };
      }),
  );
}

type OrderRow = Awaited<ReturnType<Tx['order']['create']>>;
type OrderLineRow = Awaited<ReturnType<Tx['orderLine']['create']>>;

/**
 * Open the ongoing records an order promised.
 *
 * A subscription line starts a Subscription and the Entitlements that say what
 * may be used; a service line opens a Service Delivery against the offering's
 * Service Definition; a physical line reserves stock. A bundle line itself
 * provisions nothing — its components were expanded into their own lines on the
 * quote, and each of those follows its own path.
 */
async function provisionOrder(tx: Tx, order: OrderRow, lines: OrderLineRow[]): Promise<ProvisioningSummary> {
  const workspace_id = order.workspace_id;
  const summary: ProvisioningSummary = { subscriptions: [], service_deliveries: [], backordered: [] };

  // Numbers are allocated from a count taken inside the transaction; a
  // collision aborts it and `withDocumentNumber` runs the whole thing again.
  let subscriptionSequence = await tx.subscription.count({ where: { workspace_id } });
  let deliverySequence = await tx.serviceDelivery.count({ where: { workspace_id } });

  const subscriptionByOffering = new Map<string, string>();

  for (const line of lines) {
    // The recurring charge is what makes a subscription. A setup fee on the
    // same offering is a one-time charge on this order, not a second agreement.
    if (line.offering_type === 'subscription' && line.charge_type === 'recurring') {
      subscriptionSequence += 1;
      const start = new Date();
      const period = periodBounds(start, line.billing_period ?? 'month', line.billing_interval_count);

      const subscription = await tx.subscription.create({
        data: {
          workspace_id,
          subscription_number: `SUB-${String(subscriptionSequence).padStart(4, '0')}`,
          name: line.name,
          entity_id: line.service_recipient_entity_id ?? order.entity_id,
          bill_to_entity_id: order.bill_to_entity_id,
          order_id: order.id,
          order_line_id: line.id,
          offering_id: line.offering_id,
          status: 'active',
          start_date: period.start,
          current_period_start: period.start,
          current_period_end: period.end,
          commitment_end_date: line.term_months
            ? new Date(Date.UTC(period.start.getUTCFullYear(), period.start.getUTCMonth() + line.term_months, period.start.getUTCDate()))
            : null,
          billing_period: line.billing_period ?? 'month',
          billing_interval_count: line.billing_interval_count,
          quantity: line.quantity,
          unit_of_measure: line.unit_of_measure,
          unit_amount: line.unit_amount,
          currency_code: line.currency_code,
          owner_user_id: order.owner_user_id,
          created_by_user_id: order.created_by_user_id,
        },
      });
      summary.subscriptions.push(subscription.id);
      if (line.offering_id) subscriptionByOffering.set(line.offering_id, subscription.id);

      // What was bought (seats, licences, devices) is also what may be used.
      await tx.entitlement.create({
        data: {
          workspace_id,
          subscription_id: subscription.id,
          entity_id: subscription.entity_id,
          order_line_id: line.id,
          code: slugCode(line.unit_of_measure),
          name: `Included ${line.unit_of_measure}`,
          unit_of_measure: line.unit_of_measure,
          included_quantity: line.quantity,
          currency_code: line.currency_code,
        },
      });
    }

    if (line.offering_type === 'service') {
      deliverySequence += 1;
      const definition = line.offering_id
        ? await tx.serviceDefinition.findFirst({ where: { workspace_id, offering_id: line.offering_id } })
        : null;

      const delivery = await tx.serviceDelivery.create({
        data: {
          workspace_id,
          delivery_number: `SVC-${String(deliverySequence).padStart(4, '0')}`,
          name: line.name,
          order_id: order.id,
          order_line_id: line.id,
          offering_id: line.offering_id,
          entity_id: line.service_recipient_entity_id ?? order.entity_id,
          contact_person_id: order.primary_contact_person_id,
          status: 'not_started',
          estimated_hours: definition?.estimated_hours ?? null,
          delivery_location: definition?.delivery_location ?? null,
          service_level_agreement: definition?.service_level_agreement ?? null,
          owner_user_id: order.owner_user_id,
          created_by_user_id: order.created_by_user_id,
        },
      });
      summary.service_deliveries.push(delivery.id);
    }

    if (line.offering_type === 'good' && line.fulfillment_policy === 'shipping' && line.offering_id) {
      const { shortfall } = await reserveInventory(tx, workspace_id, line.offering_id, decimal(line.quantity));
      if (toScaled(shortfall) > 0n) {
        summary.backordered.push({ order_line_id: line.id, quantity: shortfall });
      }
    }
  }

  // A usage charge is an allowance on the subscription it belongs to, priced
  // per unit past whatever the base charge already includes.
  for (const line of lines) {
    if (line.charge_type !== 'usage' || !line.offering_id) continue;
    const subscriptionId = subscriptionByOffering.get(line.offering_id);
    if (!subscriptionId) continue;

    await tx.entitlement.create({
      data: {
        workspace_id,
        subscription_id: subscriptionId,
        entity_id: order.entity_id,
        order_line_id: line.id,
        code: slugCode(line.name),
        name: line.name,
        unit_of_measure: line.unit_of_measure,
        included_quantity: line.included_quantity,
        overage_unit_amount: line.unit_amount,
        currency_code: line.currency_code,
      },
    });
  }

  return summary;
}

/* -------------------------------------------------------------------------- */
/* Inventory                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Hold stock for an order line across whatever locations have it. Reserving
 * less than was asked for is a backorder, not a failure — the order stands and
 * the shortfall is reported.
 */
export async function reserveInventory(
  tx: Tx,
  workspace_id: string,
  offering_id: string,
  quantity: string,
): Promise<{ reserved: string; shortfall: string }> {
  const items = await tx.inventoryItem.findMany({
    where: { workspace_id, offering_id, status: 'available' },
    orderBy: { created_at: 'asc' },
  });

  let outstanding = toScaled(quantity);
  let reserved = 0n;

  for (const item of items) {
    if (outstanding <= 0n) break;
    const available = maxScaled(toScaled(item.quantity_on_hand) - toScaled(item.quantity_reserved), 0n);
    const take = minScaled(available, outstanding);
    if (take <= 0n) continue;

    await tx.inventoryItem.update({
      where: { id: item.id },
      data: { quantity_reserved: fromScaled(toScaled(item.quantity_reserved) + take) },
    });
    reserved += take;
    outstanding -= take;
  }

  return { reserved: fromScaled(reserved), shortfall: fromScaled(maxScaled(outstanding, 0n)) };
}

/* -------------------------------------------------------------------------- */
/* Shipping                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Mark a shipment as gone: stock leaves the shelf and the reservation with it,
 * each order line records how much of it has now been fulfilled, and the order
 * moves to partially fulfilled or fulfilled.
 *
 * None of this touches the order's billing status. Paid and shipped are
 * different questions, and conflating them is how a customer ends up chased for
 * an invoice on a box that never left.
 */
export async function shipShipment(workspace_id: string, shipment_id: string) {
  const shipment = await prisma.shipment.findFirst({ where: { id: shipment_id, workspace_id } });
  if (!shipment) throw new SellingError(404, 'Shipment not found');
  if (shipment.status === 'shipped' || shipment.status === 'delivered') {
    throw new SellingError(409, 'Shipment has already been shipped');
  }
  if (shipment.status === 'canceled') throw new SellingError(409, 'Cannot ship a canceled shipment');

  return prisma.$transaction(async (tx) => {
    const shipmentLines = await tx.shipmentLine.findMany({ where: { workspace_id, shipment_id } });
    if (shipmentLines.length === 0) throw new SellingError(422, 'Shipment has no lines');

    for (const shipmentLine of shipmentLines) {
      const orderLine = await tx.orderLine.findFirst({
        where: { id: shipmentLine.order_line_id, workspace_id },
      });
      if (!orderLine) continue;

      await releaseInventory(
        tx,
        workspace_id,
        orderLine.offering_id,
        decimal(shipmentLine.quantity),
        shipment.ship_from_location_code,
      );

      const fulfilled = toScaled(orderLine.quantity_fulfilled) + toScaled(shipmentLine.quantity);
      await tx.orderLine.update({
        where: { id: orderLine.id },
        data: {
          quantity_fulfilled: fromScaled(fulfilled),
          fulfillment_status: fulfilled >= toScaled(orderLine.quantity) ? 'fulfilled' : 'partially_fulfilled',
        },
      });
    }

    const updated = await tx.shipment.update({
      where: { id: shipment.id },
      data: { status: 'shipped', shipped_at: shipment.shipped_at ?? new Date() },
    });

    return { shipment: updated, order: await rollUpFulfillment(tx, workspace_id, shipment.order_id) };
  });
}

/** Take shipped units off the shelf, and off the reservation that held them. */
async function releaseInventory(
  tx: Tx,
  workspace_id: string,
  offering_id: string | null,
  quantity: string,
  locationCode: string | null,
) {
  if (!offering_id) return;

  const items = await tx.inventoryItem.findMany({
    where: { workspace_id, offering_id, ...(locationCode ? { location_code: locationCode } : {}) },
    orderBy: { created_at: 'asc' },
  });

  let outstanding = toScaled(quantity);
  for (const item of items) {
    if (outstanding <= 0n) break;
    const onHand = toScaled(item.quantity_on_hand);
    const take = minScaled(onHand, outstanding);
    if (take <= 0n) continue;

    await tx.inventoryItem.update({
      where: { id: item.id },
      data: {
        quantity_on_hand: fromScaled(onHand - take),
        // Only what was actually held is released, so an unreserved shipment
        // cannot push the reservation negative.
        quantity_reserved: fromScaled(maxScaled(toScaled(item.quantity_reserved) - take, 0n)),
      },
    });
    outstanding -= take;
  }
}

/** An order is fulfilled only once every line that can ship has. */
async function rollUpFulfillment(tx: Tx, workspace_id: string, order_id: string) {
  const lines = await tx.orderLine.findMany({ where: { workspace_id, order_id } });
  const shippable = lines.filter((line) => line.fulfillment_policy === 'shipping');

  const status = shippable.length === 0
    ? 'not_started'
    : shippable.every((line) => line.fulfillment_status === 'fulfilled')
      ? 'fulfilled'
      : shippable.some((line) => line.fulfillment_status !== 'not_started')
        ? 'partially_fulfilled'
        : 'not_started';

  return tx.order.update({ where: { id: order_id }, data: { fulfillment_status: status } });
}
