'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Archive, ArchiveRestore, Building2, LayoutGrid, LifeBuoy, Lightbulb, Mail, Pencil, Phone, Users } from 'lucide-react';
import { useState } from 'react';

import { AddPersonDialog } from '@/components/add-person-dialog';
import { FieldValue } from '@/components/fields/field-value';
import { NoWorkspace } from '@/components/empty-state';
import { RecordFormDialog } from '@/components/record-form-dialog';
import { RecordHeader, type RecordAction } from '@/components/record-header';
import { RecordOverview } from '@/components/record-overview';
import { RecordTabs } from '@/components/record-tabs';
import { RelatedList } from '@/components/related-list';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api-client';
import { invalidateList, useCachedList } from '@/lib/data-cache';
import { entityStageTone } from '@/lib/schema/entity';
import { affiliationStatusTone } from '@/lib/schema/entity-person';
import { formatLabel } from '@/lib/format';
import { OBJECTS } from '@/lib/objects';
import type { Deal, Entity, EntityPerson, FeatureRequest, Person, SupportCase } from '@/lib/types';
import { useWorkspaceStore } from '@/stores/workspace';

const object = OBJECTS.entities;

const genCaseNumber = () => `CASE-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
const genRequestNumber = () => `REQ-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;

export default function EntityRecordPage() {
  const { id } = useParams<{ id: string }>();
  const workspaceId = useWorkspaceStore((state) => state.workspaceId);

  const { rows: entities, loading } = useCachedList<Entity>('entities', workspaceId, { includeArchived: true });
  const { rows: entityPersons } = useCachedList<EntityPerson>('entity-persons', workspaceId, { includeArchived: true, limit: 200 });
  const { rows: persons } = useCachedList<Person>('persons', workspaceId, { includeArchived: true });
  const { rows: deals } = useCachedList<Deal>('deals', workspaceId);
  const { rows: cases } = useCachedList<SupportCase>('cases', workspaceId);
  const { rows: requests } = useCachedList<FeatureRequest>('requests', workspaceId);

  const [editing, setEditing] = useState(false);
  const [addingPerson, setAddingPerson] = useState(false);
  const [creatingDeal, setCreatingDeal] = useState(false);
  // A suggested number, generated at click time (not during render) and editable before saving.
  const [newCaseNumber, setNewCaseNumber] = useState<string | null>(null);
  const [newRequestNumber, setNewRequestNumber] = useState<string | null>(null);

  if (!workspaceId) return <NoWorkspace />;
  const entity = entities.find((row) => row.id === id);
  if (!entity) {
    return <p className="text-muted-foreground text-sm">{loading ? 'Loading…' : 'Entity not found in this workspace.'}</p>;
  }

  const personsById = new Map(persons.map((p) => [p.id, p]));
  const peopleRows = entityPersons
    .filter((ep) => ep.entity_id === entity.id)
    .map((ep) => ({ ...ep, person: personsById.get(ep.person_id) }))
    .filter((row) => row.person);

  const toggleArchive = async () => {
    if (entity.archived_at) {
      await api.update('entities', entity.id, workspaceId, { archived_at: null });
    } else {
      await api.archive('entities', entity.id, workspaceId);
    }
    invalidateList('entities', workspaceId);
  };

  const actions: RecordAction[] = [
    { key: 'edit', label: 'Edit', icon: Pencil, onClick: () => setEditing(true), primary: true },
    { key: 'add-person', label: 'Add Person', icon: Users, onClick: () => setAddingPerson(true), primary: true },
    { key: 'create-deal', label: 'Create Deal', icon: LayoutGrid, onClick: () => setCreatingDeal(true), primary: true },
    { key: 'create-case', label: 'Create Case', icon: LifeBuoy, onClick: () => setNewCaseNumber(genCaseNumber()) },
    { key: 'create-request', label: 'Create Request', icon: Lightbulb, onClick: () => setNewRequestNumber(genRequestNumber()) },
    entity.archived_at
      ? { key: 'unarchive', label: 'Unarchive', icon: ArchiveRestore, onClick: () => void toggleArchive() }
      : { key: 'archive', label: 'Archive', icon: Archive, onClick: () => void toggleArchive(), variant: 'destructive' },
  ];

  return (
    <div>
      <RecordHeader
        title={entity.name}
        archived={Boolean(entity.archived_at)}
        actions={actions}
        badges={
          <>
            <span className="capitalize">{formatLabel(entity.entity_type)}</span>
            <span>·</span>
            <Badge variant={entityStageTone(entity.relationship_stage)}>{formatLabel(entity.relationship_stage)}</Badge>
            {entity.city ? (
              <>
                <span>·</span>
                <span>{entity.city}</span>
              </>
            ) : null}
          </>
        }
      />

      <RecordTabs
        noteParentType="entity"
        recordId={entity.id}
        workspaceId={workspaceId}
        overview={
          <RecordOverview
            layout={object.layout}
            row={entity}
            workspaceId={workspaceId}
            resource={object.resource}
            recordId={entity.id}
          />
        }
        related={
          <>
            <RelatedList
              title="People"
              icon={Users}
              rows={peopleRows}
              onAdd={() => setAddingPerson(true)}
              addLabel="Add person"
              emptyLabel="No one is associated with this entity yet."
              expand={(row) => (
                <PersonInlineDetail
                  person={row.person!}
                  entityPerson={row}
                  otherAffiliations={entityPersons.filter((ep) => ep.person_id === row.person_id && ep.entity_id !== entity.id)}
                  entities={entities}
                />
              )}
              columns={[
                {
                  key: 'name',
                  label: 'Name',
                  render: (row) => (
                    <Link
                      href={`/people/${row.person_id}`}
                      className="hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {row.person ? [row.person.first_name, row.person.last_name].filter(Boolean).join(' ') : '—'}
                    </Link>
                  ),
                },
                { key: 'job_title', label: 'Title', render: (row) => row.job_title ?? '—' },
                {
                  key: 'relationship_type',
                  label: 'Relationship',
                  render: (row) => (
                    <span className="flex items-center gap-1.5">
                      {formatLabel(row.relationship_type)}
                      {row.is_primary_contact ? <Badge variant="outline">Primary</Badge> : null}
                    </span>
                  ),
                },
                { key: 'status', label: 'Status', render: (row) => <Badge variant={affiliationStatusTone(row.status)}>{formatLabel(row.status)}</Badge> },
              ]}
            />

            <RelatedList
              title="Deals"
              icon={LayoutGrid}
              rows={deals.filter((d) => d.entity_id === entity.id)}
              onAdd={() => setCreatingDeal(true)}
              addLabel="Create deal"
              href={(row) => `/deals/${row.id}`}
              columns={[
                { key: 'name', label: 'Deal', render: (row) => row.name },
                { key: 'amount', label: 'Amount', render: (row) => <FieldValue field={{ key: 'amount', label: 'Amount', type: 'currency' }} value={row.amount} workspaceId={workspaceId} /> },
                { key: 'stage', label: 'Stage', render: (row) => <FieldValue field={{ key: 'stage', label: 'Stage', type: 'select' }} value={row.stage} workspaceId={workspaceId} /> },
              ]}
            />

            <RelatedList
              title="Cases"
              icon={LifeBuoy}
              rows={cases.filter((c) => c.entity_id === entity.id)}
              onAdd={() => setNewCaseNumber(genCaseNumber())}
              addLabel="Create case"
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
              rows={requests.filter((r) => r.entity_id === entity.id)}
              onAdd={() => setNewRequestNumber(genRequestNumber())}
              addLabel="Create request"
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
        <RecordFormDialog open onOpenChange={setEditing} objectKey="entities" mode="edit" workspaceId={workspaceId} recordId={entity.id} initialValues={entity} />
      ) : null}
      {addingPerson ? (
        <AddPersonDialog open onOpenChange={setAddingPerson} entityId={entity.id} workspaceId={workspaceId} />
      ) : null}
      {creatingDeal ? (
        <RecordFormDialog open onOpenChange={setCreatingDeal} objectKey="deals" mode="create" workspaceId={workspaceId} initialValues={{ entity_id: entity.id }} lockedFields={['entity_id']} />
      ) : null}
      {newCaseNumber ? (
        <RecordFormDialog
          open
          onOpenChange={(open) => !open && setNewCaseNumber(null)}
          objectKey="cases"
          mode="create"
          workspaceId={workspaceId}
          initialValues={{ entity_id: entity.id, case_number: newCaseNumber }}
          lockedFields={['entity_id']}
        />
      ) : null}
      {newRequestNumber ? (
        <RecordFormDialog
          open
          onOpenChange={(open) => !open && setNewRequestNumber(null)}
          objectKey="requests"
          mode="create"
          workspaceId={workspaceId}
          initialValues={{ entity_id: entity.id, request_number: newRequestNumber }}
          lockedFields={['entity_id']}
        />
      ) : null}
    </div>
  );
}

/**
 * Shows a person's contact information and other affiliations inline.
 */
function PersonInlineDetail({
  person,
  entityPerson,
  otherAffiliations,
  entities,
}: {
  person: Person;
  entityPerson: EntityPerson;
  otherAffiliations: EntityPerson[];
  entities: Entity[];
}) {
  const entitiesById = new Map(entities.map((e) => [e.id, e]));
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5 text-sm">
        <p className="text-muted-foreground text-xs font-semibold uppercase">Contact</p>
        {person.primary_email ? (
          <p className="flex items-center gap-1.5">
            <Mail className="text-muted-foreground size-3.5" />
            <a href={`mailto:${person.primary_email}`} className="hover:underline">
              {person.primary_email}
            </a>
          </p>
        ) : null}
        {person.primary_phone ? (
          <p className="flex items-center gap-1.5">
            <Phone className="text-muted-foreground size-3.5" />
            <a href={`tel:${person.primary_phone}`} className="hover:underline">
              {person.primary_phone}
            </a>
          </p>
        ) : null}
        {!person.primary_email && !person.primary_phone ? <p className="text-muted-foreground">No contact info on file.</p> : null}
        {entityPerson.notes ? <p className="text-muted-foreground pt-1">{entityPerson.notes}</p> : null}
        <Link href={`/people/${person.id}`} className="text-primary inline-block pt-1 hover:underline">
          View full record →
        </Link>
      </div>
      <div className="space-y-1.5 text-sm">
        <p className="text-muted-foreground text-xs font-semibold uppercase">Also affiliated with</p>
        {otherAffiliations.length === 0 ? (
          <p className="text-muted-foreground">No other entities on file.</p>
        ) : (
          <ul className="space-y-1">
            {otherAffiliations.map((ep) => (
              <li key={ep.id}>
                <Link href={`/entities/${ep.entity_id}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
                  <Building2 className="mr-1 inline size-3.5" />
                  {entitiesById.get(ep.entity_id)?.name ?? 'Unknown entity'}
                </Link>
                <span className="text-muted-foreground"> — {formatLabel(ep.relationship_type)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
