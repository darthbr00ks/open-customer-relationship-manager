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
import { OBJECTS } from '@/lib/objects';
import { exceptionLevelTone } from '@/lib/schema/exception-log';
import type { ExceptionLog } from '@/lib/types';
import { useWorkspaceStore } from '@/stores/workspace';

const object = OBJECTS.exception_logs;

export default function ExceptionLogPage() {
  const { id } = useParams<{ id: string }>();
  const workspaceId = useWorkspaceStore((state) => state.workspaceId);
  const { rows, loading } = useCachedList<ExceptionLog>('exception-logs', workspaceId, { includeArchived: true });
  const [editing, setEditing] = useState(false);

  if (!workspaceId) return <NoWorkspace />;
  const log = rows.find((row) => row.id === id);
  if (!log) return <p className="text-muted-foreground text-sm">{loading ? 'Loading…' : 'Exception log not found.'}</p>;
  const currentLog = log;

  async function toggleArchive() {
    if (currentLog.archived_at) await api.update('exception-logs', currentLog.id, workspaceId!, { archived_at: null });
    else await api.archive('exception-logs', currentLog.id, workspaceId!);
    invalidateList('exception-logs', workspaceId!);
  }

  const actions: RecordAction[] = [
    { key: 'edit', label: 'Edit', icon: Pencil, onClick: () => setEditing(true), primary: true },
    log.archived_at
      ? { key: 'unarchive', label: 'Unarchive', icon: ArchiveRestore, onClick: () => void toggleArchive() }
      : { key: 'archive', label: 'Archive', icon: Archive, onClick: () => void toggleArchive(), variant: 'destructive' },
  ];

  return (
    <div>
      <RecordHeader
        title={log.error_code}
        archived={Boolean(log.archived_at)}
        actions={actions}
        badges={
          <>
            <Badge variant={exceptionLevelTone(log.level)}>{log.level}</Badge>
            {log.exception_type ? <span>{formatLabel(log.exception_type)}</span> : null}
            {log.service ? <><span>·</span><span>{log.service}</span></> : null}
          </>
        }
      />
      <RecordTabs
        noteParentType="exception_log"
        recordId={log.id}
        workspaceId={workspaceId}
        overview={<RecordOverview layout={object.layout} row={log} workspaceId={workspaceId} resource={object.resource} recordId={log.id} />}
      />
      {editing ? (
        <RecordFormDialog open onOpenChange={setEditing} objectKey="exception_logs" mode="edit" workspaceId={workspaceId} recordId={log.id} initialValues={log} />
      ) : null}
    </div>
  );
}
