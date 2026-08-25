'use client';

import { useParams } from 'next/navigation';
import { Archive, ArchiveRestore, CircleCheck, Pencil, Siren } from 'lucide-react';
import { useState } from 'react';

import { NoWorkspace } from '@/components/empty-state';
import { RecordFormDialog } from '@/components/record-form-dialog';
import { RecordHeader, type RecordAction } from '@/components/record-header';
import { RecordOverview } from '@/components/record-overview';
import { RecordTabs } from '@/components/record-tabs';
import { RelatedList } from '@/components/related-list';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api-client';
import { logSystemNote } from '@/lib/activity';
import { invalidateList, useCachedList } from '@/lib/data-cache';
import { formatLabel } from '@/lib/format';
import { casePriorityTone, caseStatusTone } from '@/lib/schema/case';
import { incidentSeverityTone } from '@/lib/schema/incident';
import { OBJECTS } from '@/lib/objects';
import type { Incident, IncidentCase, SupportCase } from '@/lib/types';
import { useCurrentUserStore } from '@/stores/current-user';
import { useWorkspaceStore } from '@/stores/workspace';

const object = OBJECTS.cases;

export default function CaseRecordPage() {
  const { id } = useParams<{ id: string }>();
  const workspaceId = useWorkspaceStore((state) => state.workspaceId);
  const currentUser = useCurrentUserStore();

  const { rows: cases, loading } = useCachedList<SupportCase>('cases', workspaceId, { includeArchived: true });
  const { rows: incidentCases } = useCachedList<IncidentCase>('incident-cases', workspaceId, { limit: 200 });
  const { rows: incidents } = useCachedList<Incident>('incidents', workspaceId, { includeArchived: true });

  const [editing, setEditing] = useState(false);
  const [resolving, setResolving] = useState(false);

  if (!workspaceId) return <NoWorkspace />;
  const supportCase = cases.find((row) => row.id === id);
  if (!supportCase) {
    return <p className="text-muted-foreground text-sm">{loading ? 'Loading…' : 'Case not found in this workspace.'}</p>;
  }

  const incidentsById = new Map(incidents.map((i) => [i.id, i]));
  const linkedIncidents = incidentCases.filter((link) => link.case_id === supportCase.id);

  const toggleArchive = async () => {
    if (supportCase.archived_at) await api.update('cases', supportCase.id, workspaceId, { archived_at: null });
    else await api.archive('cases', supportCase.id, workspaceId);
    invalidateList('cases', workspaceId);
  };

  const actions: RecordAction[] = [
    { key: 'edit', label: 'Edit', icon: Pencil, onClick: () => setEditing(true), primary: true },
  ];
  if (supportCase.status !== 'resolved' && supportCase.status !== 'closed') {
    actions.push({ key: 'resolve', label: 'Resolve', icon: CircleCheck, onClick: () => setResolving(true), primary: true });
  }
  actions.push(
    supportCase.archived_at
      ? { key: 'unarchive', label: 'Unarchive', icon: ArchiveRestore, onClick: () => void toggleArchive() }
      : { key: 'archive', label: 'Archive', icon: Archive, onClick: () => void toggleArchive(), variant: 'destructive' },
  );

  return (
    <div>
      <RecordHeader
        title={supportCase.subject}
        archived={Boolean(supportCase.archived_at)}
        actions={actions}
        badges={
          <>
            <span className="font-mono text-xs">{supportCase.case_number}</span>
            <span>·</span>
            <Badge variant={caseStatusTone(supportCase.status)}>{formatLabel(supportCase.status)}</Badge>
            <Badge variant={casePriorityTone(supportCase.priority)}>{formatLabel(supportCase.priority)}</Badge>
          </>
        }
      />

      <RecordTabs
        noteParentType="case"
        recordId={supportCase.id}
        workspaceId={workspaceId}
        overview={<RecordOverview layout={object.layout} row={supportCase} workspaceId={workspaceId} />}
        related={
          <RelatedList
            title="Incidents"
            icon={Siren}
            rows={linkedIncidents}
            href={(row) => `/incidents/${row.incident_id}`}
            emptyLabel="Not linked to any incident."
            columns={[
              { key: 'incident', label: 'Incident', render: (row) => incidentsById.get(row.incident_id)?.title ?? 'Unknown' },
              {
                key: 'status',
                label: 'Status',
                render: (row) => {
                  const incident = incidentsById.get(row.incident_id);
                  return incident ? <span className="capitalize">{formatLabel(incident.status)}</span> : '—';
                },
              },
              {
                key: 'impact_level',
                label: 'Impact',
                render: (row) => (row.impact_level ? <Badge variant={incidentSeverityTone(row.impact_level)}>{formatLabel(row.impact_level)}</Badge> : '—'),
              },
            ]}
          />
        }
      />

      {editing ? (
        <RecordFormDialog open onOpenChange={setEditing} objectKey="cases" mode="edit" workspaceId={workspaceId} recordId={supportCase.id} initialValues={supportCase} />
      ) : null}
      {resolving ? (
        <ResolveDialog
          open
          onOpenChange={setResolving}
          caseId={supportCase.id}
          workspaceId={workspaceId}
          userId={currentUser.userId}
        />
      ) : null}
    </div>
  );
}

function ResolveDialog({
  open,
  onOpenChange,
  caseId,
  workspaceId,
  userId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  workspaceId: string;
  userId: string;
}) {
  const [resolution, setResolution] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api.update('cases', caseId, workspaceId, {
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        resolution: resolution || undefined,
        updated_by_user_id: userId,
      });
      await logSystemNote(workspaceId, 'case', caseId, `Resolved${resolution ? `: ${resolution}` : ''}`, userId);
      invalidateList('cases', workspaceId);
      onOpenChange(false);
      setResolution('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Resolve case</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="resolution">Resolution</Label>
            <Textarea id="resolution" value={resolution} onChange={(e) => setResolution(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Resolve'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
