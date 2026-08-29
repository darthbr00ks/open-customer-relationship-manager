/**
 * Changing a subscription without losing what it used to say.
 *
 * Every change writes a `SubscriptionAmendment` carrying the before and after
 * values and any prorated charge, then applies the new state to the
 * subscription. Nothing is edited away: months later, "why was this invoice
 * $48.39 more" has an answer in the record rather than in someone's memory.
 */

import { prisma } from '@/lib/prisma';

import { SellingError, slugCode } from './flow';
import { fromScaled, mulScaled, toScaled } from './money';
import { addPeriod, nextPeriod, periodBounds, startOfDay } from './periods';
import { prorate } from './proration';
import type { BillingPeriod } from './pricing';

export type AmendmentType =
  | 'quantity_change'
  | 'plan_change'
  | 'price_change'
  | 'billing_frequency_change'
  | 'renewal'
  | 'pause'
  | 'resume'
  | 'cancel';

export type AmendSubscriptionInput = {
  workspace_id: string;
  subscription_id: string;
  amendment_type: AmendmentType;
  effective_date?: Date;
  quantity?: string;
  unit_amount?: string;
  offering_id?: string;
  billing_period?: BillingPeriod;
  billing_interval_count?: number;
  commitment_end_date?: Date;
  /** For `cancel`: serve out the period already paid for instead of stopping now. */
  at_period_end?: boolean;
  resumes_on?: Date;
  reason?: string;
  created_by_user_id?: string | null;
};

const decimal = (value: unknown): string => (value == null ? '0' : String(value));

/** Recurring amount for one billing period, at a given quantity and unit price. */
const periodAmount = (quantity: unknown, unitAmount: unknown) =>
  fromScaled(mulScaled(toScaled(decimal(quantity)), toScaled(unitAmount == null ? '0' : String(unitAmount))));

export async function amendSubscription(input: AmendSubscriptionInput) {
  const { workspace_id } = input;

  const subscription = await prisma.subscription.findFirst({
    where: { id: input.subscription_id, workspace_id },
  });
  if (!subscription) throw new SellingError(404, 'Subscription not found');
  if (subscription.status === 'expired') {
    throw new SellingError(409, 'Cannot amend an expired subscription');
  }

  const effective = startOfDay(input.effective_date ?? new Date());
  const previousPeriodAmount = periodAmount(subscription.quantity, subscription.unit_amount);

  // What the subscription becomes. Each amendment type touches only the fields
  // it is about, so an unrelated column cannot be quietly reset.
  const next = {
    quantity: decimal(subscription.quantity),
    unit_amount: subscription.unit_amount == null ? null : String(subscription.unit_amount),
    offering_id: subscription.offering_id,
    billing_period: subscription.billing_period,
    billing_interval_count: subscription.billing_interval_count,
    status: subscription.status,
    commitment_end_date: subscription.commitment_end_date,
    current_period_start: subscription.current_period_start,
    current_period_end: subscription.current_period_end,
    paused_at: subscription.paused_at,
    resumes_on: subscription.resumes_on,
    canceled_at: subscription.canceled_at,
    cancellation_effective_date: subscription.cancellation_effective_date,
    end_date: subscription.end_date,
  };

  switch (input.amendment_type) {
    case 'quantity_change': {
      if (input.quantity == null) throw new SellingError(422, 'quantity is required for a quantity change');
      next.quantity = input.quantity;
      break;
    }
    case 'price_change': {
      if (input.unit_amount == null) throw new SellingError(422, 'unit_amount is required for a price change');
      next.unit_amount = input.unit_amount;
      break;
    }
    case 'plan_change': {
      if (!input.offering_id) throw new SellingError(422, 'offering_id is required for a plan change');
      const offering = await prisma.offering.findFirst({ where: { id: input.offering_id, workspace_id } });
      if (!offering) throw new SellingError(422, 'Offering is not in this workspace');
      next.offering_id = input.offering_id;
      if (input.unit_amount != null) next.unit_amount = input.unit_amount;
      if (input.quantity != null) next.quantity = input.quantity;
      break;
    }
    case 'billing_frequency_change': {
      if (!input.billing_period) {
        throw new SellingError(422, 'billing_period is required for a billing frequency change');
      }
      next.billing_period = input.billing_period;
      next.billing_interval_count = input.billing_interval_count ?? 1;
      // The current period is re-cut from the change date on the new frequency.
      const period = periodBounds(effective, next.billing_period, next.billing_interval_count);
      next.current_period_start = period.start;
      next.current_period_end = period.end;
      break;
    }
    case 'renewal': {
      const period = subscription.current_period_end
        ? nextPeriod(subscription.current_period_end, subscription.billing_period, subscription.billing_interval_count)
        : periodBounds(effective, subscription.billing_period, subscription.billing_interval_count);
      next.current_period_start = period.start;
      next.current_period_end = period.end;
      next.status = 'active';
      next.commitment_end_date =
        input.commitment_end_date ??
        (subscription.commitment_end_date
          ? addPeriod(subscription.commitment_end_date, subscription.billing_period, subscription.billing_interval_count)
          : null);
      break;
    }
    case 'pause': {
      if (subscription.status === 'paused') throw new SellingError(409, 'Subscription is already paused');
      next.status = 'paused';
      next.paused_at = effective;
      next.resumes_on = input.resumes_on ?? null;
      break;
    }
    case 'resume': {
      if (subscription.status !== 'paused') throw new SellingError(409, 'Subscription is not paused');
      next.status = 'active';
      next.paused_at = null;
      next.resumes_on = null;
      break;
    }
    case 'cancel': {
      if (subscription.status === 'canceled') throw new SellingError(409, 'Subscription is already canceled');
      // Cancelling at period end keeps serving what the customer paid for; the
      // subscription stays active until `cancellation_effective_date`.
      const endsOn = input.at_period_end ? (subscription.current_period_end ?? effective) : effective;
      next.canceled_at = new Date();
      next.cancellation_effective_date = endsOn;
      next.end_date = endsOn;
      next.status = input.at_period_end ? subscription.status : 'canceled';
      break;
    }
  }

  if (input.commitment_end_date && input.amendment_type !== 'renewal') {
    next.commitment_end_date = input.commitment_end_date;
  }

  // An amendment dated in the future is recorded, not performed: it says what
  // the subscription will become, and stays unapplied until that date arrives.
  // Applying it now would both change the agreement early and prorate it
  // against a period it does not fall in.
  const scheduled = effective > startOfDay(new Date());

  // Only a change to the recurring amount prorates; pausing, renewing, and
  // cancelling at period end do not produce a mid-period charge.
  const newPeriodAmount = periodAmount(next.quantity, next.unit_amount);
  const proratable =
    !scheduled &&
    ['quantity_change', 'price_change', 'plan_change'].includes(input.amendment_type) &&
    subscription.current_period_start != null &&
    subscription.current_period_end != null;

  const proration = proratable
    ? prorate({
        period_start: subscription.current_period_start!,
        period_end: subscription.current_period_end!,
        effective_date: effective,
        previous_amount: previousPeriodAmount,
        new_amount: newPeriodAmount,
      })
    : null;

  return prisma.$transaction(async (tx) => {
    const amendment = await tx.subscriptionAmendment.create({
      data: {
        workspace_id,
        subscription_id: subscription.id,
        amendment_type: input.amendment_type,
        effective_date: effective,
        applied_at: scheduled ? null : new Date(),
        previous_quantity: subscription.quantity,
        new_quantity: next.quantity,
        previous_unit_amount: subscription.unit_amount,
        new_unit_amount: next.unit_amount,
        previous_offering_id: subscription.offering_id,
        new_offering_id: next.offering_id,
        previous_billing_period: subscription.billing_period,
        new_billing_period: next.billing_period,
        previous_billing_interval_count: subscription.billing_interval_count,
        new_billing_interval_count: next.billing_interval_count,
        previous_status: subscription.status,
        new_status: next.status,
        previous_commitment_end_date: subscription.commitment_end_date,
        new_commitment_end_date: next.commitment_end_date,
        proration_amount: proration?.amount ?? null,
        currency_code: subscription.currency_code,
        reason: input.reason ?? null,
        created_by_user_id: input.created_by_user_id ?? null,
      },
    });

    if (scheduled) {
      return { subscription, amendment, proration };
    }

    const updated = await tx.subscription.update({ where: { id: subscription.id }, data: next });

    // Seats bought and seats usable are the same number: keep the entitlement
    // that mirrors the subscribed quantity in step with it.
    if (input.amendment_type === 'quantity_change') {
      await tx.entitlement.updateMany({
        where: { workspace_id, subscription_id: subscription.id, code: slugCode(subscription.unit_of_measure) },
        data: { included_quantity: next.quantity },
      });
    }

    return { subscription: updated, amendment, proration };
  });
}
