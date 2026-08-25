'use client';

import { useState } from 'react';

import { FieldInput } from '@/components/fields/field-input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/lib/api-client';
import { invalidateList, useCachedList } from '@/lib/data-cache';
import { ENTITY_PERSON_FIELDS } from '@/lib/schema/entity-person';
import { useCurrentUserStore } from '@/stores/current-user';
import type { Person } from '@/lib/types';

/**
 * "Add person" on an Entity (spec §11): find an existing Person or create one
 * on the spot, then attach them via the EntityPerson junction — the junction
 * itself is never exposed as its own object (spec §9).
 */
export function AddPersonDialog({
  open,
  onOpenChange,
  entityId,
  workspaceId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityId: string;
  workspaceId: string;
}) {
  const { rows: people } = useCachedList<Person>('persons', workspaceId);
  const currentUser = useCurrentUserStore();

  const [personId, setPersonId] = useState<string>('__new__');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [relationship, setRelationship] = useState<Record<string, unknown>>({
    relationship_type: 'employee',
    status: 'current',
    is_primary_contact: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setPersonId('__new__');
    setFirstName('');
    setLastName('');
    setRelationship({ relationship_type: 'employee', status: 'current', is_primary_contact: false });
    setError(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      let resolvedPersonId = personId;
      if (personId === '__new__') {
        if (!firstName.trim()) throw new Error('First name is required for a new person');
        const person = await api.create<Person>('persons', {
          workspace_id: workspaceId,
          first_name: firstName.trim(),
          last_name: lastName.trim() || undefined,
          owner_user_id: currentUser.userId,
          created_by_user_id: currentUser.userId,
        });
        resolvedPersonId = person.id;
        invalidateList('persons', workspaceId);
      }

      await api.create('entity-persons', {
        workspace_id: workspaceId,
        entity_id: entityId,
        person_id: resolvedPersonId,
        ...relationship,
      });
      invalidateList('entity-persons', workspaceId);
      onOpenChange(false);
      reset();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not add person');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
    if (!next) reset();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Add person</DialogTitle>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label>Person</Label>
            <Select value={personId} onValueChange={setPersonId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__new__">+ Create new person</SelectItem>
                {people.map((person) => (
                  <SelectItem key={person.id} value={person.id}>
                    {[person.first_name, person.last_name].filter(Boolean).join(' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {personId === '__new__' ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ap-first">First name *</Label>
                <Input id="ap-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ap-last">Last name</Label>
                <Input id="ap-last" value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            {[ENTITY_PERSON_FIELDS.relationship_type, ENTITY_PERSON_FIELDS.job_title, ENTITY_PERSON_FIELDS.department, ENTITY_PERSON_FIELDS.status].map((field) => (
              <div key={field.key} className="space-y-1.5">
                <Label htmlFor={field.key}>{field.label}</Label>
                <FieldInput
                  id={field.key}
                  field={field}
                  value={relationship[field.key]}
                  onChange={(value) => setRelationship((current) => ({ ...current, [field.key]: value }))}
                  workspaceId={workspaceId}
                />
              </div>
            ))}
            <div className="col-span-2 flex items-center gap-2 pt-1">
              <FieldInput
                id="is_primary_contact"
                field={ENTITY_PERSON_FIELDS.is_primary_contact}
                value={relationship.is_primary_contact}
                onChange={(value) => setRelationship((current) => ({ ...current, is_primary_contact: value }))}
                workspaceId={workspaceId}
              />
              <Label htmlFor="is_primary_contact" className="font-normal">
                Primary contact for this entity
              </Label>
            </div>
          </div>

          {error ? <p className="text-destructive text-sm">{error}</p> : null}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Add person'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
