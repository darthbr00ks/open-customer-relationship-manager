'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Archive, ArchiveRestore, CircleCheck, CircleX, FileText, Pencil, Send } from 'lucide-react';
import { useState } from 'react';

import { NoWorkspace } from '@/components/empty-state';
import { RecordFormDialog } from '@/components/record-form-dialog';
import { RecordHeader, type RecordAction } from '@/components/record-header';
import { RecordOverview } from '@/components/record-overview';
import { RecordTabs } from '@/components/record-tabs';
import { RelatedList } from '@/components/related-list';
import { DocumentTotals, transactionLineColumns } from '@/components/selling/lines';
import { Badge } from '@/components/ui/badge';
import { api, ApiError } from '@/lib/api-client';
import { invalidateList, useCachedList } from '@/lib/data-cache';
import { formatCurrency, formatDate, formatLabel } from '@/lib/format';
import { OBJECTS } from '@/lib/objects';
import { quoteStatusTone } from '@/lib/schema/quote';
import type { Order, Quote, QuoteLine } from '@/lib/types';
import { useCurrentUserStore } from '@/stores/current-user';
import { useWorkspaceStore } from '@/stores/workspace';

const object = OBJECTS.quotes;

export default function QuoteRecordPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const workspaceId = useWorkspaceStore((state) => state.workspaceId);
  const currentUserId = useCurrentUserStore((state) => state.userId);

  const { rows: quotes, loading } = useCachedList<Quote>('quotes', workspaceId, { includeArchived: true });
  const { rows: lines } = useCachedList<QuoteLine>('quote-lines', workspaceId, { limit: 200 });
  const { rows: orders } = useCachedList<Order>('orders', workspaceId);

  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!workspaceId) return <NoWorkspace />;
  const quote = quotes.find((row) => row.id === id);
  if (!quote) {
    return <p className="text-muted-foreground text-sm">{loading ? 'Loading…' : 'Quote not found in this workspace.'}</p>;
  }

  const quoteLines = lines.filter((line) => line.quote_id === quote.id);
  const quoteOrders = orders.filter((order) => order.quote_id === quote.id);
  const isOpen = quote.status === 'draft' || quote.status === 'sent';

  const toggleArchive = async () => {
    if (quote.archived_at) await api.update('quotes', quote.id, workspaceId, { archived_at: null });
    else await api.archive('quotes', quote.id, workspaceId);
    invalidateList('quotes', workspaceId);
  };

  const markSent = async () => {
    await api.update('quotes', quote.id, workspaceId, { status: 'sent', sent_at: new Date().toISOString() });
    invalidateList('quotes', workspaceId);
  };

  const decline = async () => {
    await api.update('quotes', quote.id, workspaceId, { status: 'declined', declined_at: new Date().toISOString() });
    invalidateList('quotes', workspaceId);
  };

  /**
   * Accepting is one action on purpose: the order has to carry this quote's
   * snapshot exactly, and the subscriptions, engagements, and stock
   * reservations its lines promised have to be opened with it.
   */
  const accept = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await api.action<{ order: Order }>('quotes', quote.id, 'accept', workspaceId, {
        created_by_user_id: currentUserId,
      });
      for (const resource of ['quotes', 'orders', 'order-lines', 'subscriptions', 'entitlements', 'service-deliveries', 'inventory-items'] as const) {
        invalidateList(resource, workspaceId);
      }
      router.push(`/orders/${result.order.id}`);
    } catch (caught) {
      setError(caught instanceof ApiError ? String(caught.message) : 'Could not accept this quote.');
    } finally {
      setBusy(false);
    }
  };

  const actions: RecordAction[] = [
    { key: 'edit', label: 'Edit', icon: Pencil, onClick: () => setEditing(true), primary: true },
  ];
  if (isOpen) {
    actions.push(
      { key: 'accept', label: busy ? 'Accepting…' : 'Accept', icon: CircleCheck, onClick: () => void accept(), primary: true },
      { key: 'send', label: 'Mark Sent', icon: Send, onClick: () => void markSent() },
      { key: 'decline', label: 'Mark Declined', icon: CircleX, onClick: () => void decline(), variant: 'destructive' },
    );
  }
  actions.push(
    quote.archived_at
      ? { key: 'unarchive', label: 'Unarchive', icon: ArchiveRestore, onClick: () => void toggleArchive() }
      : { key: 'archive', label: 'Archive', icon: Archive, onClick: () => void toggleArchive(), variant: 'destructive' },
  );

  return (
    <div>
      <RecordHeader
        title={quote.name}
        archived={Boolean(quote.archived_at)}
        actions={actions}
        badges={
          <>
            <span className="font-mono text-xs">{quote.quote_number}</span>
            <span>·</span>
            <Badge variant={quoteStatusTone(quote.status)}>{formatLabel(quote.status)}</Badge>
            <span>·</span>
            <span className="tabular-nums">{formatCurrency(quote.total_amount, quote.currency_code)}</span>
            {quote.valid_until ? (
              <>
                <span>·</span>
                <span>valid until {formatDate(quote.valid_until)}</span>
              </>
            ) : null}
          </>
        }
      />

      {error ? <p className="text-destructive pt-4 text-sm">{error}</p> : null}

      <RecordTabs
        noteParentType="quote"
        recordId={quote.id}
        workspaceId={workspaceId}
        overview={
          <RecordOverview
            layout={object.layout}
            row={quote}
            workspaceId={workspaceId}
            resource={object.resource}
            recordId={quote.id}
          />
        }
        related={
          <>
            <RelatedList
              title="Quote lines"
              icon={FileText}
              rows={quoteLines}
              emptyLabel="No lines. A quote is usually built from a deal — use Create Quote on the deal."
              columns={transactionLineColumns<QuoteLine>({ optional: true })}
            />
            <DocumentTotals
              currency={quote.currency_code}
              subtotal={quote.subtotal_amount}
              discount={quote.discount_amount}
              tax={quote.tax_amount}
              total={quote.total_amount}
            />

            {quoteOrders.length > 0 ? (
              <RelatedList
                title="Orders"
                rows={quoteOrders}
                href={(row) => `/orders/${row.id}`}
                columns={[
                  {
                    key: 'order_number',
                    label: 'Order',
                    render: (row) => (
                      <Link href={`/orders/${row.id}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
                        {row.order_number}
                      </Link>
                    ),
                  },
                  { key: 'status', label: 'Status', render: (row) => formatLabel(row.status) },
                  { key: 'fulfillment_status', label: 'Fulfillment', render: (row) => formatLabel(row.fulfillment_status) },
                  {
                    key: 'total_amount',
                    label: 'Total',
                    render: (row) => <span className="tabular-nums">{formatCurrency(row.total_amount, row.currency_code)}</span>,
                  },
                ]}
              />
            ) : null}
          </>
        }
      />

      {editing ? (
        <RecordFormDialog
          open
          onOpenChange={setEditing}
          objectKey="quotes"
          mode="edit"
          workspaceId={workspaceId}
          recordId={quote.id}
          initialValues={quote}
        />
      ) : null}
    </div>
  );
}
