'use client';

import { useEffect, useRef, useState } from 'react';

import { FieldInput } from '@/components/fields/field-input';
import { FieldValue } from '@/components/fields/field-value';
import { api, ApiError } from '@/lib/api-client';
import type { ResourceName } from '@/lib/api/resources';
import { invalidateList } from '@/lib/data-cache';
import type { FieldDef } from '@/lib/schema/types';
import { useCurrentUserStore } from '@/stores/current-user';

/** Field types that commit on selection rather than needing an explicit save gesture. */
const AUTO_SAVE_TYPES = new Set(['select', 'user', 'lookup', 'boolean']);

/**
 * A field on a record's Overview tab that becomes editable in place on a
 * double-click — spec's create/edit form is still there for everything at
 * once, but a single wrong value shouldn't need the whole dialog. Saves on
 * Enter or on losing focus, discards on Escape. Read-only fields (system
 * timestamps, audit trail) never become editable.
 */
export function EditableField({
  field,
  value,
  workspaceId,
  resource,
  recordId,
}: {
  field: FieldDef;
  value: unknown;
  workspaceId: string | null;
  resource: ResourceName;
  recordId: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<unknown>(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const cancelledRef = useRef(false);
  const currentUser = useCurrentUserStore();

  useEffect(() => {
    if (!editing) return;
    const el = containerRef.current?.querySelector<HTMLElement>('input, textarea, [role="combobox"]');
    el?.focus();
  }, [editing]);

  if (field.readOnly) {
    return <FieldValue field={field} value={value} workspaceId={workspaceId} />;
  }

  const startEdit = () => {
    cancelledRef.current = false;
    setError(null);
    setDraft(value);
    setEditing(true);
  };

  const cancel = () => {
    cancelledRef.current = true;
    setEditing(false);
  };

  const save = async (nextValue: unknown) => {
    if (cancelledRef.current) return;
    if (nextValue === value || !workspaceId) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.update(resource, recordId, workspaceId, {
        [field.key]: nextValue === '' ? null : nextValue,
        updated_by_user_id: currentUser.userId,
      });
      invalidateList(resource, workspaceId);
      setEditing(false);
    } catch (cause) {
      setError(cause instanceof ApiError ? apiErrorMessage(cause) : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <div
        onDoubleClick={startEdit}
        className="-mx-1 -my-0.5 cursor-text rounded px-1 py-0.5 hover:bg-accent/60"
        title="Double-click to edit"
      >
        <FieldValue field={field} value={value} workspaceId={workspaceId} />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="-mx-1"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          cancel();
        } else if (event.key === 'Enter' && field.type !== 'longtext') {
          event.preventDefault();
          void save(draft);
        }
      }}
      onBlur={(event) => {
        if (cancelledRef.current) return;
        const related = event.relatedTarget as HTMLElement | null;
        // Don't save-and-close for a blur caused by focus moving to something still
        // logically inside this field. That includes a Select's own dropdown, which
        // Radix renders in a portal — outside this container's DOM subtree entirely —
        // so plain `.contains()` alone doesn't recognize it as "still in the field".
        if (containerRef.current?.contains(related)) return;
        if (related?.closest('[data-slot="select-content"]')) return;
        void save(draft);
      }}
    >
      <FieldInput
        field={field}
        value={draft}
        onChange={(next) => {
          setDraft(next);
          if (AUTO_SAVE_TYPES.has(field.type)) void save(next);
        }}
        workspaceId={workspaceId}
      />
      {saving ? <p className="text-muted-foreground mt-1 text-xs">Saving…</p> : null}
      {error ? <p className="text-destructive mt-1 text-xs">{error}</p> : null}
    </div>
  );
}

function apiErrorMessage(error: ApiError): string {
  if (typeof error.detail === 'string') return error.detail;
  if (Array.isArray(error.detail)) {
    return error.detail
      .map((issue: { path?: unknown[]; message?: string }) => `${issue.path?.join('.') ?? 'field'}: ${issue.message ?? 'invalid'}`)
      .join('; ');
  }
  return error.message;
}
