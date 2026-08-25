'use client';

import { ChevronRight, Plus, type LucideIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

export type RelatedColumn<Row> = { key: string; label: string; render: (row: Row) => React.ReactNode };

/**
 * A compact table showing records related to the one being viewed. Junction objects (EntityPerson,
 * IncidentCase) are never shown as their own thing — the caller pre-joins
 * them into plain rows, so this component only ever renders "the people /
 * deals / cases that belong here."
 *
 * If `expand` is given, a row click opens an inline detail panel instead of
 * navigating away.
 */
export function RelatedList<Row extends { id: string }>({
  title,
  icon: Icon,
  rows,
  columns,
  onAdd,
  addLabel = 'Add',
  href,
  expand,
  emptyLabel = 'Nothing here yet.',
}: {
  title: string;
  icon?: LucideIcon;
  rows: Row[];
  columns: RelatedColumn<Row>[];
  onAdd?: () => void;
  addLabel?: string;
  href?: (row: Row) => string;
  expand?: (row: Row) => React.ReactNode;
  emptyLabel?: string;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          {Icon ? <Icon className="text-muted-foreground size-4" /> : null}
          {title}
          <span className="text-muted-foreground font-normal">({rows.length})</span>
        </h3>
        {onAdd ? (
          <Button size="sm" variant="outline" onClick={onAdd}>
            <Plus /> {addLabel}
          </Button>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <p className="text-muted-foreground rounded-md border border-dashed p-4 text-center text-sm">{emptyLabel}</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow style={{ height: 'var(--d-row-h)' }}>
                {columns.map((col) => (
                  <TableHead key={col.key} style={{ padding: 'var(--d-cell-py) var(--d-cell-px)', fontSize: 'var(--d-font-sm)' }}>
                    {col.label}
                  </TableHead>
                ))}
                {expand ? <TableHead className="w-8" /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <RowFragment
                  key={row.id}
                  row={row}
                  columns={columns}
                  href={href}
                  expand={expand}
                  isExpanded={expanded.has(row.id)}
                  onToggle={() => toggle(row.id)}
                  onNavigate={() => href && router.push(href(row))}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}

function RowFragment<Row extends { id: string }>({
  row,
  columns,
  href,
  expand,
  isExpanded,
  onToggle,
  onNavigate,
}: {
  row: Row;
  columns: RelatedColumn<Row>[];
  href?: (row: Row) => string;
  expand?: (row: Row) => React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  onNavigate: () => void;
}) {
  const clickable = Boolean(href || expand);
  return (
    <>
      <TableRow
        style={{ height: 'var(--d-row-h)' }}
        className={cn(clickable && 'cursor-pointer')}
        onClick={expand ? onToggle : href ? onNavigate : undefined}
      >
        {columns.map((col, i) => (
          <TableCell
            key={col.key}
            style={{ padding: 'var(--d-cell-py) var(--d-cell-px)', fontSize: 'var(--d-font)' }}
            className={i === 0 ? 'font-medium' : undefined}
          >
            {col.render(row)}
          </TableCell>
        ))}
        {expand ? (
          <TableCell style={{ padding: 'var(--d-cell-py) var(--d-cell-px)' }}>
            <ChevronRight className={cn('text-muted-foreground size-4 transition-transform', isExpanded && 'rotate-90')} />
          </TableCell>
        ) : null}
      </TableRow>
      {expand && isExpanded ? (
        <TableRow className="bg-muted/40 hover:bg-muted/40">
          <TableCell colSpan={columns.length + 1} className="p-0">
            <div style={{ padding: 'var(--d-cell-px)' }}>{expand(row)}</div>
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}
