import { describe, expect, it } from 'vitest';

import { add, fromScaled, multiply, subtract, sum, toScaled } from '@/lib/selling/money';
import { addPeriod, inclusiveDays, nextPeriod, periodBounds } from '@/lib/selling/periods';
import {
  computeCharge,
  discountAmount,
  isPriceEffective,
  lineTotals,
  quoteOffering,
  rollUp,
  selectPrices,
  type PriceLike,
} from '@/lib/selling/pricing';
import { prorate } from '@/lib/selling/proration';

/** These modules touch no database — the selling rules are testable on their own. */

describe('money', () => {
  it('adds decimals without floating-point drift', () => {
    expect(add('0.1', '0.2')).toBe('0.3');
    expect(sum(['19.99', '19.99', '19.99'])).toBe('59.97');
    expect(subtract('100', '0.0001')).toBe('99.9999');
  });

  it('keeps four decimal places and rounds half away from zero', () => {
    expect(fromScaled(toScaled('1.00005'))).toBe('1.0001');
    expect(fromScaled(toScaled('-1.00005'))).toBe('-1.0001');
    expect(multiply('0.0002', '3')).toBe('0.0006');
  });

  it('rejects a value that is not a number', () => {
    expect(() => toScaled('twelve')).toThrow();
  });
});

const usd = { currency_code: 'USD' } as const;

describe('price selection', () => {
  const price = (over: Partial<PriceLike>): PriceLike => ({
    currency_code: 'USD',
    charge_type: 'recurring',
    pricing_model: 'per_unit',
    unit_amount: '25',
    ...over,
  });

  it('honours the effective window', () => {
    const p = price({ effective_from: '2026-01-01', effective_until: '2026-06-30' });
    expect(isPriceEffective(p, new Date('2026-03-01'))).toBe(true);
    expect(isPriceEffective(p, new Date('2025-12-31'))).toBe(false);
    expect(isPriceEffective(p, new Date('2026-07-01'))).toBe(false);
  });

  it('prefers the newest effective price rather than overwriting the old one', () => {
    const oldPrice = price({ id: 'old', name: 'Monthly', effective_from: '2025-01-01', unit_amount: '20' });
    const newPrice = price({ id: 'new', name: 'Monthly', effective_from: '2026-01-01', unit_amount: '25' });

    const selected = selectPrices([oldPrice, newPrice], { ...usd, on: new Date('2026-05-01') });
    expect(selected).toHaveLength(1);
    expect(selected[0]!.id).toBe('new');

    // The superseded price still prices a transaction dated before the change.
    const historic = selectPrices([oldPrice, newPrice], { ...usd, on: new Date('2025-06-01') });
    expect(historic[0]!.id).toBe('old');
  });

  it('lets a price book beat the list price', () => {
    const list = price({ id: 'list', name: 'Monthly', unit_amount: '25' });
    const book = price({ id: 'book', name: 'Monthly', unit_amount: '20', price_book_id: 'gov' });

    expect(selectPrices([list, book], { ...usd, price_book_id: 'gov' })[0]!.id).toBe('book');
    expect(selectPrices([list, book], usd)[0]!.id).toBe('list');
  });

  it('keeps every charge on an offering, not just one', () => {
    const charges = quoteOffering(
      [
        price({ name: 'Setup', charge_type: 'one_time', pricing_model: 'flat', unit_amount: '1000' }),
        price({ name: 'Monthly', charge_type: 'recurring', pricing_model: 'flat', unit_amount: '500', billing_period: 'month' }),
        price({
          name: 'Overage',
          charge_type: 'usage',
          pricing_model: 'per_unit',
          unit_amount: '0.02',
          included_quantity: '10000',
        }),
      ],
      '12500',
      usd,
    );

    expect(charges.map((c) => [c.name, c.amount])).toEqual([
      ['Setup', '1000'],
      ['Monthly', '500'],
      ['Overage', '50'],
    ]);
  });

  it('ignores a price in another currency', () => {
    const usdPrice = price({ id: 'usd', name: 'Monthly' });
    const eurPrice = price({ id: 'eur', name: 'Monthly', currency_code: 'EUR' });
    expect(selectPrices([usdPrice, eurPrice], { currency_code: 'EUR' })[0]!.id).toBe('eur');
  });
});

describe('charge computation', () => {
  const base = { currency_code: 'USD', charge_type: 'recurring' } as const;

  it('charges a flat price once, whatever the quantity', () => {
    const price: PriceLike = { ...base, pricing_model: 'flat', unit_amount: '100' };
    expect(computeCharge(price, '1').amount).toBe('100');
    expect(computeCharge(price, '40').amount).toBe('100');
  });

  it('multiplies a per-seat price by the seat count', () => {
    const price: PriceLike = { ...base, pricing_model: 'per_unit', unit_amount: '25' };
    expect(computeCharge(price, '12').amount).toBe('300');
  });

  it('applies a minimum quantity before an included allowance', () => {
    const price: PriceLike = {
      ...base,
      pricing_model: 'per_unit',
      unit_amount: '10',
      minimum_quantity: '5',
      included_quantity: '2',
    };
    // Quantity 1 is raised to the 5 the customer committed to; 2 are included.
    expect(computeCharge(price, '1')).toEqual({ billable_quantity: '3', amount: '30' });
  });

  it('charges each band at its own rate for graduated pricing', () => {
    const price: PriceLike = {
      ...base,
      pricing_model: 'graduated',
      tiers: [
        { up_to: '10', unit_amount: '10' },
        { up_to: '20', unit_amount: '8' },
        { up_to: null, unit_amount: '5' },
      ],
    };
    // 10 x 10 + 10 x 8 + 5 x 5
    expect(computeCharge(price, '25').amount).toBe('205');
    expect(computeCharge(price, '10').amount).toBe('100');
  });

  it('charges the whole quantity at one rate for volume pricing', () => {
    const price: PriceLike = {
      ...base,
      pricing_model: 'volume',
      tiers: [
        { up_to: '10', unit_amount: '10' },
        { up_to: '20', unit_amount: '8' },
        { up_to: null, unit_amount: '5' },
      ],
    };
    expect(computeCharge(price, '25').amount).toBe('125');
    expect(computeCharge(price, '15').amount).toBe('120');
  });

  it('adds a band entry fee to the per-unit amount', () => {
    const price: PriceLike = {
      ...base,
      pricing_model: 'volume',
      tiers: [{ up_to: null, unit_amount: '2', flat_amount: '50' }],
    };
    expect(computeCharge(price, '10').amount).toBe('70');
  });
});

describe('discounts and rollups', () => {
  it('computes a percentage and a fixed discount', () => {
    expect(discountAmount('1000', 'percentage', '15')).toBe('150');
    expect(discountAmount('1000', 'fixed_amount', '250')).toBe('250');
  });

  it('never discounts past zero', () => {
    expect(discountAmount('100', 'fixed_amount', '400')).toBe('100');
    expect(discountAmount('100', 'percentage', '-10')).toBe('0');
  });

  it('applies discount then tax on a line', () => {
    expect(
      lineTotals({ quantity: '10', unit_amount: '100', discount_type: 'percentage', discount_value: '10', tax_amount: '45' }),
    ).toEqual({ subtotal_amount: '1000', discount_amount: '100', tax_amount: '45', total_amount: '945' });
  });

  it('applies a document discount on top of line discounts', () => {
    const totals = rollUp(
      [
        { subtotal_amount: '1000', discount_amount: '100', tax_amount: '0' },
        { subtotal_amount: '500', discount_amount: '0', tax_amount: '0' },
      ],
      { discount_type: 'percentage', discount_value: '10' },
    );
    // 1500 - 100 = 1400, less 10% = 1260.
    expect(totals).toEqual({ subtotal_amount: '1500', discount_amount: '240', tax_amount: '0', total_amount: '1260' });
  });

  it('leaves optional lines out of the total', () => {
    const totals = rollUp([
      { subtotal_amount: '1000', discount_amount: '0', tax_amount: '0' },
      { subtotal_amount: '500', discount_amount: '0', tax_amount: '0', is_optional: true },
    ]);
    expect(totals.total_amount).toBe('1000');
  });
});

describe('billing periods', () => {
  it('advances by month, quarter, and year', () => {
    expect(addPeriod(new Date('2026-01-15'), 'month').toISOString().slice(0, 10)).toBe('2026-02-15');
    expect(addPeriod(new Date('2026-01-15'), 'quarter').toISOString().slice(0, 10)).toBe('2026-04-15');
    expect(addPeriod(new Date('2026-01-15'), 'year').toISOString().slice(0, 10)).toBe('2027-01-15');
    expect(addPeriod(new Date('2026-01-15'), 'month', 3).toISOString().slice(0, 10)).toBe('2026-04-15');
  });

  it('clamps to the end of a shorter month instead of rolling over', () => {
    expect(addPeriod(new Date('2026-01-31'), 'month').toISOString().slice(0, 10)).toBe('2026-02-28');
  });

  it('makes periods meet without a gap or an overlap', () => {
    const first = periodBounds(new Date('2026-01-01'), 'month');
    expect(first.end.toISOString().slice(0, 10)).toBe('2026-01-31');

    const second = nextPeriod(first.end, 'month');
    expect(second.start.toISOString().slice(0, 10)).toBe('2026-02-01');
    expect(second.end.toISOString().slice(0, 10)).toBe('2026-02-28');
  });

  it('counts both ends of a span', () => {
    expect(inclusiveDays(new Date('2026-01-01'), new Date('2026-01-31'))).toBe(31);
  });
});

describe('proration', () => {
  const period = { period_start: new Date('2026-01-01'), period_end: new Date('2026-01-31') };

  it('charges for the remainder of the period when seats are added', () => {
    const result = prorate({ ...period, effective_date: new Date('2026-01-17'), previous_amount: '250', new_amount: '350' });
    // 15 of 31 days left, on a $100 increase.
    expect(result.remaining_days).toBe(15);
    expect(result.amount).toBe('48.3871');
  });

  it('credits when the amount goes down', () => {
    const result = prorate({ ...period, effective_date: new Date('2026-01-17'), previous_amount: '350', new_amount: '250' });
    expect(result.amount).toBe('-48.3871');
  });

  it('prices the whole period for a change on its first day', () => {
    const result = prorate({ ...period, effective_date: new Date('2026-01-01'), previous_amount: '0', new_amount: '310' });
    expect(result.amount).toBe('310');
  });

  it('clamps an effective date outside the period', () => {
    const early = prorate({ ...period, effective_date: new Date('2025-12-01'), previous_amount: '0', new_amount: '310' });
    expect(early.amount).toBe('310');

    const late = prorate({ ...period, effective_date: new Date('2026-03-01'), previous_amount: '0', new_amount: '310' });
    expect(late.remaining_days).toBe(1);
  });
});
