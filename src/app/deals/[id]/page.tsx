'use client';

import { useParams } from 'next/navigation';
import { Archive, ArchiveRestore, CircleCheck, CircleX, Pencil, RefreshCw } from 'lucide-react';
import { useState } from 'react';

import { NoWorkspace } from '@/components/empty-state';
import { ChangeStageDialog, CloseLostDialog, closeDealWon } from '@/components/deal-stage-dialogs';
import { RecordFormDialog } from '@/components/record-form-dialog';
import { RecordHeader, type RecordAction } from '@/components/record-header';
import { RecordOverview } from '@/components/record-overview';
import { RecordTabs } from '@/components/record-tabs';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api-client';
import { invalidateList, useCachedList } from '@/lib/data-cache';
import { formatCurrency, formatLabel } from '@/lib/format';
import { dealStageTone } from '@/lib/schema/deal';
import { OBJECTS } from '@/lib/objects';
import type { Deal } from '@/lib/types';
import { useCurrentUserStore } from '@/stores/current-user';
import { useWorkspaceStore } from '@/stores/workspace';

const object = OBJECTS.deals;

export default function DealRecordPage() {
  const { id } = useParams<{ id: string }>();
  const workspaceId = useWorkspaceStore((state) => state.workspaceId);
  const currentUser = useCurrentUserStore();

  const { rows: deals, loading } = useCachedList<Deal>('deals', workspaceId, { includeArchived: true });

  const [editing, setEditing] = useState(false);
  const [changingStage, setChangingStage] = useState(false);
  const [closingLost, setClosingLost] = useState(false);

  if (!workspaceId) return <NoWorkspace />;
  const deal = deals.find((row) => row.id === id);
  if (!deal) {
    return <p className="text-muted-foreground text-sm">{loading ? 'Loading…' : 'Deal not found in this workspace.'}</p>;
  }

  const isClosed = deal.stage === 'won' || deal.stage === 'lost';

  const toggleArchive = async () => {
    if (deal.archived_at) await api.update('deals', deal.id, workspaceId, { archived_at: null });
    else await api.archive('deals', deal.id, workspaceId);
    invalidateList('deals', workspaceId);
  };

  const actions: RecordAction[] = [
    { key: 'edit', label: 'Edit', icon: Pencil, onClick: () => setEditing(true), primary: true },
    { key: 'change-stage', label: 'Change Stage', icon: RefreshCw, onClick: () => setChangingStage(true), primary: true },
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

      <RecordTabs
        noteParentType="deal"
        recordId={deal.id}
        workspaceId={workspaceId}
        overview={<RecordOverview layout={object.layout} row={deal} workspaceId={workspaceId} />}
      />

      {editing ? (
        <RecordFormDialog open onOpenChange={setEditing} objectKey="deals" mode="edit" workspaceId={workspaceId} recordId={deal.id} initialValues={deal} />
      ) : null}
      {changingStage ? (
        <ChangeStageDialog open onOpenChange={setChangingStage} dealId={deal.id} currentStage={deal.stage} workspaceId={workspaceId} />
      ) : null}
      {closingLost ? <CloseLostDialog open onOpenChange={setClosingLost} dealId={deal.id} workspaceId={workspaceId} /> : null}
    </div>
  );
}
