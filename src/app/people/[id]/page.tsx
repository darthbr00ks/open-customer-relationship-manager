'use client';

import { useParams } from 'next/navigation';
import { Archive, ArchiveRestore, Building2, LifeBuoy, Lightbulb, Mail, Pencil } from 'lucide-react';
import { useState } from 'react';

import { AddAffiliationDialog } from '@/components/add-affiliation-dialog';
import { EmailComposerDialog } from '@/components/email-composer-dialog';
import { NoWorkspace } from '@/components/empty-state';
import { FieldValue } from '@/components/fields/field-value';
import { RecordFormDialog } from '@/components/record-form-dialog';
import { RecordHeader, type RecordAction } from '@/components/record-header';
import { RecordOverview } from '@/components/record-overview';
import { RecordTabs } from '@/components/record-tabs';
import { RelatedList } from '@/components/related-list';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api-client';
import { invalidateList, useCachedList } from '@/lib/data-cache';
import { affiliationStatusTone } from '@/lib/schema/entity-person';
import { formatLabel } from '@/lib/format';
import { OBJECTS } from '@/lib/objects';
import type { Entity, EntityPerson, FeatureRequest, Person, SupportCase } from '@/lib/types';
import { useWorkspaceStore } from '@/stores/workspace';

const object = OBJECTS.persons;

export default function PersonRecordPage() {
  const { id } = useParams<{ id: string }>();
  const workspaceId = useWorkspaceStore((state) => state.workspaceId);

  const { rows: people, loading } = useCachedList<Person>('persons', workspaceId, { includeArchived: true });
  const { rows: entityPersons } = useCachedList<EntityPerson>('entity-persons', workspaceId, { includeArchived: true, limit: 200 });
  const { rows: entities } = useCachedList<Entity>('entities', workspaceId, { includeArchived: true });
  const { rows: cases } = useCachedList<SupportCase>('cases', workspaceId);
  const { rows: requests } = useCachedList<FeatureRequest>('requests', workspaceId);

  const [editing, setEditing] = useState(false);
  const [addingAffiliation, setAddingAffiliation] = useState(false);
  const [emailing, setEmailing] = useState(false);

  if (!workspaceId) return <NoWorkspace />;
  const person = people.find((row) => row.id === id);
  if (!person) {
    return <p className="text-muted-foreground text-sm">{loading ? 'Loading…' : 'Person not found in this workspace.'}</p>;
  }

  const entitiesById = new Map(entities.map((e) => [e.id, e]));
  const affiliationRows = entityPersons.filter((ep) => ep.person_id === person.id);

  const toggleArchive = async () => {
    if (person.archived_at) await api.update('persons', person.id, workspaceId, { archived_at: null });
    else await api.archive('persons', person.id, workspaceId);
    invalidateList('persons', workspaceId);
  };

  const actions: RecordAction[] = [
    { key: 'email', label: 'Send Email', icon: Mail, onClick: () => setEmailing(true), primary: true },
    { key: 'edit', label: 'Edit', icon: Pencil, onClick: () => setEditing(true), primary: true },
    { key: 'add-affiliation', label: 'Add to entity', icon: Building2, onClick: () => setAddingAffiliation(true), primary: true },
    person.archived_at
      ? { key: 'unarchive', label: 'Unarchive', icon: ArchiveRestore, onClick: () => void toggleArchive() }
      : { key: 'archive', label: 'Archive', icon: Archive, onClick: () => void toggleArchive(), variant: 'destructive' },
  ];

  return (
    <div>
      <RecordHeader
        title={[person.first_name, person.last_name].filter(Boolean).join(' ')}
        archived={Boolean(person.archived_at)}
        actions={actions}
        badges={
          <>
            {person.primary_email ? <span>{person.primary_email}</span> : null}
            {person.primary_phone ? (
              <>
                <span>·</span>
                <span>{person.primary_phone}</span>
              </>
            ) : null}
          </>
        }
      />

      <RecordTabs
        noteParentType="person"
        recordId={person.id}
        workspaceId={workspaceId}
        overview={
          <RecordOverview
            layout={object.layout}
            row={person}
            workspaceId={workspaceId}
            resource={object.resource}
            recordId={person.id}
          />
        }
        related={
          <>
            <RelatedList
              title="Entities"
              icon={Building2}
              rows={affiliationRows}
              onAdd={() => setAddingAffiliation(true)}
              addLabel="Add to entity"
              href={(row) => `/entities/${row.entity_id}`}
              emptyLabel="Not affiliated with any entity yet."
              columns={[
                { key: 'entity', label: 'Entity', render: (row) => entitiesById.get(row.entity_id)?.name ?? 'Unknown' },
                { key: 'job_title', label: 'Title', render: (row) => row.job_title ?? '—' },
                { key: 'relationship_type', label: 'Relationship', render: (row) => formatLabel(row.relationship_type) },
                { key: 'status', label: 'Status', render: (row) => <Badge variant={affiliationStatusTone(row.status)}>{formatLabel(row.status)}</Badge> },
              ]}
            />

            <RelatedList
              title="Cases"
              icon={LifeBuoy}
              rows={cases.filter((c) => c.reported_by_person_id === person.id)}
              href={(row) => `/cases/${row.id}`}
              columns={[
                { key: 'case_number', label: 'Case #', render: (row) => row.case_number },
                { key: 'subject', label: 'Subject', render: (row) => row.subject },
                { key: 'status', label: 'Status', render: (row) => <FieldValue field={{ key: 'status', label: 'Status', type: 'select' }} value={row.status} workspaceId={workspaceId} /> },
              ]}
            />

            <RelatedList
              title="Requests"
              icon={Lightbulb}
              rows={requests.filter((r) => r.requested_by_person_id === person.id)}
              href={(row) => `/requests/${row.id}`}
              columns={[
                { key: 'request_number', label: 'Request #', render: (row) => row.request_number },
                { key: 'title', label: 'Title', render: (row) => row.title },
                { key: 'status', label: 'Status', render: (row) => <FieldValue field={{ key: 'status', label: 'Status', type: 'select' }} value={row.status} workspaceId={workspaceId} /> },
              ]}
            />
          </>
        }
      />

      {editing ? (
        <RecordFormDialog open onOpenChange={setEditing} objectKey="persons" mode="edit" workspaceId={workspaceId} recordId={person.id} initialValues={person} />
      ) : null}
      {addingAffiliation ? (
        <AddAffiliationDialog open onOpenChange={setAddingAffiliation} personId={person.id} workspaceId={workspaceId} />
      ) : null}
      {emailing ? (
        <EmailComposerDialog
          open
          onOpenChange={setEmailing}
          workspaceId={workspaceId}
          recipient={person.primary_email ?? ''}
          defaultSubject={`Hello ${person.preferred_name ?? person.first_name}`}
          relatedPersonId={person.id}
        />
      ) : null}
    </div>
  );
}
