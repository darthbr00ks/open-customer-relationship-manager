'use client';

import { useParams } from 'next/navigation';
import { Archive, ArchiveRestore, LifeBuoy, Pencil } from 'lucide-react';
import { useState } from 'react';

import { NoWorkspace } from '@/components/empty-state';
import { LinkCaseDialog } from '@/components/link-case-dialog';
import { RecordFormDialog } from '@/components/record-form-dialog';
import { RecordHeader, type RecordAction } from '@/components/record-header';
import { RecordOverview } from '@/components/record-overview';
import { RecordTabs } from '@/components/record-tabs';
import { RelatedList } from '@/components/related-list';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api-client';
import { invalidateList, useCachedList } from '@/lib/data-cache';
import { caseStatusTone } from '@/lib/schema/case';
import { incidentSeverityTone, incidentStatusTone } from '@/lib/schema/incident';
import { formatLabel } from '@/lib/format';
import { OBJECTS } from '@/lib/objects';
import type { Incident, IncidentCase, SupportCase } from '@/lib/types';
import { useWorkspaceStore } from '@/stores/workspace';

const object = OBJECTS.incidents;

export default function IncidentRecordPage() {
  const { id } = useParams<{ id: string }>();
  const workspaceId = useWorkspaceStore((state) => state.workspaceId);

  const { rows: incidents, loading } = useCachedList<Incident>('incidents', workspaceId, { includeArchived: true });
  const { rows: incidentCases } = useCachedList<IncidentCase>('incident-cases', workspaceId, { limit: 200 });
  const { rows: cases } = useCachedList<SupportCase>('cases', workspaceId, { includeArchived: true });

  const [editing, setEditing] = useState(false);
  const [linking, setLinking] = useState(false);

  if (!workspaceId) return <NoWorkspace />;
  const incident = incidents.find((row) => row.id === id);
  if (!incident) {
    return <p className="text-muted-foreground text-sm">{loading ? 'Loading…' : 'Incident not found in this workspace.'}</p>;
  }

  const casesById = new Map(cases.map((c) => [c.id, c]));
  const links = incidentCases.filter((link) => link.incident_id === incident.id);

  const toggleArchive = async () => {
    if (incident.archived_at) await api.update('incidents', incident.id, workspaceId, { archived_at: null });
    else await api.archive('incidents', incident.id, workspaceId);
    invalidateList('incidents', workspaceId);
  };

  const actions: RecordAction[] = [
    { key: 'edit', label: 'Edit', icon: Pencil, onClick: () => setEditing(true), primary: true },
    { key: 'link-case', label: 'Link Case', icon: LifeBuoy, onClick: () => setLinking(true), primary: true },
    incident.archived_at
      ? { key: 'unarchive', label: 'Unarchive', icon: ArchiveRestore, onClick: () => void toggleArchive() }
      : { key: 'archive', label: 'Archive', icon: Archive, onClick: () => void toggleArchive(), variant: 'destructive' },
  ];

  return (
    <div>
      <RecordHeader
        title={incident.title}
        archived={Boolean(incident.archived_at)}
        actions={actions}
        badges={
          <>
            <span className="font-mono text-xs">{incident.incident_number}</span>
            <span>·</span>
            <Badge variant={incidentStatusTone(incident.status)}>{formatLabel(incident.status)}</Badge>
            <Badge variant={incidentSeverityTone(incident.severity)}>{formatLabel(incident.severity)}</Badge>
          </>
        }
      />

      <RecordTabs
        noteParentType="incident"
        recordId={incident.id}
        workspaceId={workspaceId}
        overview={
          <RecordOverview
            layout={object.layout}
            row={incident}
            workspaceId={workspaceId}
            resource={object.resource}
            recordId={incident.id}
          />
        }
        related={
          <RelatedList
            title="Cases"
            icon={LifeBuoy}
            rows={links}
            onAdd={() => setLinking(true)}
            addLabel="Link case"
            href={(row) => `/cases/${row.case_id}`}
            emptyLabel="No cases linked to this incident yet."
            columns={[
              { key: 'case_number', label: 'Case #', render: (row) => casesById.get(row.case_id)?.case_number ?? '—' },
              { key: 'subject', label: 'Subject', render: (row) => casesById.get(row.case_id)?.subject ?? 'Unknown' },
              {
                key: 'status',
                label: 'Status',
                render: (row) => {
                  const c = casesById.get(row.case_id);
                  return c ? <Badge variant={caseStatusTone(c.status)}>{formatLabel(c.status)}</Badge> : '—';
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
        <RecordFormDialog open onOpenChange={setEditing} objectKey="incidents" mode="edit" workspaceId={workspaceId} recordId={incident.id} initialValues={incident} />
      ) : null}
      {linking ? (
        <LinkCaseDialog
          open
          onOpenChange={setLinking}
          incidentId={incident.id}
          workspaceId={workspaceId}
          alreadyLinkedCaseIds={new Set(links.map((l) => l.case_id))}
        />
      ) : null}
    </div>
  );
}
