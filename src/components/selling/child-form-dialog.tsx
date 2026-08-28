'use client';

import { useState } from 'react';

import { FieldInput } from '@/components/fields/field-input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { api, ApiError } from '@/lib/api-client';
import { invalidateList } from '@/lib/data-cache';
import type { ResourceName } from '@/lib/api/resources';
import type { FieldDef } from '@/lib/schema/types';
import { useUIStore } from '@/stores/ui';

type Row = Record<string, unknown>;

/**
 * Create or edit a record that belongs to another one — a price on an offering,
 * a line on a shipment, a milestone on an engagement.
 *
 * `RecordFormDialog` works from an `ObjectConfig`, which these do not have and
 * should not: nobody browses a list of price tiers. This takes a field list and
 * the parent keys instead, and renders them with the same `FieldInput` as every
 * other form, so a child record looks and behaves like the rest of the app.
 */
export function ChildFormDialog({
  open,
  onOpenChange,
  title,
  description,
  resource,
  fields,
  fixed,
  initialValues,
  workspaceId,
  recordId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  resource: ResourceName;
  fields: FieldDef[];
  /** Parent keys and other values the form does not ask for, e.g. `{ offering_id }`. */
  fixed?: Row;
  initialValues?: Row;
  workspaceId: string;
  /** Set to edit an existing record rather than create one. */
  recordId?: string;
  onSaved?: (row: Row) => void;
}) {
  const sectionColumns = useUIStore((state) => state.sectionColumns);
  const [form, setForm] = useState<Row>(() => ({ ...initialValues }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: string, value: unknown) => setForm((current) => ({ ...current, [key]: value }));

  const missingRequired = fields.some(
    (field) => field.required && (form[field.key] == null || form[field.key] === ''),
  );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = Object.fromEntries(
        Object.entries(form).filter(([, value]) => value !== '' && value !== undefined),
      );
      const row = recordId
        ? await api.update<Row>(resource, recordId, workspaceId, payload)
        : await api.create<Row>(resource, { workspace_id: workspaceId, ...fixed, ...payload });

      invalidateList(resource, workspaceId);
      onSaved?.(row);
      onOpenChange(false);
    } catch (caught) {
      setError(caught instanceof ApiError ? String(caught.message) : 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description ? <DialogDescription>{description}</DialogDescription> : null}
          </DialogHeader>

          <div
            className="grid gap-4 py-4"
            style={{ gridTemplateColumns: `repeat(${Math.min(sectionColumns, 2)}, minmax(0, 1fr))` }}
          >
            {fields.map((field) => (
              <div key={field.key} className="min-w-0">
                <Label htmlFor={`child-${field.key}`} className="mb-1.5">
                  {field.label}
                  {field.required ? <span className="text-destructive"> *</span> : null}
                </Label>
                <FieldInput
                  id={`child-${field.key}`}
                  field={field}
                  value={form[field.key]}
                  onChange={(value) => set(field.key, value)}
                  workspaceId={workspaceId}
                />
                {field.helpText ? <p className="text-muted-foreground mt-1 text-xs">{field.helpText}</p> : null}
              </div>
            ))}
          </div>

          {error ? <p className="text-destructive text-sm">{error}</p> : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || missingRequired}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
