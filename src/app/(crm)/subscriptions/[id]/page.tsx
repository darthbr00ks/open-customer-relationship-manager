'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Activity, Archive, ArchiveRestore, GitCompareArrows, Key, Pencil, Plus } from 'lucide-react';
import { useState } from 'react';

import { NoWorkspace } from '@/components/empty-state';
import { RecordFormDialog } from '@/components/record-form-dialog';
import { RecordHeader, type RecordAction } from '@/components/record-header';
import { RecordOverview } from '@/components/record-overview';
import { RecordTabs } from '@/components/record-tabs';
import { RelatedList } from '@/components/related-list';
import { AmendSubscriptionDialog } from '@/components/selling/amend-subscription-dialog';
import { ChildFormDialog } from '@/components/selling/child-form-dialog';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api-client';
import { invalidateList, useCachedList } from '@/lib/data-cache';
import { formatCurrency, formatDate, formatDateTime, formatLabel } from '@/lib/format';
import { OBJECTS } from '@/lib/objects';
import { ENTITLEMENT_FIELDS, USAGE_RECORD_FIELDS } from '@/lib/schema/selling-children';
import { subscriptionStatusTone } from '@/lib/schema/subscription';
import { subtract } from '@/lib/selling/money';
import type { Entitlement, Subscription, SubscriptionAmendment, UsageRecord } from '@/lib/types';
import { useWorkspaceStore } from '@/stores/workspace';

const object = OBJECTS.subscriptions;

/**
 * A subscription is the agreement that outlives the sale. Its entitlements say
 * what may be used, its usage says what has been, and its amendments say how it
 * got from what was signed to what it is now.
 */
export default function SubscriptionRecordPage() {
  const { id } = useParams<{ id: string }>();
  const workspaceId = useWorkspaceStore((state) => state.workspaceId);

  const { rows: subscriptions, loading } = useCachedList<Subscription>('subscriptions', workspaceId, { includeArchived: true });
  const { rows: entitlements } = useCachedList<Entitlement>('entitlements', workspaceId, { limit: 200 });
  const { rows: amendments } = useCachedList<SubscriptionAmendment>('subscription-amendments', workspaceId, { limit: 200 });
  const { rows: usage } = useCachedList<UsageRecord>('usage-records', workspaceId, { limit: 200 });

  const [editing, setEditing] = useState(false);
  const [amending, setAmending] = useState(false);
  const [addingEntitlement, setAddingEntitlement] = useState(false);
  const [recordingUsageFor, setRecordingUsageFor] = useState<Entitlement | null>(null);

  if (!workspaceId) return <NoWorkspace />;
  const subscription = subscriptions.find((row) => row.id === id);
  if (!subscription) {
    return <p className="text-muted-foreground text-sm">{loading ? 'Loading…' : 'Subscription not found in this workspace.'}</p>;
  }

  const subscriptionEntitlements = entitlements.filter((row) => row.subscription_id === subscription.id);
  const subscriptionAmendments = amendments.filter((row) => row.subscription_id === subscription.id);
  const subscriptionUsage = usage.filter((row) => row.subscription_id === subscription.id);

  const toggleArchive = async () => {
    if (subscription.archived_at) await api.update('subscriptions', subscription.id, workspaceId, { archived_at: null });
    else await api.archive('subscriptions', subscription.id, workspaceId);
    invalidateList('subscriptions', workspaceId);
  };

  const actions: RecordAction[] = [
    { key: 'edit', label: 'Edit', icon: Pencil, onClick: () => setEditing(true), primary: true },
    { key: 'amend', label: 'Amend', icon: GitCompareArrows, onClick: () => setAmending(true), primary: true },
    { key: 'add-entitlement', label: 'Add Entitlement', icon: Key, onClick: () => setAddingEntitlement(true) },
    subscription.archived_at
      ? { key: 'unarchive', label: 'Unarchive', icon: ArchiveRestore, onClick: () => void toggleArchive() }
      : { key: 'archive', label: 'Archive', icon: Archive, onClick: () => void toggleArchive(), variant: 'destructive' },
  ];

  return (
    <div>
      <RecordHeader
        title={subscription.name}
        archived={Boolean(subscription.archived_at)}
        actions={actions}
        badges={
          <>
            <span className="font-mono text-xs">{subscription.subscription_number}</span>
            <span>·</span>
            <Badge variant={subscriptionStatusTone(subscription.status)}>{formatLabel(subscription.status)}</Badge>
            <span>·</span>
            <span className="tabular-nums">
              {subscription.quantity} {subscription.unit_of_measure} ×{' '}
              {formatCurrency(subscription.unit_amount, subscription.currency_code)} per {subscription.billing_period}
            </span>
            {subscription.current_period_end ? (
              <>
                <span>·</span>
                <span>period ends {formatDate(subscription.current_period_end)}</span>
              </>
            ) : null}
            {/* Cancellation requested but service still running is a real state,
                not a contradiction, so the header says both. */}
            {subscription.cancellation_effective_date && subscription.status !== 'canceled' ? (
              <>
                <span>·</span>
                <Badge variant="destructive">ends {formatDate(subscription.cancellation_effective_date)}</Badge>
              </>
            ) : null}
          </>
        }
      />

      <RecordTabs
        noteParentType="subscription"
        recordId={subscription.id}
        workspaceId={workspaceId}
        overview={
          <RecordOverview
            layout={object.layout}
            row={subscription}
            workspaceId={workspaceId}
            resource={object.resource}
            recordId={subscription.id}
          />
        }
        related={
          <>
            <RelatedList
              title="Entitlements"
              icon={Key}
              rows={subscriptionEntitlements}
              onAdd={() => setAddingEntitlement(true)}
              addLabel="Add entitlement"
              emptyLabel="Nothing granted yet. A subscription says what was bought; an entitlement says what may be used."
              columns={[
                { key: 'name', label: 'Entitlement', render: (row) => row.name },
                { key: 'code', label: 'Code', render: (row) => <span className="font-mono text-xs">{row.code}</span> },
                {
                  key: 'included_quantity',
                  label: 'Included',
                  render: (row) =>
                    row.is_unlimited ? 'Unlimited' : (row.included_quantity ?? <span className="text-muted-foreground">Access</span>),
                },
                { key: 'used_quantity', label: 'Used', render: (row) => <span className="tabular-nums">{row.used_quantity}</span> },
                {
                  key: 'remaining',
                  label: 'Remaining',
                  render: (row) => {
                    if (row.is_unlimited || row.included_quantity == null) return <span className="text-muted-foreground">—</span>;
                    const remaining = subtract(row.included_quantity, row.used_quantity);
                    return (
                      <span className={`tabular-nums ${remaining.startsWith('-') ? 'text-destructive font-medium' : ''}`}>
                        {remaining}
                      </span>
                    );
                  },
                },
                {
                  key: 'overage_unit_amount',
                  label: 'Overage',
                  render: (row) =>
                    row.overage_unit_amount
                      ? `${formatCurrency(row.overage_unit_amount, row.currency_code ?? 'USD')} per ${row.unit_of_measure}`
                      : '—',
                },
                {
                  key: 'record-usage',
                  label: '',
                  render: (row) => (
                    <button
                      type="button"
                      className="text-primary text-xs hover:underline"
                      onClick={(event) => {
                        event.stopPropagation();
                        setRecordingUsageFor(row);
                      }}
                    >
                      <Plus className="inline size-3" /> Usage
                    </button>
                  ),
                },
              ]}
            />

            <RelatedList
              title="Amendments"
              icon={GitCompareArrows}
              rows={subscriptionAmendments}
              onAdd={() => setAmending(true)}
              addLabel="Amend"
              emptyLabel="Unchanged since it started."
              columns={[
                { key: 'amendment_type', label: 'Change', render: (row) => formatLabel(row.amendment_type) },
                { key: 'effective_date', label: 'Effective', render: (row) => formatDate(row.effective_date) },
                {
                  key: 'from',
                  label: 'From',
                  render: (row) => <AmendmentSide amendment={row} side="previous" />,
                },
                {
                  key: 'to',
                  label: 'To',
                  render: (row) => <AmendmentSide amendment={row} side="new" />,
                },
                {
                  key: 'proration_amount',
                  label: 'Proration',
                  render: (row) =>
                    row.proration_amount == null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <span className="tabular-nums">{formatCurrency(row.proration_amount, row.currency_code ?? 'USD')}</span>
                    ),
                },
                { key: 'reason', label: 'Reason', render: (row) => row.reason ?? '—' },
              ]}
            />

            <RelatedList
              title="Usage"
              icon={Activity}
              rows={subscriptionUsage}
              emptyLabel="Nothing metered yet."
              columns={[
                { key: 'metric_code', label: 'Metric', render: (row) => <span className="font-mono text-xs">{row.metric_code}</span> },
                {
                  key: 'quantity',
                  label: 'Quantity',
                  render: (row) => (
                    <span className="tabular-nums">
                      {row.quantity} {row.unit_of_measure}
                    </span>
                  ),
                },
                { key: 'occurred_at', label: 'Occurred', render: (row) => formatDateTime(row.occurred_at) },
                { key: 'source', label: 'Source', render: (row) => row.source ?? '—' },
                { key: 'external_reference', label: 'Reference', render: (row) => row.external_reference ?? '—' },
              ]}
            />

            {subscription.order_id ? (
              <p className="text-muted-foreground text-sm">
                Sold on{' '}
                <Link href={`/orders/${subscription.order_id}`} className="text-primary hover:underline">
                  its original order
                </Link>
                .
              </p>
            ) : null}
          </>
        }
      />

      {editing ? (
        <RecordFormDialog
          open
          onOpenChange={setEditing}
          objectKey="subscriptions"
          mode="edit"
          workspaceId={workspaceId}
          recordId={subscription.id}
          initialValues={subscription}
        />
      ) : null}
      {amending ? (
        <AmendSubscriptionDialog
          open
          onOpenChange={setAmending}
          subscription={subscription}
          workspaceId={workspaceId}
        />
      ) : null}
      {addingEntitlement ? (
        <ChildFormDialog
          open
          onOpenChange={setAddingEntitlement}
          title="Add an entitlement"
          description="What the customer may use: 25 users, 100 GB, premium support, four training sessions."
          resource="entitlements"
          fields={ENTITLEMENT_FIELDS}
          fixed={{ subscription_id: subscription.id, entity_id: subscription.entity_id }}
          initialValues={{ unit_of_measure: subscription.unit_of_measure, currency_code: subscription.currency_code, is_unlimited: false }}
          workspaceId={workspaceId}
        />
      ) : null}
      {recordingUsageFor ? (
        <ChildFormDialog
          open
          onOpenChange={(open) => !open && setRecordingUsageFor(null)}
          title={`Record usage against ${recordingUsageFor.name}`}
          description="Recording usage also rolls it onto the entitlement's running total."
          resource="usage-records"
          fields={USAGE_RECORD_FIELDS}
          fixed={{
            entitlement_id: recordingUsageFor.id,
            subscription_id: subscription.id,
            entity_id: subscription.entity_id,
          }}
          initialValues={{
            metric_code: recordingUsageFor.code,
            unit_of_measure: recordingUsageFor.unit_of_measure,
          }}
          workspaceId={workspaceId}
          onSaved={() => {
            invalidateList('entitlements', workspaceId);
            setRecordingUsageFor(null);
          }}
        />
      ) : null}
    </div>
  );
}

/** The before or after of an amendment, showing only the fields it actually changed. */
function AmendmentSide({ amendment, side }: { amendment: SubscriptionAmendment; side: 'previous' | 'new' }) {
  const parts: string[] = [];
  const pick = <T,>(previous: T, next: T) => (side === 'previous' ? previous : next);

  if (amendment.previous_quantity !== amendment.new_quantity) {
    parts.push(`${pick(amendment.previous_quantity, amendment.new_quantity)} units`);
  }
  if (amendment.previous_unit_amount !== amendment.new_unit_amount) {
    parts.push(formatCurrency(pick(amendment.previous_unit_amount, amendment.new_unit_amount), amendment.currency_code ?? 'USD'));
  }
  if (amendment.previous_billing_period !== amendment.new_billing_period) {
    parts.push(`per ${pick(amendment.previous_billing_period, amendment.new_billing_period)}`);
  }
  if (amendment.previous_status !== amendment.new_status) {
    parts.push(formatLabel(pick(amendment.previous_status, amendment.new_status)));
  }

  return parts.length === 0 ? <span className="text-muted-foreground">—</span> : <span>{parts.join(' · ')}</span>;
}
