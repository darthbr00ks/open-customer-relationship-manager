/**
 * Proration for mid-period subscription changes.
 *
 * Adding seats in the middle of a month should charge for the part of the month
 * that is left, and removing them should credit it — without touching what the
 * customer was already billed. The amendment records the number this produces,
 * so months later the charge can still be explained.
 */

import { fromScaled, toScaled, type Decimalish } from './money';
import { inclusiveDays, startOfDay } from './periods';

export type ProrationInput = {
  /** The billing period the change lands in. */
  period_start: Date;
  period_end: Date;
  /** When the change takes effect; clamped into the period. */
  effective_date: Date;
  /** Recurring amount for the whole period, before and after the change. */
  previous_amount: Decimalish;
  new_amount: Decimalish;
};

export type Proration = {
  /** Positive is owed by the customer; negative is a credit. */
  amount: string;
  remaining_days: number;
  period_days: number;
};

/**
 * The charge or credit for the unused remainder of the current period.
 *
 * Day-count basis: both the period and the remainder count their end day, so a
 * change effective on the first day of the period prices the whole period and
 * one effective on the last day prices a single day.
 */
export function prorate(input: ProrationInput): Proration {
  const periodStart = startOfDay(input.period_start);
  const periodEnd = startOfDay(input.period_end);
  if (periodEnd < periodStart) {
    throw new Error('Billing period ends before it starts');
  }

  const effective = clamp(startOfDay(input.effective_date), periodStart, periodEnd);
  const periodDays = inclusiveDays(periodStart, periodEnd);
  const remainingDays = inclusiveDays(effective, periodEnd);

  // One rounding step, on the whole `delta x remaining / period` expression:
  // rounding the day ratio first would cost precision on large amounts.
  const delta = toScaled(input.new_amount) - toScaled(input.previous_amount);
  const numerator = delta * BigInt(remainingDays);
  const denominator = BigInt(periodDays);
  const negative = numerator < 0n;
  const absolute = negative ? -numerator : numerator;
  const rounded = (absolute + denominator / 2n) / denominator;

  return {
    amount: fromScaled(negative ? -rounded : rounded),
    remaining_days: remainingDays,
    period_days: periodDays,
  };
}

const clamp = (value: Date, low: Date, high: Date) => (value < low ? low : value > high ? high : value);
