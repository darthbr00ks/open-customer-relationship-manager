/**
 * Turning catalog rows into transaction lines.
 *
 * This is the step the whole model exists for: a Quote Line is a *snapshot*,
 * not a pointer. Everything the customer was shown — name, SKU, unit, price,
 * billing terms, discount — is copied onto the line here, so a later catalog
 * edit changes what can be sold next, never what was already agreed.
 *
 * No database access, so the rules can be exercised directly.
 */

import { fromScaled, mulScaled, toScaled, type Decimalish } from './money';
import {
  computeCharge,
  discountAmount,
  selectPrices,
  type BillingPeriod,
  type ChargeType,
  type DiscountType,
  type PriceLike,
  type PriceSelection,
  type PricingModel,
} from './pricing';

export type OfferingType = 'good' | 'service' | 'subscription' | 'bundle';
export type FulfillmentPolicy = 'shipping' | 'digital_activation' | 'scheduled_work' | 'none';

export type CatalogOffering = {
  id: string;
  sku: string;
  name: string;
  description?: string | null;
  offering_type: OfferingType;
  unit_of_measure: string;
  fulfillment_policy: FulfillmentPolicy;
};

export type LineDraft = {
  offering_id: string | null;
  price_id: string | null;
  name: string;
  description: string | null;
  sku: string | null;
  offering_type: OfferingType;
  charge_type: ChargeType;
  pricing_model: PricingModel;
  fulfillment_policy: FulfillmentPolicy;
  unit_of_measure: string;
  quantity: string;
  unit_amount: string | null;
  currency_code: string;
  billing_period: BillingPeriod | null;
  billing_interval_count: number;
  included_quantity: string | null;
  term_months: number | null;
  discount_type: DiscountType | null;
  discount_value: string | null;
  subtotal_amount: string;
  discount_amount: string;
  tax_amount: string;
  total_amount: string;
  sort_order: number;
  is_optional: boolean;
};

const MONTHS_PER_PERIOD: Partial<Record<BillingPeriod, number>> = { month: 1, quarter: 3, year: 12 };

/**
 * How many billing periods a contract term covers, so a quote can show what the
 * customer commits to rather than one month of it. Periods that do not divide
 * into months (daily, weekly) price a single period; there is no honest way to
 * turn "12 months" into a week count without a calendar.
 */
export function periodsInTerm(
  period: BillingPeriod | null | undefined,
  intervalCount: number | null | undefined,
  termMonths: number | null | undefined,
): number {
  if (!period || !termMonths || termMonths <= 0) return 1;
  const months = MONTHS_PER_PERIOD[period];
  if (!months) return 1;
  return Math.max(1, Math.floor(termMonths / (months * Math.max(1, intervalCount ?? 1))));
}

export type BuildLinesInput = {
  offering: CatalogOffering;
  /** Every price on the offering; selection picks the ones that apply. */
  prices: (PriceLike & { id: string })[];
  quantity: Decimalish;
  selection: PriceSelection;
  /**
   * A negotiated unit price. When set it replaces the catalog charges for this
   * line entirely — the rep has already decided what this costs.
   */
  unit_amount_override?: Decimalish;
  term_months?: number | null;
  discount_type?: DiscountType | null;
  discount_value?: Decimalish;
  sort_order?: number;
  is_optional?: boolean;
};

/**
 * The lines one catalog Offering produces.
 *
 * An Offering can charge several ways at once, and each charge becomes its own
 * line: a subscription with a setup fee and usage overage quotes as three
 * lines, which is what makes the total legible and the downstream provisioning
 * unambiguous.
 */
export function buildLines(input: BuildLinesInput): LineDraft[] {
  const { offering, selection } = input;
  const sortOrder = input.sort_order ?? 0;

  const negotiated = input.unit_amount_override != null && input.unit_amount_override !== '';
  const charges: (PriceLike & { id?: string })[] = negotiated
    ? [negotiatedPrice(input.unit_amount_override!, selection.currency_code)]
    : selectPrices(input.prices, selection).sort((a, b) => chargeOrder(a.charge_type) - chargeOrder(b.charge_type));

  if (charges.length === 0) {
    // Nothing in the catalog prices this yet; the line still belongs on the
    // quote so the omission is visible rather than silent.
    charges.push(negotiatedPrice('0', selection.currency_code));
  }

  return charges.map((price, index) => {
    const quantity = quotedQuantity(price, input.quantity);
    const { amount } = computeCharge(price, quantity);
    const periods = periodsInTerm(price.billing_period, price.billing_interval_count, input.term_months);
    const subtotal = fromScaled(mulScaled(toScaled(amount), toScaled(periods)));
    const discount = discountAmount(subtotal, input.discount_type, input.discount_value);

    return {
      offering_id: offering.id,
      price_id: price.id ?? null,
      name: charges.length > 1 && price.name ? `${offering.name} — ${price.name}` : offering.name,
      description: offering.description ?? null,
      sku: offering.sku,
      offering_type: offering.offering_type,
      charge_type: price.charge_type,
      pricing_model: price.pricing_model,
      fulfillment_policy: offering.fulfillment_policy,
      unit_of_measure: price.unit_of_measure ?? offering.unit_of_measure,
      quantity,
      unit_amount: price.unit_amount == null ? null : String(price.unit_amount),
      currency_code: price.currency_code,
      billing_period: price.billing_period ?? null,
      billing_interval_count: price.billing_interval_count ?? 1,
      included_quantity: price.included_quantity == null ? null : String(price.included_quantity),
      term_months: input.term_months ?? null,
      discount_type: input.discount_type ?? null,
      discount_value: input.discount_value == null ? null : String(input.discount_value),
      subtotal_amount: subtotal,
      discount_amount: discount,
      tax_amount: '0',
      total_amount: fromScaled(toScaled(subtotal) - toScaled(discount)),
      // Charges of one offering stay adjacent, in the order they are charged.
      sort_order: sortOrder * 100 + index,
      is_optional: input.is_optional ?? false,
    } satisfies LineDraft;
  });
}

/**
 * The quantity one charge is quoted at.
 *
 * A line is sized by one number — 25 seats — but its charges are not all
 * measured in seats. A usage charge with an included allowance is the
 * base-plus-overage case: what the customer is buying on this line is the
 * allowance ("10,000 transactions included"), not 25 of anything. A usage
 * charge without an allowance is committed volume, and is quoted at the
 * quantity the line was sized by.
 */
function quotedQuantity(price: PriceLike, lineQuantity: Decimalish): string {
  const allowance = price.included_quantity;
  return price.charge_type === 'usage' && allowance != null && allowance !== ''
    ? String(allowance)
    : String(lineQuantity);
}

const chargeOrder = (type: ChargeType) => ({ one_time: 0, recurring: 1, usage: 2 })[type];

/** A price the rep decided on, standing in for the catalog for one line. */
function negotiatedPrice(unitAmount: Decimalish, currency: string): PriceLike {
  return {
    name: null,
    currency_code: currency,
    charge_type: 'one_time' as ChargeType,
    pricing_model: 'per_unit' as PricingModel,
    unit_amount: String(unitAmount),
  };
}

export type BundleComponentInput = {
  child_offering_id: string;
  default_quantity: Decimalish;
  is_required: boolean;
  is_separately_priced: boolean;
  is_visible_to_customer: boolean;
  sort_order: number;
};

/**
 * Quantity of a bundle component for a given bundle quantity — two security
 * packages mean two devices and two installations.
 */
export const componentQuantity = (component: BundleComponentInput, bundleQuantity: Decimalish) =>
  fromScaled(mulScaled(toScaled(component.default_quantity), toScaled(bundleQuantity)));
