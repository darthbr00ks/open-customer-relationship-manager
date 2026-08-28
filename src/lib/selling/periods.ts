/**
 * Billing period arithmetic.
 *
 * Date columns are stored as `date` and come back from Prisma as UTC midnight,
 * so everything here works in UTC — a subscription's period must not move
 * because the server it was renewed on sits in a different timezone.
 */

import type { BillingPeriod } from './pricing';

export const DAY_MS = 86_400_000;

/** Midnight UTC on the same calendar day. */
export function startOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * Advance a date by `count` billing periods.
 *
 * Month-length differences are clamped rather than allowed to roll forward: a
 * subscription that starts on the 31st renews on the 30th in a 30-day month,
 * not on the 1st of the next one.
 */
export function addPeriod(date: Date, period: BillingPeriod, count = 1): Date {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();

  switch (period) {
    case 'day':
      return new Date(Date.UTC(year, month, day + count));
    case 'week':
      return new Date(Date.UTC(year, month, day + count * 7));
    case 'month':
      return addMonths(year, month, day, count);
    case 'quarter':
      return addMonths(year, month, day, count * 3);
    case 'year':
      return addMonths(year, month, day, count * 12);
  }
}

function addMonths(year: number, month: number, day: number, months: number): Date {
  const target = new Date(Date.UTC(year, month + months, 1));
  const daysInTargetMonth = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), Math.min(day, daysInTargetMonth)));
}

/**
 * The service period beginning at `start`. `end` is the last day served
 * inclusive, so a monthly period starting 1 Jan ends 31 Jan and the next one
 * starts 1 Feb with no gap and no overlap.
 */
export function periodBounds(start: Date, period: BillingPeriod, count = 1): { start: Date; end: Date } {
  const from = startOfDay(start);
  const nextStart = addPeriod(from, period, count);
  return { start: from, end: new Date(nextStart.getTime() - DAY_MS) };
}

/** The period after the one ending on `currentEnd`. */
export function nextPeriod(currentEnd: Date, period: BillingPeriod, count = 1): { start: Date; end: Date } {
  return periodBounds(new Date(startOfDay(currentEnd).getTime() + DAY_MS), period, count);
}

/** Whole days from `from` to `to`, counting both ends. */
export function inclusiveDays(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY_MS) + 1;
}
