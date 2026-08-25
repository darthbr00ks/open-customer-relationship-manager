'use client';

import { FieldValue } from '@/components/fields/field-value';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useCachedList } from '@/lib/data-cache';
import { DEMO_USERS } from '@/lib/demo-users';
import { formatLabel } from '@/lib/format';
import type { FieldDef } from '@/lib/schema/types';
import { useCurrentUserStore } from '@/stores/current-user';

/** Editable half of the field system — the counterpart to `FieldValue`. */
export function FieldInput({
  field,
  value,
  onChange,
  workspaceId,
  id,
}: {
  field: FieldDef;
  value: unknown;
  onChange: (value: unknown) => void;
  workspaceId: string | null;
  id?: string;
}) {
  if (field.readOnly) {
    // Same rendering as the display-only field system — dates get formatted, `*_user_id`
    // gets resolved to a name — instead of dumping the raw stored value.
    return (
      <p className="py-2 text-sm">
        <FieldValue field={field} value={value} workspaceId={workspaceId} />
      </p>
    );
  }

  switch (field.type) {
    case 'longtext':
      return (
        <Textarea
          id={id}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          rows={3}
        />
      );
    case 'boolean':
      return (
        <div className="flex h-9 items-center">
          <Checkbox checked={Boolean(value)} onCheckedChange={(checked) => onChange(checked === true)} id={id} />
        </div>
      );
    case 'select':
      return (
        <Select value={(value as string) ?? undefined} onValueChange={onChange}>
          <SelectTrigger id={id}>
            <SelectValue placeholder={field.placeholder ?? 'Select…'} />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((option) => (
              <SelectItem key={option} value={option}>
                {formatLabel(option)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case 'user':
      return <UserSelect id={id} value={value as string | undefined} onChange={onChange} />;
    case 'lookup':
      return <LookupSelect id={id} field={field} value={value as string | undefined} onChange={onChange} workspaceId={workspaceId} />;
    case 'number':
      return (
        <Input
          id={id}
          type="number"
          value={(value as number | string) ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
        />
      );
    case 'currency':
      return (
        <div className="relative">
          <span className="text-muted-foreground pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm">$</span>
          <Input
            id={id}
            type="number"
            step="0.01"
            className="pl-6"
            value={(value as string) ?? ''}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );
    case 'date':
      return <Input id={id} type="date" value={(value as string)?.slice(0, 10) ?? ''} onChange={(e) => onChange(e.target.value)} />;
    case 'datetime':
      return (
        <Input
          id={id}
          type="datetime-local"
          value={toLocalInputValue(value as string | undefined)}
          onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : undefined)}
        />
      );
    case 'email':
      return <Input id={id} type="email" value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} />;
    case 'phone':
      return <Input id={id} type="tel" value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} />;
    case 'url':
      return <Input id={id} type="url" value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} placeholder="https://" />;
    default:
      return (
        <Input
          id={id}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
        />
      );
  }
}

function toLocalInputValue(iso: string | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function UserSelect({
  id,
  value,
  onChange,
}: {
  id?: string;
  value: string | undefined;
  onChange: (value: unknown) => void;
}) {
  // Select each field separately — a selector that builds a new object every call defeats
  // zustand's equality check and loops (see the similar fix in list-view.tsx).
  const myUserId = useCurrentUserStore((state) => state.userId);
  const myDisplayName = useCurrentUserStore((state) => state.displayName);
  return (
    <Select value={value ?? undefined} onValueChange={onChange}>
      <SelectTrigger id={id}>
        <SelectValue placeholder="Unassigned" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={myUserId}>{myDisplayName} (you)</SelectItem>
        {DEMO_USERS.map((user) => (
          <SelectItem key={user.id} value={user.id}>
            {user.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function LookupSelect({
  id,
  field,
  value,
  onChange,
  workspaceId,
}: {
  id?: string;
  field: FieldDef;
  value: string | undefined;
  onChange: (value: unknown) => void;
  workspaceId: string | null;
}) {
  const lookup = field.lookup!;
  const { rows } = useCachedList<{ id: string }>(lookup.resource, workspaceId, { includeArchived: false });

  return (
    <Select value={value ?? undefined} onValueChange={onChange}>
      <SelectTrigger id={id}>
        <SelectValue placeholder={field.placeholder ?? 'Select…'} />
      </SelectTrigger>
      <SelectContent>
        {rows.map((row) => (
          <SelectItem key={row.id} value={row.id}>
            {lookup.labelOf(row as never)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
