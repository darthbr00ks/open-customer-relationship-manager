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
  discountAmount,
  quoteOffering,
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
  const { offering, quantity, selection } = input;
  const sortOrder = input.sort_order ?? 0;

  const charges =
    input.unit_amount_override != null && input.unit_amount_override !== ''
      ? [negotiatedCharge(input.unit_amount_override, quantity, selection.currency_code)]
      : quoteOffering(input.prices, quantity, selection);

  if (charges.length === 0) {
    // Nothing in the catalog prices this yet; the line still belongs on the
    // quote so the omission is visible rather than silent.
    charges.push(negotiatedCharge('0', quantity, selection.currency_code));
  }

  return charges.map((charge, index) => {
    const periods = periodsInTerm(charge.billing_period, charge.billing_interval_count, input.term_months);
    const subtotal = fromScaled(mulScaled(toScaled(charge.amount), toScaled(periods)));
    const discount = discountAmount(subtotal, input.discount_type, input.discount_value);

    return {
      offering_id: offering.id,
      price_id: charge.price_id ?? null,
      name: charges.length > 1 && charge.name ? `${offering.name} — ${charge.name}` : offering.name,
      description: offering.description ?? null,
      sku: offering.sku,
      offering_type: offering.offering_type,
      charge_type: charge.charge_type,
      pricing_model: charge.pricing_model,
      fulfillment_policy: offering.fulfillment_policy,
      unit_of_measure: offering.unit_of_measure,
      quantity: String(quantity),
      unit_amount: charge.unit_amount,
      currency_code: charge.currency_code,
      billing_period: charge.billing_period,
      billing_interval_count: charge.billing_interval_count,
      included_quantity: charge.included_quantity,
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

function negotiatedCharge(unitAmount: Decimalish, quantity: Decimalish, currency: string) {
  return {
    price_id: undefined,
    name: null,
    charge_type: 'one_time' as ChargeType,
    pricing_model: 'per_unit' as PricingModel,
    currency_code: currency,
    billing_period: null,
    billing_interval_count: 1,
    included_quantity: null,
    unit_amount: String(unitAmount),
    billable_quantity: String(quantity),
    amount: fromScaled(mulScaled(toScaled(unitAmount), toScaled(quantity))),
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
