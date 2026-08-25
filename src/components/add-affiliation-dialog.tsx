'use client';

import { useState } from 'react';

import { FieldInput } from '@/components/fields/field-input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/lib/api-client';
import { invalidateList, useCachedList } from '@/lib/data-cache';
import { ENTITY_PERSON_FIELDS } from '@/lib/schema/entity-person';
import type { Entity } from '@/lib/types';

/** The Person-page counterpart to AddPersonDialog: attach this Person to an existing Entity. */
export function AddAffiliationDialog({
  open,
  onOpenChange,
  personId,
  workspaceId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personId: string;
  workspaceId: string;
}) {
  const { rows: entities } = useCachedList<Entity>('entities', workspaceId);
  const [entityId, setEntityId] = useState('');
  const [relationship, setRelationship] = useState<Record<string, unknown>>({
    relationship_type: 'employee',
    status: 'current',
    is_primary_contact: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!entityId) return;
    setSaving(true);
    setError(null);
    try {
      await api.create('entity-persons', { workspace_id: workspaceId, entity_id: entityId, person_id: personId, ...relationship });
      invalidateList('entity-persons', workspaceId);
      onOpenChange(false);
      setEntityId('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not add affiliation');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Add to entity</DialogTitle>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label>Entity</Label>
            <Select value={entityId} onValueChange={setEntityId}>
              <SelectTrigger>
                <SelectValue placeholder="Select an entity…" />
              </SelectTrigger>
              <SelectContent>
                {entities.map((entity) => (
                  <SelectItem key={entity.id} value={entity.id}>
                    {entity.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
          </div>

          {error ? <p className="text-destructive text-sm">{error}</p> : null}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !entityId}>
              {saving ? 'Saving…' : 'Add'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
