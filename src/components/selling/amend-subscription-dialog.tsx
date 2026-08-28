'use client';

import { useState } from 'react';

import { FieldInput } from '@/components/fields/field-input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { api, ApiError } from '@/lib/api-client';
import { invalidateList } from '@/lib/data-cache';
import { formatCurrency } from '@/lib/format';
import { AMENDMENT_FIELDS } from '@/lib/schema/selling-children';
import type { FieldDef } from '@/lib/schema/types';
import type { Subscription, SubscriptionAmendment } from '@/lib/types';
import { useCurrentUserStore } from '@/stores/current-user';

type Row = Record<string, unknown>;

/**
 * Which inputs an amendment actually needs. Showing all of them for every kind
 * of change invites nonsense — a pause does not take a new unit price — so each
 * type asks only for what it applies.
 */
const FIELDS_BY_TYPE: Record<string, string[]> = {
  quantity_change: ['effective_date', 'quantity', 'reason'],
  price_change: ['effective_date', 'unit_amount', 'reason'],
  plan_change: ['effective_date', 'offering_id', 'unit_amount', 'quantity', 'reason'],
  billing_frequency_change: ['effective_date', 'billing_period', 'billing_interval_count', 'reason'],
  renewal: ['effective_date', 'commitment_end_date', 'reason'],
  pause: ['effective_date', 'resumes_on', 'reason'],
  resume: ['effective_date', 'reason'],
  cancel: ['effective_date', 'at_period_end', 'reason'],
};

/**
 * Amend a subscription without losing what it used to say.
 *
 * The change is recorded as an amendment carrying the before and after values
 * and any prorated charge; the subscription is then updated from it. The
 * response says what the proration came to, which is the number a customer will
 * ask about.
 */
export function AmendSubscriptionDialog({
  open,
  onOpenChange,
  subscription,
  workspaceId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscription: Subscription;
  workspaceId: string;
}) {
  const currentUserId = useCurrentUserStore((state) => state.userId);
  const [form, setForm] = useState<Row>({ amendment_type: 'quantity_change', quantity: Number(subscription.quantity) });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SubscriptionAmendment | null>(null);

  const amendmentType = String(form.amendment_type ?? 'quantity_change');
  const visible = new Set(FIELDS_BY_TYPE[amendmentType] ?? []);
  const fields: FieldDef[] = AMENDMENT_FIELDS.filter(
    (field) => field.key === 'amendment_type' || visible.has(field.key),
  );

  const set = (key: string, value: unknown) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = Object.fromEntries(
        Object.entries(form).filter(([key, value]) => (visible.has(key) || key === 'amendment_type') && value !== '' && value !== undefined),
      );
      const response = await api.action<{ amendment: SubscriptionAmendment }>(
        'subscriptions',
        subscription.id,
        'amend',
        workspaceId,
        { ...payload, created_by_user_id: currentUserId },
      );

      for (const resource of ['subscriptions', 'subscription-amendments', 'entitlements'] as const) {
        invalidateList(resource, workspaceId);
      }
      setResult(response.amendment);
    } catch (caught) {
      setError(caught instanceof ApiError ? String(caught.message) : 'Could not amend this subscription.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        {result ? (
          <>
            <DialogHeader>
              <DialogTitle>Amendment recorded</DialogTitle>
              <DialogDescription>
                The original agreement is untouched — this change is its own record.
              </DialogDescription>
            </DialogHeader>
            <p className="py-4 text-sm">
              {result.proration_amount == null || result.proration_amount === '0' ? (
                'No prorated charge for this change.'
              ) : (
                <>
                  Prorated for the remainder of the period:{' '}
                  <strong className="tabular-nums">
                    {formatCurrency(result.proration_amount, result.currency_code ?? subscription.currency_code)}
                  </strong>
                  {result.proration_amount.startsWith('-') ? ' (a credit)' : ''}
                </>
              )}
            </p>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={submit}>
            <DialogHeader>
              <DialogTitle>Amend {subscription.name}</DialogTitle>
              <DialogDescription>
                Currently {subscription.quantity} {subscription.unit_of_measure} at{' '}
                {formatCurrency(subscription.unit_amount, subscription.currency_code)} per {subscription.billing_period}.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              {fields.map((field) => (
                <div key={field.key}>
                  <Label htmlFor={`amend-${field.key}`} className="mb-1.5">
                    {field.label}
                  </Label>
                  <FieldInput
                    id={`amend-${field.key}`}
                    field={field}
                    value={form[field.key]}
                    onChange={(value) => set(field.key, value)}
                    workspaceId={workspaceId}
                  />
                  {field.helpText ? <p className="text-muted-foreground mt-1 text-xs">{field.helpText}</p> : null}
                </div>
              ))}
            </div>

            {error ? <p className="text-destructive text-sm">{error}</p> : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Applying…' : 'Apply amendment'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
