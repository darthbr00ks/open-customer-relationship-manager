'use client';

import { useState } from 'react';

import { FieldInput } from '@/components/fields/field-input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { api, ApiError } from '@/lib/api-client';
import { invalidateList } from '@/lib/data-cache';
import { OBJECTS, type ObjectKey } from '@/lib/objects';
import { useCurrentUserStore } from '@/stores/current-user';
import { useUIStore } from '@/stores/ui';

type Row = Record<string, unknown>;

export function RecordFormDialog({
  open,
  onOpenChange,
  objectKey,
  mode,
  workspaceId,
  recordId,
  initialValues,
  lockedFields,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  objectKey: ObjectKey;
  mode: 'create' | 'edit';
  workspaceId: string;
  recordId?: string;
  initialValues?: Row;
  /** Fields shown but not editable — e.g. the parent entity when creating a Deal from an Entity page. */
  lockedFields?: string[];
  onSaved?: (row: Row) => void;
}) {
  const object = OBJECTS[objectKey];
  const density = useUIStore((state) => state.density);
  const sectionColumns = useUIStore((state) => state.sectionColumns);
  const currentUser = useCurrentUserStore();

  // Every caller mounts this dialog fresh each time it opens (conditional rendering, not a
  // persistent `open` toggle), so a lazy initializer seeds the draft once — no effect needed.
  const [form, setForm] = useState<Row>(() => ({ ...(mode === 'create' ? object.defaults : undefined), ...initialValues }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: string, value: unknown) => setForm((current) => ({ ...current, [key]: value }));

  const sections = object.layout.sections
    .map((section) => ({
      ...section,
      fields: section.fields.filter((field) => (mode === 'create' ? !field.readOnly : true)),
    }))
    .filter((section) => section.fields.length > 0);

  const missingRequired = sections.some((section) =>
    section.fields.some((field) => {
      if (!field.required || lockedFields?.includes(field.key)) return false;
      const value = form[field.key];
      return value == null || value === '';
    }),
  );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = Object.fromEntries(
        Object.entries(form).filter(([, value]) => value !== '' && value !== undefined),
      );

      if (mode === 'create') {
        const row = await api.create<Row>(object.resource, {
          workspace_id: workspaceId,
          created_by_user_id: currentUser.userId,
          owner_user_id: currentUser.userId,
          ...payload,
        });
        invalidateList(object.resource, workspaceId);
        onSaved?.(row);
      } else {
        if (!recordId) {
          setError('Cannot update: record id is missing');
          return;
        }
        const row = await api.update<Row>(object.resource, recordId, workspaceId, {
          updated_by_user_id: currentUser.userId,
          ...payload,
        });
        invalidateList(object.resource, workspaceId);
        onSaved?.(row);
      }
      onOpenChange(false);
    } catch (cause) {
      setError(cause instanceof ApiError ? apiErrorMessage(cause) : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-full"
        style={{ maxWidth: `min(92vw, ${420 + sectionColumns * 140}px)` }}
        data-density={density}
      >
        <form onSubmit={submit} className="flex flex-col" style={{ gap: 'var(--d-gap-section)' }}>
          <DialogHeader>
            <DialogTitle>
              {mode === 'create' ? `New ${object.singular.toLowerCase()}` : `Edit ${object.singular.toLowerCase()}`}
            </DialogTitle>
          </DialogHeader>

          {sections.map((section) => (
            <fieldset key={section.title} className="min-w-0">
              <legend className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
                {section.title}
              </legend>
              <div
                className="grid"
                style={{
                  gap: 'var(--d-gap-field)',
                  rowGap: 'var(--d-gap-field)',
                  gridTemplateColumns: `repeat(${sectionColumns}, minmax(160px, 1fr))`,
                }}
              >
                {section.fields.map((field) => {
                  const locked = lockedFields?.includes(field.key);
                  return (
                    <div
                      key={field.key}
                      className="space-y-1.5"
                      style={field.type === 'longtext' ? { gridColumn: '1 / -1' } : undefined}
                    >
                      <Label htmlFor={field.key}>
                        {field.label}
                        {field.required ? <span className="text-destructive"> *</span> : null}
                      </Label>
                      {locked ? (
                        <p className="text-muted-foreground py-2 text-sm">{String(form[field.key] ?? '—')}</p>
                      ) : (
                        <FieldInput
                          id={field.key}
                          field={field}
                          value={form[field.key]}
                          onChange={(value) => set(field.key, value)}
                          workspaceId={workspaceId}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </fieldset>
          ))}

          {error ? <p className="text-destructive text-sm">{error}</p> : null}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || missingRequired}>
              {saving ? 'Saving…' : mode === 'create' ? `Create ${object.singular.toLowerCase()}` : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function apiErrorMessage(error: ApiError): string {
  if (typeof error.detail === 'string') return error.detail;
  if (Array.isArray(error.detail)) {
    return error.detail
      .map(
        (issue: { path?: unknown[]; message?: string }) =>
          `${issue.path?.join('.') ?? 'field'}: ${issue.message ?? 'invalid'}`,
      )
      .join('; ');
  }
  return error.message;
}
