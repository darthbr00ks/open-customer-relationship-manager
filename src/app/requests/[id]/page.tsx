'use client';

import { useParams } from 'next/navigation';
import { Archive, ArchiveRestore, Pencil } from 'lucide-react';
import { useState } from 'react';

import { NoWorkspace } from '@/components/empty-state';
import { RecordFormDialog } from '@/components/record-form-dialog';
import { RecordHeader, type RecordAction } from '@/components/record-header';
import { RecordOverview } from '@/components/record-overview';
import { RecordTabs } from '@/components/record-tabs';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api-client';
import { invalidateList, useCachedList } from '@/lib/data-cache';
import { formatLabel } from '@/lib/format';
import { requestPriorityTone, requestStatusTone } from '@/lib/schema/request';
import { OBJECTS } from '@/lib/objects';
import type { FeatureRequest } from '@/lib/types';
import { useWorkspaceStore } from '@/stores/workspace';

const object = OBJECTS.requests;

export default function RequestRecordPage() {
  const { id } = useParams<{ id: string }>();
  const workspaceId = useWorkspaceStore((state) => state.workspaceId);

  const { rows: requests, loading } = useCachedList<FeatureRequest>('requests', workspaceId, { includeArchived: true });
  const [editing, setEditing] = useState(false);

  if (!workspaceId) return <NoWorkspace />;
  const request = requests.find((row) => row.id === id);
  if (!request) {
    return <p className="text-muted-foreground text-sm">{loading ? 'Loading…' : 'Request not found in this workspace.'}</p>;
  }

  const toggleArchive = async () => {
    if (request.archived_at) await api.update('requests', request.id, workspaceId, { archived_at: null });
    else await api.archive('requests', request.id, workspaceId);
    invalidateList('requests', workspaceId);
  };

  const actions: RecordAction[] = [
    { key: 'edit', label: 'Edit', icon: Pencil, onClick: () => setEditing(true), primary: true },
    request.archived_at
      ? { key: 'unarchive', label: 'Unarchive', icon: ArchiveRestore, onClick: () => void toggleArchive() }
      : { key: 'archive', label: 'Archive', icon: Archive, onClick: () => void toggleArchive(), variant: 'destructive' },
  ];

  return (
    <div>
      <RecordHeader
        title={request.title}
        archived={Boolean(request.archived_at)}
        actions={actions}
        badges={
          <>
            <span className="font-mono text-xs">{request.request_number}</span>
            <span>·</span>
            <Badge variant={requestStatusTone(request.status)}>{formatLabel(request.status)}</Badge>
            <Badge variant={requestPriorityTone(request.priority)}>{formatLabel(request.priority)}</Badge>
          </>
        }
      />

      <RecordTabs
        noteParentType="request"
        recordId={request.id}
        workspaceId={workspaceId}
        overview={<RecordOverview layout={object.layout} row={request} workspaceId={workspaceId} />}
      />

      {editing ? (
        <RecordFormDialog open onOpenChange={setEditing} objectKey="requests" mode="edit" workspaceId={workspaceId} recordId={request.id} initialValues={request} />
      ) : null}
    </div>
  );
}
