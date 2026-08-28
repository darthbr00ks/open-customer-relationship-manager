'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Archive, ArchiveRestore, CircleCheck, Flag, Pencil, Play } from 'lucide-react';
import { useState } from 'react';

import { NoWorkspace } from '@/components/empty-state';
import { RecordFormDialog } from '@/components/record-form-dialog';
import { RecordHeader, type RecordAction } from '@/components/record-header';
import { RecordOverview } from '@/components/record-overview';
import { RecordTabs } from '@/components/record-tabs';
import { RelatedList } from '@/components/related-list';
import { ChildFormDialog } from '@/components/selling/child-form-dialog';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api-client';
import { invalidateList, useCachedList } from '@/lib/data-cache';
import { formatCurrency, formatDate, formatDateTime, formatLabel } from '@/lib/format';
import { OBJECTS } from '@/lib/objects';
import { milestoneStatusTone, SERVICE_MILESTONE_FIELDS } from '@/lib/schema/selling-children';
import { serviceDeliveryStatusTone } from '@/lib/schema/service-delivery';
import type { ServiceDelivery, ServiceMilestone } from '@/lib/types';
import { useWorkspaceStore } from '@/stores/workspace';

const object = OBJECTS.service_deliveries;

/**
 * The work actually performed for one customer. The Offering's Service
 * Definition says what the service promises; this says what happened.
 */
export default function ServiceDeliveryRecordPage() {
  const { id } = useParams<{ id: string }>();
  const workspaceId = useWorkspaceStore((state) => state.workspaceId);

  const { rows: deliveries, loading } = useCachedList<ServiceDelivery>('service-deliveries', workspaceId, { includeArchived: true });
  const { rows: milestones } = useCachedList<ServiceMilestone>('service-milestones', workspaceId, { limit: 200 });

  const [editing, setEditing] = useState(false);
  const [addingMilestone, setAddingMilestone] = useState(false);

  if (!workspaceId) return <NoWorkspace />;
  const delivery = deliveries.find((row) => row.id === id);
  if (!delivery) {
    return <p className="text-muted-foreground text-sm">{loading ? 'Loading…' : 'Service delivery not found in this workspace.'}</p>;
  }

  const deliveryMilestones = milestones.filter((row) => row.service_delivery_id === delivery.id);

  const toggleArchive = async () => {
    if (delivery.archived_at) await api.update('service-deliveries', delivery.id, workspaceId, { archived_at: null });
    else await api.archive('service-deliveries', delivery.id, workspaceId);
    invalidateList('service-deliveries', workspaceId);
  };

  const start = async () => {
    await api.update('service-deliveries', delivery.id, workspaceId, {
      status: 'in_progress',
      actual_start_at: delivery.actual_start_at ?? new Date().toISOString(),
    });
    invalidateList('service-deliveries', workspaceId);
  };

  /** Customer acceptance is its own step: finished is not the same as accepted. */
  const accept = async () => {
    await api.update('service-deliveries', delivery.id, workspaceId, {
      status: 'accepted',
      actual_end_at: delivery.actual_end_at ?? new Date().toISOString(),
      customer_accepted_at: new Date().toISOString(),
    });
    invalidateList('service-deliveries', workspaceId);
  };

  const actions: RecordAction[] = [
    { key: 'edit', label: 'Edit', icon: Pencil, onClick: () => setEditing(true), primary: true },
    { key: 'add-milestone', label: 'Add Milestone', icon: Flag, onClick: () => setAddingMilestone(true), primary: true },
  ];
  if (delivery.status === 'not_started' || delivery.status === 'scheduled') {
    actions.push({ key: 'start', label: 'Start Work', icon: Play, onClick: () => void start() });
  }
  if (delivery.status !== 'accepted' && delivery.status !== 'canceled') {
    actions.push({ key: 'accept', label: 'Record Acceptance', icon: CircleCheck, onClick: () => void accept() });
  }
  actions.push(
    delivery.archived_at
      ? { key: 'unarchive', label: 'Unarchive', icon: ArchiveRestore, onClick: () => void toggleArchive() }
      : { key: 'archive', label: 'Archive', icon: Archive, onClick: () => void toggleArchive(), variant: 'destructive' },
  );

  return (
    <div>
      <RecordHeader
        title={delivery.name}
        archived={Boolean(delivery.archived_at)}
        actions={actions}
        badges={
          <>
            <span className="font-mono text-xs">{delivery.delivery_number}</span>
            <span>·</span>
            <Badge variant={serviceDeliveryStatusTone(delivery.status)}>{formatLabel(delivery.status)}</Badge>
            <span>·</span>
            <span className="tabular-nums">
              {delivery.hours_consumed} of {delivery.estimated_hours ?? '—'} hours
            </span>
            {delivery.scheduled_start_at ? (
              <>
                <span>·</span>
                <span>starts {formatDateTime(delivery.scheduled_start_at)}</span>
              </>
            ) : null}
          </>
        }
      />

      <RecordTabs
        noteParentType="service_delivery"
        recordId={delivery.id}
        workspaceId={workspaceId}
        overview={
          <RecordOverview
            layout={object.layout}
            row={delivery}
            workspaceId={workspaceId}
            resource={object.resource}
            recordId={delivery.id}
          />
        }
        related={
          <>
            <RelatedList
              title="Milestones"
              icon={Flag}
              rows={deliveryMilestones}
              onAdd={() => setAddingMilestone(true)}
              addLabel="Add milestone"
              emptyLabel="No milestones. This is where project billing lives — 30% at kickoff, 40% at delivery, 30% at completion."
              columns={[
                { key: 'sequence', label: '#', render: (row) => row.sequence },
                { key: 'name', label: 'Milestone', render: (row) => row.name },
                {
                  key: 'status',
                  label: 'Status',
                  render: (row) => <Badge variant={milestoneStatusTone(row.status)}>{formatLabel(row.status)}</Badge>,
                },
                {
                  key: 'billing',
                  label: 'Billing',
                  render: (row) =>
                    row.billing_amount
                      ? formatCurrency(row.billing_amount, row.currency_code ?? 'USD')
                      : row.billing_percent
                        ? `${row.billing_percent}%`
                        : '—',
                },
                { key: 'due_on', label: 'Due', render: (row) => (row.due_on ? formatDate(row.due_on) : '—') },
                {
                  key: 'completed_at',
                  label: 'Completed',
                  render: (row) => (row.completed_at ? formatDateTime(row.completed_at) : '—'),
                },
                {
                  key: 'accepted_at',
                  label: 'Accepted',
                  render: (row) => (row.accepted_at ? formatDateTime(row.accepted_at) : '—'),
                },
              ]}
            />

            {delivery.order_id ? (
              <p className="text-muted-foreground text-sm">
                Sold on{' '}
                <Link href={`/orders/${delivery.order_id}`} className="text-primary hover:underline">
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
          objectKey="service_deliveries"
          mode="edit"
          workspaceId={workspaceId}
          recordId={delivery.id}
          initialValues={delivery}
        />
      ) : null}
      {addingMilestone ? (
        <ChildFormDialog
          open
          onOpenChange={setAddingMilestone}
          title="Add a milestone"
          resource="service-milestones"
          fields={SERVICE_MILESTONE_FIELDS}
          fixed={{ service_delivery_id: delivery.id }}
          initialValues={{ sequence: deliveryMilestones.length, status: 'pending' }}
          workspaceId={workspaceId}
        />
      ) : null}
    </div>
  );
}
