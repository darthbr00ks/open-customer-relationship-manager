/**
 * Turning a catalog Price into an amount.
 *
 * An Offering is not "a thing with a price": it may carry several valid Prices
 * at once — a one-time setup fee, a recurring monthly charge, and a usage rate
 * for whatever runs past the included allowance. Selecting which of those apply
 * (currency, date, price book) and computing each one is all this module does;
 * it touches no database so the rules can be tested directly.
 */

import { fromScaled, maxScaled, mulScaled, toScaled, type Decimalish } from './money';

export type ChargeType = 'one_time' | 'recurring' | 'usage';
export type PricingModel = 'flat' | 'per_unit' | 'tiered' | 'volume' | 'graduated';
export type BillingPeriod = 'day' | 'week' | 'month' | 'quarter' | 'year';
export type DiscountType = 'percentage' | 'fixed_amount';

export type TierLike = {
  /** Inclusive upper bound of the band; null means "and above". */
  up_to?: Decimalish;
  unit_amount?: Decimalish;
  /** Charged once for reaching this band, on top of any per-unit amount. */
  flat_amount?: Decimalish;
};

export type PriceLike = {
  id?: string;
  name?: string | null;
  /** What this charge is measured in, when that differs from the offering's unit. */
  unit_of_measure?: string | null;
  currency_code: string;
  charge_type: ChargeType;
  pricing_model: PricingModel;
  unit_amount?: Decimalish;
  billing_period?: BillingPeriod | null;
  billing_interval_count?: number | null;
  minimum_quantity?: Decimalish;
  included_quantity?: Decimalish;
  effective_from?: Date | string | null;
  effective_until?: Date | string | null;
  price_book_id?: string | null;
  tiers?: TierLike[];
};

export type PriceSelection = {
  currency_code: string;
  /** As-of date for effective dating. Defaults to now. */
  on?: Date;
  /** Prefer prices from this book, falling back to the workspace list price. */
  price_book_id?: string | null;
};

/* -------------------------------------------------------------------------- */
/* Selection                                                                   */
/* -------------------------------------------------------------------------- */

const asDate = (value: Date | string | null | undefined): Date | null => {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** Whether a price's effective window covers `on`. Open-ended on either side. */
export function isPriceEffective(price: PriceLike, on: Date = new Date()): boolean {
  const from = asDate(price.effective_from);
  const until = asDate(price.effective_until);
  if (from && on < from) return false;
  if (until && on > until) return false;
  return true;
}

/**
 * The charges that apply to one Offering right now.
 *
 * Prices are grouped by what they charge for — charge type plus name, so
 * "Monthly" and "Overage" stay distinct — and one winner is picked per group:
 * a price from the requested price book beats a list price, and among equals
 * the one that most recently came into effect wins. That is what makes a
 * catalog change safe: the superseded row stays exactly where it was.
 */
export function selectPrices(prices: PriceLike[], selection: PriceSelection): PriceLike[] {
  const on = selection.on ?? new Date();
  const candidates = prices.filter(
    (price) =>
      price.currency_code === selection.currency_code &&
      isPriceEffective(price, on) &&
      (price.price_book_id == null || price.price_book_id === selection.price_book_id),
  );

  const best = new Map<string, PriceLike>();
  for (const price of candidates) {
    const key = `${price.charge_type}:${price.name ?? ''}`;
    const current = best.get(key);
    if (!current || outranks(price, current, selection.price_book_id ?? null)) {
      best.set(key, price);
    }
  }
  return [...best.values()];
}

function outranks(candidate: PriceLike, incumbent: PriceLike, priceBookId: string | null): boolean {
  const inBook = (price: PriceLike) => (price.price_book_id != null && price.price_book_id === priceBookId ? 1 : 0);
  if (inBook(candidate) !== inBook(incumbent)) return inBook(candidate) > inBook(incumbent);

  const startedAt = (price: PriceLike) => asDate(price.effective_from)?.getTime() ?? Number.NEGATIVE_INFINITY;
  return startedAt(candidate) > startedAt(incumbent);
}

/* -------------------------------------------------------------------------- */
/* Computation                                                                 */
/* -------------------------------------------------------------------------- */

export type ComputedCharge = {
  /** Quantity actually charged, after the minimum and the included allowance. */
  billable_quantity: string;
  amount: string;
};

/** Tiers sorted low to high, with the open-ended band last. */
function orderedTiers(tiers: TierLike[]): { limit: bigint | null; unit: bigint; flat: bigint }[] {
  return tiers
    .map((tier) => ({
      limit: tier.up_to == null || tier.up_to === '' ? null : toScaled(tier.up_to),
      unit: toScaled(tier.unit_amount),
      flat: toScaled(tier.flat_amount),
    }))
    .sort((a, b) => {
      if (a.limit === null) return 1;
      if (b.limit === null) return -1;
      return a.limit < b.limit ? -1 : a.limit > b.limit ? 1 : 0;
    });
}

/**
 * What one Price charges for a quantity.
 *
 * `minimum_quantity` raises the quantity to the floor the customer agreed to
 * buy; `included_quantity` then takes off what the base charge already covers,
 * which is how "$500 includes 10,000 transactions, then $0.02 each" is two
 * Prices rather than a special case.
 */
export function computeCharge(price: PriceLike, quantity: Decimalish): ComputedCharge {
  const minimum = toScaled(price.minimum_quantity);
  const requested = toScaled(quantity);
  const purchased = maxScaled(requested, minimum);
  const billable = maxScaled(purchased - toScaled(price.included_quantity), 0n);
  const unit = toScaled(price.unit_amount);

  let amount: bigint;
  switch (price.pricing_model) {
    case 'flat':
      // One amount for the line, however many units it covers.
      amount = unit;
      break;
    case 'per_unit':
      amount = mulScaled(unit, billable);
      break;
    case 'volume':
      amount = volumeAmount(orderedTiers(price.tiers ?? []), billable);
      break;
    // `tiered` and `graduated` name the same rule: each band's units are
    // charged at that band's rate, rather than the whole quantity at one rate.
    case 'tiered':
    case 'graduated':
      amount = graduatedAmount(orderedTiers(price.tiers ?? []), billable);
      break;
    default:
      amount = 0n;
  }

  return { billable_quantity: fromScaled(billable), amount: fromScaled(amount) };
}

/** The whole quantity charged at the rate of the band it lands in. */
function volumeAmount(tiers: { limit: bigint | null; unit: bigint; flat: bigint }[], quantity: bigint): bigint {
  if (tiers.length === 0 || quantity === 0n) return 0n;
  const band = tiers.find((tier) => tier.limit === null || quantity <= tier.limit) ?? tiers[tiers.length - 1]!;
  return mulScaled(band.unit, quantity) + band.flat;
}

/** Each band's own units charged at that band's rate. */
function graduatedAmount(tiers: { limit: bigint | null; unit: bigint; flat: bigint }[], quantity: bigint): bigint {
  let remaining = quantity;
  let floor = 0n;
  let total = 0n;

  for (const tier of tiers) {
    if (remaining <= 0n) break;
    const capacity = tier.limit === null ? remaining : tier.limit - floor;
    if (capacity <= 0n) continue;
    const units = capacity < remaining ? capacity : remaining;
    total += mulScaled(tier.unit, units) + tier.flat;
    remaining -= units;
    if (tier.limit !== null) floor = tier.limit;
  }
  return total;
}

/* -------------------------------------------------------------------------- */
/* Discounts and line totals                                                   */
/* -------------------------------------------------------------------------- */

/**
 * A discount never touches the catalog price: it is recorded next to the line
 * as a type and a value, and reduces the line's own total.
 */
export function discountAmount(subtotal: Decimalish, type: DiscountType | null | undefined, value: Decimalish): string {
  const base = toScaled(subtotal);
  if (!type || value == null || value === '') return '0';
  const raw = type === 'percentage' ? mulScaled(base, toScaled(value)) / 100n : toScaled(value);
  // Never discount past zero, and never turn a credit into a charge.
  const capped = raw < 0n ? 0n : raw > base ? base : raw;
  return fromScaled(capped);
}

export type LineInput = {
  quantity: Decimalish;
  unit_amount?: Decimalish;
  pricing_model?: PricingModel;
  minimum_quantity?: Decimalish;
  included_quantity?: Decimalish;
  tiers?: TierLike[];
  discount_type?: DiscountType | null;
  discount_value?: Decimalish;
  tax_amount?: Decimalish;
};

export type LineTotals = {
  subtotal_amount: string;
  discount_amount: string;
  tax_amount: string;
  total_amount: string;
};

/** Subtotal → discount → tax, the order every line and every rollup uses. */
export function lineTotals(line: LineInput): LineTotals {
  const { amount } = computeCharge(
    {
      currency_code: 'USD',
      charge_type: 'one_time',
      pricing_model: line.pricing_model ?? 'per_unit',
      unit_amount: line.unit_amount,
      minimum_quantity: line.minimum_quantity,
      included_quantity: line.included_quantity,
      tiers: line.tiers,
    },
    line.quantity,
  );

  const discount = discountAmount(amount, line.discount_type, line.discount_value);
  const tax = line.tax_amount == null || line.tax_amount === '' ? '0' : String(line.tax_amount);
  const total = fromScaled(toScaled(amount) - toScaled(discount) + toScaled(tax));

  return { subtotal_amount: amount, discount_amount: discount, tax_amount: fromScaled(toScaled(tax)), total_amount: total };
}

/**
 * Roll a set of lines up into a document total, then apply any document-level
 * discount on top. Optional lines are presented but not counted until chosen.
 */
export function rollUp(
  lines: { subtotal_amount: Decimalish; discount_amount: Decimalish; tax_amount: Decimalish; is_optional?: boolean }[],
  documentDiscount?: { discount_type?: DiscountType | null; discount_value?: Decimalish },
): LineTotals {
  const counted = lines.filter((line) => !line.is_optional);
  const subtotal = counted.reduce<bigint>((total, line) => total + toScaled(line.subtotal_amount), 0n);
  const lineDiscounts = counted.reduce<bigint>((total, line) => total + toScaled(line.discount_amount), 0n);
  const tax = counted.reduce<bigint>((total, line) => total + toScaled(line.tax_amount), 0n);

  const afterLineDiscounts = subtotal - lineDiscounts;
  const documentDiscountAmount = toScaled(
    discountAmount(fromScaled(afterLineDiscounts), documentDiscount?.discount_type, documentDiscount?.discount_value),
  );

  return {
    subtotal_amount: fromScaled(subtotal),
    discount_amount: fromScaled(lineDiscounts + documentDiscountAmount),
    tax_amount: fromScaled(tax),
    total_amount: fromScaled(afterLineDiscounts - documentDiscountAmount + tax),
  };
}

/* -------------------------------------------------------------------------- */
/* Quoting an offering                                                         */
/* -------------------------------------------------------------------------- */

export type ResolvedCharge = ComputedCharge & {
  price_id?: string;
  name: string | null;
  unit_of_measure: string | null;
  charge_type: ChargeType;
  pricing_model: PricingModel;
  currency_code: string;
  billing_period: BillingPeriod | null;
  billing_interval_count: number;
  included_quantity: string | null;
  unit_amount: string | null;
};

/**
 * Every charge one Offering produces for a quantity — the answer to "what does
 * this cost?" when the honest answer is "$1,000 now, $100 a month, and $0.02
 * for each transaction past the first 10,000".
 */
export function quoteOffering(prices: PriceLike[], quantity: Decimalish, selection: PriceSelection): ResolvedCharge[] {
  return selectPrices(prices, selection)
    .map((price) => ({
      ...computeCharge(price, quantity),
      price_id: price.id,
      name: price.name ?? null,
      unit_of_measure: price.unit_of_measure ?? null,
      charge_type: price.charge_type,
      pricing_model: price.pricing_model,
      currency_code: price.currency_code,
      billing_period: price.billing_period ?? null,
      billing_interval_count: price.billing_interval_count ?? 1,
      included_quantity: price.included_quantity == null ? null : String(price.included_quantity),
      unit_amount: price.unit_amount == null ? null : String(price.unit_amount),
    }))
    .sort((a, b) => chargeOrder(a.charge_type) - chargeOrder(b.charge_type));
}

const chargeOrder = (type: ChargeType) => ({ one_time: 0, recurring: 1, usage: 2 })[type];
