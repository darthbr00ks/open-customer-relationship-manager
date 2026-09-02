'use client';

import Link from 'next/link';
import { ArrowDown, ArrowUp, ArrowUpDown, Columns3, Filter, Plus, X } from 'lucide-react';
import { useMemo, useState } from 'react';

import { FieldValue } from '@/components/fields/field-value';
import { FieldInput } from '@/components/fields/field-input';
import { NoWorkspace } from '@/components/empty-state';
import { RecordFormDialog } from '@/components/record-form-dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api-client';
import { invalidateList, useCachedList } from '@/lib/data-cache';
import { objectAllFields, titleOf, OBJECTS, type ObjectKey } from '@/lib/objects';
import type { FieldDef } from '@/lib/schema/types';
import { useSavedViewsStore, type SavedView, type ViewFilter } from '@/stores/saved-views';
import { useCurrentUserStore } from '@/stores/current-user';
import { fieldIsVisible, usePermissions } from '@/stores/permissions';
import { useWorkspaceStore } from '@/stores/workspace';

type Row = Record<string, unknown> & { id: string; archived_at: string | null };

/** Fields that make sense as an equality filter — enums and lookups, not free text. */
function filterableFields(objectKey: ObjectKey): FieldDef[] {
  return objectAllFields(objectKey).filter((field) => ['select', 'user', 'lookup', 'boolean'].includes(field.type));
}

function builtinViews(objectKey: ObjectKey): SavedView[] {
  const object = OBJECTS[objectKey];
  const columns = object.listColumns.map((field) => field.key);
  return [
    { id: `${objectKey}:all`, objectKey, name: `All ${object.plural}`, filters: [], sort: { field: 'created_at', direction: 'desc' }, columns, includeArchived: false, builtin: true },
    { id: `${objectKey}:mine`, objectKey, name: `My ${object.plural}`, filters: [{ field: 'owner_user_id', equals: '$me' }], sort: { field: 'created_at', direction: 'desc' }, columns, includeArchived: false, builtin: true },
  ];
}

export function ListView({ objectKey }: { objectKey: ObjectKey }) {
  const object = OBJECTS[objectKey];
  const workspaceId = useWorkspaceStore((state) => state.workspaceId);
  const currentUserId = useCurrentUserStore((state) => state.userId);
  const permissions = usePermissions();

  // Select the raw (referentially stable) array and filter it here rather than in the selector —
  // a selector that returns a fresh array every call defeats zustand's equality check and loops.
  const allSavedViews = useSavedViewsStore((state) => state.views);
  const activeId = useSavedViewsStore((state) => state.active[objectKey]);
  const setActiveView = useSavedViewsStore((state) => state.setActive);
  const addView = useSavedViewsStore((state) => state.addView);
  const removeView = useSavedViewsStore((state) => state.removeView);

  const views = useMemo(
    () => [...builtinViews(objectKey), ...allSavedViews.filter((view) => view.objectKey === objectKey)],
    [objectKey, allSavedViews],
  );
  const active = views.find((view) => view.id === activeId) ?? views[0]!;

  // Working copies so ad-hoc tweaks (filter, sort, columns) don't mutate a saved view until "Save".
  const [filters, setFilters] = useState<ViewFilter[]>(active.filters);
  const [sort, setSort] = useState(active.sort);
  const [columns, setColumns] = useState<string[]>(active.columns);
  const [includeArchived, setIncludeArchived] = useState(active.includeArchived);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [visibleCount, setVisibleCount] = useState(50);
  const [lastAppliedViewId, setLastAppliedViewId] = useState(active.id);

  if (lastAppliedViewId !== active.id) {
    setLastAppliedViewId(active.id);
    setFilters(active.filters);
    setSort(active.sort);
    setColumns(active.columns);
    setIncludeArchived(active.includeArchived);
    setSelected(new Set());
    setVisibleCount(50);
  }

  const { rows, loading, error, refresh } = useCachedList<Row>(object.resource, workspaceId, {
    includeArchived,
    limit: 200,
  });

  const filtered = useMemo(() => {
    let result = rows;
    for (const filter of filters) {
      const value = filter.equals === '$me' ? currentUserId : filter.equals;
      result = result.filter((row) => String(row[filter.field] ?? '') === value);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((row) =>
        object.searchFields.some((field) => String(row[field] ?? '').toLowerCase().includes(q)),
      );
    }
    const sorted = [...result].sort((a, b) => {
      const av = String(a[sort.field] ?? '');
      const bv = String(b[sort.field] ?? '');
      const cmp = av.localeCompare(bv);
      return sort.direction === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [rows, filters, search, sort, currentUserId, object.searchFields]);

  const visible = filtered.slice(0, visibleCount);
  const columnFields = (
    columns.map((key) => objectAllFields(objectKey).find((field) => field.key === key)).filter(Boolean) as FieldDef[]
  ).filter((field) => fieldIsVisible(permissions, object.resource, field.key));

  const toggleSort = (key: string) =>
    setSort((current) => (current.field === key ? { field: key, direction: current.direction === 'asc' ? 'desc' : 'asc' } : { field: key, direction: 'asc' }));

  const toggleColumn = (key: string) =>
    setColumns((current) => (current.includes(key) ? current.filter((k) => k !== key) : [...current, key]));

  const toggleSelectAll = () =>
    setSelected((current) => (current.size === visible.length ? new Set() : new Set(visible.map((row) => row.id))));

  const bulkArchive = async () => {
    if (!workspaceId) return;
    await Promise.all([...selected].map((id) => api.archive(object.resource, id, workspaceId)));
    invalidateList(object.resource, workspaceId);
    setSelected(new Set());
  };

  const saveAsNewView = () => {
    const name = window.prompt(`Name this view of ${object.plural}`);
    if (!name) return;
    const view: SavedView = {
      id: crypto.randomUUID(),
      objectKey,
      name,
      filters,
      sort,
      columns,
      includeArchived,
    };
    addView(view);
    setActiveView(objectKey, view.id);
  };

  if (!workspaceId) return <NoWorkspace />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{object.plural}</h1>
          <p className="text-muted-foreground text-sm">
            {loading ? 'Loading…' : `${filtered.length} of ${rows.length} loaded`}
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus /> New {object.singular.toLowerCase()}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={active.id} onValueChange={(id) => setActiveView(objectKey, id)}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {views.map((view) => (
              <SelectItem key={view.id} value={view.id}>
                {view.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={`Search ${object.plural.toLowerCase()}…`}
          className="max-w-56"
        />

        <FilterPopover objectKey={objectKey} filters={filters} onChange={setFilters} workspaceId={workspaceId} />

        <ColumnPopover objectKey={objectKey} columns={columns} onToggle={toggleColumn} />

        <label className="text-muted-foreground ml-1 flex items-center gap-2 text-sm">
          <Switch checked={includeArchived} onCheckedChange={setIncludeArchived} />
          Archived
        </label>

        <div className="ml-auto flex items-center gap-2">
          {!active.builtin ? (
            <Button size="sm" variant="ghost" onClick={() => removeView(active.id)}>
              Delete view
            </Button>
          ) : null}
          <Button size="sm" variant="outline" onClick={saveAsNewView}>
            Save as new view
          </Button>
        </div>
      </div>

      {selected.size > 0 ? (
        <div className="bg-accent flex items-center gap-3 rounded-md px-3 py-2 text-sm">
          <span className="font-medium">{selected.size} selected</span>
          <Button size="sm" variant="secondary" onClick={() => void bulkArchive()}>
            Archive selected
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="text-sm font-medium">Could not load {object.plural.toLowerCase()}</p>
          <p className="text-muted-foreground mt-1 text-sm">{error}</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={refresh}>
            Retry
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="text-sm font-medium">{loading ? 'Loading…' : `No ${object.plural.toLowerCase()} match this view`}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow style={{ height: 'var(--d-row-h)' }}>
                <TableHead style={{ padding: 'var(--d-cell-py) var(--d-cell-px)' }} className="w-8">
                  <Checkbox checked={selected.size > 0 && selected.size === visible.length} onCheckedChange={toggleSelectAll} />
                </TableHead>
                {columnFields.map((field) => (
                  <TableHead key={field.key} style={{ padding: 'var(--d-cell-py) var(--d-cell-px)', fontSize: 'var(--d-font-sm)' }}>
                    <button type="button" className="flex items-center gap-1 hover:underline" onClick={() => toggleSort(field.key)}>
                      {field.label}
                      {sort.field === field.key ? (
                        sort.direction === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />
                      ) : (
                        <ArrowUpDown className="size-3 opacity-30" />
                      )}
                    </button>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((row) => (
                <TableRow key={row.id} style={{ height: 'var(--d-row-h)' }} className="group">
                  <TableCell style={{ padding: 'var(--d-cell-py) var(--d-cell-px)' }} onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selected.has(row.id)}
                      onCheckedChange={(checked) =>
                        setSelected((current) => {
                          const next = new Set(current);
                          if (checked) next.add(row.id);
                          else next.delete(row.id);
                          return next;
                        })
                      }
                    />
                  </TableCell>
                  {columnFields.map((field, i) => (
                    <TableCell key={field.key} style={{ padding: 'var(--d-cell-py) var(--d-cell-px)', fontSize: 'var(--d-font)' }}>
                      {i === 0 ? (
                        <Link href={`${object.routeBase}/${row.id}`} className="font-medium hover:underline">
                          {titleOf(object, row)}
                          {row.archived_at ? <span className="text-muted-foreground ml-2 text-xs">(archived)</span> : null}
                        </Link>
                      ) : (
                        <FieldValue field={field} value={row[field.key]} workspaceId={workspaceId} compact />
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {filtered.length > visible.length ? (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={() => setVisibleCount((count) => count + 50)}>
            Show more ({filtered.length - visible.length} remaining)
          </Button>
        </div>
      ) : null}

      {creating && workspaceId ? (
        <RecordFormDialog open onOpenChange={setCreating} objectKey={objectKey} mode="create" workspaceId={workspaceId} />
      ) : null}
    </div>
  );
}

function FilterPopover({
  objectKey,
  filters,
  onChange,
  workspaceId,
}: {
  objectKey: ObjectKey;
  filters: ViewFilter[];
  onChange: (filters: ViewFilter[]) => void;
  workspaceId: string | null;
}) {
  const fields = filterableFields(objectKey);
  const [field, setField] = useState<FieldDef | null>(fields[0] ?? null);
  const [value, setValue] = useState<unknown>('');

  const addFilter = () => {
    if (!field || value === '' || value == null) return;
    onChange([...filters.filter((f) => f.field !== field.key), { field: field.key, equals: String(value) }]);
    setValue('');
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Filter className="size-3.5" /> Filter{filters.length ? ` (${filters.length})` : ''}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-3">
        {filters.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {filters.map((filter) => (
              <span key={filter.field} className="bg-secondary flex items-center gap-1 rounded-full py-0.5 pr-1 pl-2 text-xs">
                {fields.find((f) => f.key === filter.field)?.label ?? filter.field} = {filter.equals === '$me' ? 'me' : filter.equals}
                <button type="button" onClick={() => onChange(filters.filter((f) => f.field !== filter.field))}>
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        ) : null}
        <div className="space-y-1.5">
          <Label>Field</Label>
          <Select value={field?.key} onValueChange={(key) => setField(fields.find((f) => f.key === key) ?? null)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {fields.map((f) => (
                <SelectItem key={f.key} value={f.key}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {field?.type === 'user' ? (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" className="flex-1" onClick={() => onChange([...filters.filter((f) => f.field !== field.key), { field: field.key, equals: '$me' }])}>
              Me
            </Button>
          </div>
        ) : field ? (
          <div className="space-y-1.5">
            <Label>Value</Label>
            <FieldInput field={field} value={value} onChange={setValue} workspaceId={workspaceId} />
          </div>
        ) : null}
        <Button size="sm" className="w-full" onClick={addFilter} disabled={!field}>
          Add filter
        </Button>
      </PopoverContent>
    </Popover>
  );
}

function ColumnPopover({
  objectKey,
  columns,
  onToggle,
}: {
  objectKey: ObjectKey;
  columns: string[];
  onToggle: (key: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Columns3 className="size-3.5" /> Columns
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Show columns</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {objectAllFields(objectKey).map((field) => (
          <DropdownMenuCheckboxItem
            key={field.key}
            checked={columns.includes(field.key)}
            onSelect={(e) => e.preventDefault()}
            onCheckedChange={() => onToggle(field.key)}
          >
            {field.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
