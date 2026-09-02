'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { PermissionCatalog, ProfileGrants } from '@/lib/security/client';
import type { FieldAccess, ObjectAction } from '@/lib/security/types';
import { cn } from '@/lib/utils';

/**
 * The permission grid: one row per object, expanding to one row per field.
 *
 * Object and field security are edited together rather than on two screens,
 * because they are one decision. "Support may read Deals but not the amount" is
 * a single sentence, and splitting it across two pages is how the second half
 * gets forgotten.
 *
 * Fields are collapsed by default. There are several hundred across the app and
 * almost all of them are unrestricted; showing them all would bury the four
 * that matter.
 */

const ACTIONS: ObjectAction[] = ['read', 'create', 'edit', 'delete'];

const ACTION_LABELS: Record<ObjectAction, string> = {
  read: 'Read',
  create: 'Create',
  edit: 'Edit',
  delete: 'Delete',
};

const FIELD_ACCESS_LABELS: Record<FieldAccess, string> = {
  edit: 'Edit',
  read: 'Read only',
  hidden: 'Hidden',
};

const noAccess = (): Record<ObjectAction, boolean> => ({
  read: false,
  create: false,
  edit: false,
  delete: false,
});

export function PermissionGrid({
  catalog,
  grants,
  onChange,
  disabled,
}: {
  catalog: PermissionCatalog;
  grants: ProfileGrants;
  onChange: (next: ProfileGrants) => void;
  /** An administrator profile's grants are shown but not editable. */
  disabled?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const objects = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return catalog.objects;
    return catalog.objects.filter(
      (object) =>
        object.object_key.includes(needle) ||
        object.label.toLowerCase().includes(needle) ||
        object.fields.some((field) => field.includes(needle)),
    );
  }, [catalog.objects, query]);

  const setAction = (objectKey: string, action: ObjectAction, value: boolean) => {
    const current = grants.objects[objectKey] ?? noAccess();
    const next: Record<ObjectAction, boolean> = { ...current, [action]: value };

    // Nothing can be done to a record that cannot be read, so the other three
    // follow read rather than being separately meaningless.
    if (action === 'read' && !value) {
      next.create = false;
      next.edit = false;
      next.delete = false;
    }
    if (value && action !== 'read') next.read = true;

    onChange({ ...grants, objects: { ...grants.objects, [objectKey]: next } });
  };

  const setFieldAccess = (objectKey: string, fieldKey: string, access: FieldAccess) => {
    const fields = { ...(grants.fields[objectKey] ?? {}) };
    // `edit` is the default, so it is stored as the absence of a restriction.
    if (access === 'edit') delete fields[fieldKey];
    else fields[fieldKey] = access;

    const nextFields = { ...grants.fields };
    if (Object.keys(fields).length === 0) delete nextFields[objectKey];
    else nextFields[objectKey] = fields;

    onChange({ ...grants, fields: nextFields });
  };

  const toggleExpanded = (objectKey: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(objectKey)) next.delete(objectKey);
      else next.add(objectKey);
      return next;
    });

  return (
    <div className="space-y-3">
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Filter objects and fields…"
        className="max-w-sm"
      />

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Object</th>
              {ACTIONS.map((action) => (
                <th key={action} className="w-20 px-3 py-2 text-center font-medium">
                  {ACTION_LABELS[action]}
                </th>
              ))}
              <th className="w-32 px-3 py-2 text-right font-medium">Fields</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {objects.map((object) => {
              const actions = grants.objects[object.object_key] ?? noAccess();
              const restricted = Object.keys(grants.fields[object.object_key] ?? {}).length;
              const isOpen = expanded.has(object.object_key);

              return (
                <FragmentRow
                  key={object.object_key}
                  open={isOpen}
                  onToggle={() => toggleExpanded(object.object_key)}
                  label={object.label}
                  objectKey={object.object_key}
                  actions={actions}
                  restricted={restricted}
                  fields={object.fields}
                  fieldGrants={grants.fields[object.object_key] ?? {}}
                  disabled={disabled}
                  onAction={(action, value) => setAction(object.object_key, action, value)}
                  onField={(fieldKey, access) => setFieldAccess(object.object_key, fieldKey, access)}
                />
              );
            })}
            {objects.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-muted-foreground px-3 py-6 text-center">
                  Nothing matches “{query}”.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FragmentRow({
  open,
  onToggle,
  label,
  objectKey,
  actions,
  restricted,
  fields,
  fieldGrants,
  disabled,
  onAction,
  onField,
}: {
  open: boolean;
  onToggle: () => void;
  label: string;
  objectKey: string;
  actions: Record<ObjectAction, boolean>;
  restricted: number;
  fields: string[];
  fieldGrants: Record<string, FieldAccess>;
  disabled?: boolean;
  onAction: (action: ObjectAction, value: boolean) => void;
  onField: (fieldKey: string, access: FieldAccess) => void;
}) {
  return (
    <>
      <tr className={cn(!actions.read && 'text-muted-foreground')}>
        <td className="px-3 py-2">
          <button
            type="button"
            onClick={onToggle}
            className="flex items-center gap-1.5 text-left hover:underline"
            aria-expanded={open}
          >
            {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
            <span className="font-medium">{label}</span>
            <code className="text-muted-foreground text-xs">{objectKey}</code>
          </button>
        </td>
        {ACTIONS.map((action) => (
          <td key={action} className="px-3 py-2 text-center">
            <Checkbox
              checked={actions[action]}
              disabled={disabled || (action !== 'read' && !actions.read)}
              onCheckedChange={(value) => onAction(action, value === true)}
              aria-label={`${ACTION_LABELS[action]} ${label}`}
            />
          </td>
        ))}
        <td className="px-3 py-2 text-right">
          {restricted > 0 ? (
            <Badge variant="secondary">{restricted} restricted</Badge>
          ) : (
            <span className="text-muted-foreground text-xs">All</span>
          )}
        </td>
      </tr>

      {open
        ? fields.map((field) => (
            <tr key={field} className="bg-muted/20">
              <td className="py-1.5 pr-3 pl-10">
                <code className="text-xs">{field}</code>
              </td>
              <td colSpan={4} className="px-3 py-1.5">
                {!actions.read ? (
                  <span className="text-muted-foreground text-xs">
                    Hidden — the object itself is not readable.
                  </span>
                ) : null}
              </td>
              <td className="px-3 py-1.5 text-right">
                <Select
                  value={fieldGrants[field] ?? 'edit'}
                  disabled={disabled || !actions.read}
                  onValueChange={(value) => onField(field, value as FieldAccess)}
                >
                  <SelectTrigger className="ml-auto w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(['edit', 'read', 'hidden'] as FieldAccess[]).map((access) => (
                      <SelectItem key={access} value={access}>
                        {FIELD_ACCESS_LABELS[access]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </td>
            </tr>
          ))
        : null}
    </>
  );
}
