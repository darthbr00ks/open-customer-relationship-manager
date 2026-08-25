'use client';

import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { useUserLabel } from '@/hooks/use-user-label';
import { useLookupMap } from '@/lib/data-cache';
import { formatCurrency, formatDate, formatDateTime, formatLabel } from '@/lib/format';
import { objectKeyForResource, OBJECTS } from '@/lib/objects';
import type { FieldDef } from '@/lib/schema/types';

/**
 * Renders one field's *value* — the display half of the field system. The
 * companion `FieldInput` (fields/field-input.tsx) renders the editable half;
 * both read the same `FieldDef` so a field's behavior only has to be taught
 * to the system once.
 */
export function FieldValue({
  field,
  value,
  workspaceId,
  compact = false,
}: {
  field: FieldDef;
  value: unknown;
  workspaceId: string | null;
  /** Table-cell rendering: single line, truncated. */
  compact?: boolean;
}) {
  const userLabel = useUserLabel();

  if (value == null || value === '') {
    return <span className="text-muted-foreground">—</span>;
  }

  switch (field.type) {
    case 'select': {
      const str = String(value);
      const label = formatLabel(str);
      return field.badgeTone ? (
        <Badge variant={field.badgeTone(str)}>{label}</Badge>
      ) : (
        <span className="capitalize">{label}</span>
      );
    }
    case 'boolean':
      return <span>{value ? 'Yes' : 'No'}</span>;
    case 'date':
      return <span>{formatDate(String(value))}</span>;
    case 'datetime':
      return <span>{formatDateTime(String(value))}</span>;
    case 'currency':
      return <span className="tabular-nums">{formatCurrency(String(value))}</span>;
    case 'number':
      return <span className="tabular-nums">{String(value)}</span>;
    case 'user':
      return <span>{userLabel(String(value))}</span>;
    case 'email':
      return (
        <a href={`mailto:${value}`} className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
          {String(value)}
        </a>
      );
    case 'phone':
      return (
        <a href={`tel:${value}`} className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
          {String(value)}
        </a>
      );
    case 'url': {
      const href = /^https?:\/\//.test(String(value)) ? String(value) : `https://${value}`;
      return (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="text-primary hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {String(value)}
        </a>
      );
    }
    case 'lookup':
      return <LookupValue field={field} value={String(value)} workspaceId={workspaceId} />;
    case 'longtext':
      return compact ? (
        <span className="block max-w-xs truncate">{String(value)}</span>
      ) : (
        <p className="whitespace-pre-wrap">{String(value)}</p>
      );
    default:
      return <span>{String(value)}</span>;
  }
}

function LookupValue({
  field,
  value,
  workspaceId,
}: {
  field: FieldDef;
  value: string;
  workspaceId: string | null;
}) {
  const lookup = field.lookup!;
  const { map, loading } = useLookupMap<{ id: string }>(lookup.resource, workspaceId);
  const row = map.get(value);
  const objectKey = objectKeyForResource(lookup.resource);

  if (!row) {
    return <span className="text-muted-foreground">{loading ? 'Loading…' : 'Unknown'}</span>;
  }

  const label = lookup.labelOf(row as never);
  if (!objectKey) return <span>{label}</span>;

  return (
    <Link
      href={`${OBJECTS[objectKey].routeBase}/${value}`}
      className="text-primary hover:underline"
      onClick={(e) => e.stopPropagation()}
    >
      {label}
    </Link>
  );
}
