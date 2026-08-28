'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Archive, ArchiveRestore, CircleCheck, CircleX, FileText, ListPlus, Pencil, RefreshCw } from 'lucide-react';
import { useState } from 'react';

import { NoWorkspace } from '@/components/empty-state';
import { ChangeStageDialog, CloseLostDialog, closeDealWon } from '@/components/deal-stage-dialogs';
import { RecordFormDialog } from '@/components/record-form-dialog';
import { RecordHeader, type RecordAction } from '@/components/record-header';
import { RecordOverview } from '@/components/record-overview';
import { RecordTabs } from '@/components/record-tabs';
import { RelatedList } from '@/components/related-list';
import { ChildFormDialog } from '@/components/selling/child-form-dialog';
import { Badge } from '@/components/ui/badge';
import { api, ApiError } from '@/lib/api-client';
import { invalidateList, useCachedList } from '@/lib/data-cache';
import { formatCurrency, formatDate, formatLabel } from '@/lib/format';
import { dealStageTone } from '@/lib/schema/deal';
import { quoteStatusTone } from '@/lib/schema/quote';
import { DEAL_LINE_FIELDS } from '@/lib/schema/selling-children';
import { OBJECTS } from '@/lib/objects';
import type { Deal, DealLine, Offering, Quote } from '@/lib/types';
import { useCurrentUserStore } from '@/stores/current-user';
import { useWorkspaceStore } from '@/stores/workspace';

const object = OBJECTS.deals;

export default function DealRecordPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const workspaceId = useWorkspaceStore((state) => state.workspaceId);
  const currentUser = useCurrentUserStore();

  const { rows: deals, loading } = useCachedList<Deal>('deals', workspaceId, { includeArchived: true });
  const { rows: dealLines } = useCachedList<DealLine>('deal-lines', workspaceId, { limit: 200 });
  const { rows: offerings } = useCachedList<Offering>('offerings', workspaceId, { includeArchived: true });
  const { rows: quotes } = useCachedList<Quote>('quotes', workspaceId, { includeArchived: true });

  const [editing, setEditing] = useState(false);
  const [changingStage, setChangingStage] = useState(false);
  const [closingLost, setClosingLost] = useState(false);
  const [addingLine, setAddingLine] = useState(false);
  const [quoting, setQuoting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!workspaceId) return <NoWorkspace />;
  const deal = deals.find((row) => row.id === id);
  if (!deal) {
    return <p className="text-muted-foreground text-sm">{loading ? 'Loading…' : 'Deal not found in this workspace.'}</p>;
  }

  const isClosed = deal.stage === 'won' || deal.stage === 'lost';
  const lines = dealLines.filter((line) => line.deal_id === deal.id);
  const dealQuotes = quotes.filter((quote) => quote.deal_id === deal.id);

  const toggleArchive = async () => {
    if (deal.archived_at) await api.update('deals', deal.id, workspaceId, { archived_at: null });
    else await api.archive('deals', deal.id, workspaceId);
    invalidateList('deals', workspaceId);
  };

  /**
   * Deal lines point at the live catalog; a quote does not. Building one prices
   * every line once and copies what the customer will see onto it, so a later
   * catalog change cannot rewrite the proposal.
   */
  const createQuote = async () => {
    setQuoting(true);
    setError(null);
    try {
      const result = await api.action<{ quote: Quote }>('deals', deal.id, 'quote', workspaceId, {
        created_by_user_id: currentUser.userId,
        owner_user_id: deal.owner_user_id,
      });
      invalidateList('quotes', workspaceId);
      invalidateList('quote-lines', workspaceId);
      router.push(`/quotes/${result.quote.id}`);
    } catch (caught) {
      setError(caught instanceof ApiError ? String(caught.message) : 'Could not build a quote from this deal.');
    } finally {
      setQuoting(false);
    }
  };

  const actions: RecordAction[] = [
    { key: 'edit', label: 'Edit', icon: Pencil, onClick: () => setEditing(true), primary: true },
    { key: 'add-line', label: 'Add Line', icon: ListPlus, onClick: () => setAddingLine(true), primary: true },
    {
      key: 'create-quote',
      label: quoting ? 'Building…' : 'Create Quote',
      icon: FileText,
      onClick: () => void createQuote(),
      primary: true,
    },
    { key: 'change-stage', label: 'Change Stage', icon: RefreshCw, onClick: () => setChangingStage(true) },
  ];
  if (!isClosed) {
    actions.push(
      { key: 'close-won', label: 'Close Won', icon: CircleCheck, onClick: () => void closeDealWon(deal.id, workspaceId, currentUser.userId) },
      { key: 'close-lost', label: 'Close Lost', icon: CircleX, onClick: () => setClosingLost(true), variant: 'destructive' },
    );
  }
  actions.push(
    deal.archived_at
      ? { key: 'unarchive', label: 'Unarchive', icon: ArchiveRestore, onClick: () => void toggleArchive() }
      : { key: 'archive', label: 'Archive', icon: Archive, onClick: () => void toggleArchive(), variant: 'destructive' },
  );

  return (
    <div>
      <RecordHeader
        title={deal.name}
        archived={Boolean(deal.archived_at)}
        actions={actions}
        badges={
          <>
            <Badge variant={dealStageTone(deal.stage)}>{formatLabel(deal.stage)}</Badge>
            <span>·</span>
            <span className="tabular-nums">{formatCurrency(deal.amount, deal.currency_code)}</span>
          </>
        }
      />

      {error ? <p className="text-destructive pt-4 text-sm">{error}</p> : null}

      <RecordTabs
        noteParentType="deal"
        recordId={deal.id}
        workspaceId={workspaceId}
        overview={
          <RecordOverview
            layout={object.layout}
            row={deal}
            workspaceId={workspaceId}
            resource={object.resource}
            recordId={deal.id}
          />
        }
        related={
          <>
            <RelatedList
              title="Products under consideration"
              icon={ListPlus}
              rows={lines}
              onAdd={() => setAddingLine(true)}
              addLabel="Add line"
              emptyLabel="Nothing on this deal yet. Deal lines are working notes — they price from the live catalog every time."
              columns={[
                { key: 'name', label: 'Line', render: (row) => row.name },
                {
                  key: 'offering_id',
                  label: 'Offering',
                  render: (row) => {
                    const offering = offerings.find((candidate) => candidate.id === row.offering_id);
                    return offering ? (
                      <Link href={`/offerings/${offering.id}`} className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                        {offering.sku}
                      </Link>
                    ) : (
                      'Unknown'
                    );
                  },
                },
                { key: 'quantity', label: 'Quantity', render: (row) => <span className="tabular-nums">{row.quantity}</span> },
                {
                  key: 'unit_amount',
                  label: 'Negotiated price',
                  render: (row) =>
                    row.unit_amount ? (
                      <span className="tabular-nums">{formatCurrency(row.unit_amount, row.currency_code)}</span>
                    ) : (
                      <span className="text-muted-foreground">Catalog</span>
                    ),
                },
                {
                  key: 'discount',
                  label: 'Discount',
                  render: (row) =>
                    row.discount_type
                      ? row.discount_type === 'percentage'
                        ? `${row.discount_value}%`
                        : formatCurrency(row.discount_value, row.currency_code)
                      : '—',
                },
                { key: 'term_months', label: 'Term', render: (row) => (row.term_months ? `${row.term_months} mo` : '—') },
              ]}
            />

            <RelatedList
              title="Quotes"
              icon={FileText}
              rows={dealQuotes}
              onAdd={lines.length > 0 ? () => void createQuote() : undefined}
              addLabel="Create quote"
              emptyLabel="No proposal yet. Creating a quote snapshots the catalog so a later price change cannot alter it."
              href={(row) => `/quotes/${row.id}`}
              columns={[
                {
                  key: 'quote_number',
                  label: 'Quote',
                  render: (row) => (
                    <Link href={`/quotes/${row.id}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
                      {row.quote_number}
                    </Link>
                  ),
                },
                { key: 'name', label: 'Name', render: (row) => row.name },
                {
                  key: 'status',
                  label: 'Status',
                  render: (row) => <Badge variant={quoteStatusTone(row.status)}>{formatLabel(row.status)}</Badge>,
                },
                {
                  key: 'total_amount',
                  label: 'Total',
                  render: (row) => <span className="tabular-nums">{formatCurrency(row.total_amount, row.currency_code)}</span>,
                },
                { key: 'valid_until', label: 'Valid until', render: (row) => (row.valid_until ? formatDate(row.valid_until) : '—') },
              ]}
            />
          </>
        }
      />

      {editing ? (
        <RecordFormDialog open onOpenChange={setEditing} objectKey="deals" mode="edit" workspaceId={workspaceId} recordId={deal.id} initialValues={deal} />
      ) : null}
      {changingStage ? (
        <ChangeStageDialog open onOpenChange={setChangingStage} dealId={deal.id} currentStage={deal.stage} workspaceId={workspaceId} />
      ) : null}
      {closingLost ? <CloseLostDialog open onOpenChange={setClosingLost} dealId={deal.id} workspaceId={workspaceId} /> : null}
      {addingLine ? (
        <ChildFormDialog
          open
          onOpenChange={setAddingLine}
          title="Add a product to this deal"
          description="Priced from the live catalog until a quote is built."
          resource="deal-lines"
          fields={DEAL_LINE_FIELDS}
          fixed={{ deal_id: deal.id, created_by_user_id: currentUser.userId }}
          initialValues={{ quantity: 1, currency_code: deal.currency_code, sort_order: lines.length }}
          workspaceId={workspaceId}
        />
      ) : null}
    </div>
  );
}
