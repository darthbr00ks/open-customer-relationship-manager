'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { EmptyState, NoWorkspace } from '@/components/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api-client';
import type { Entity } from '@/lib/types';
import { useWorkspaceStore } from '@/stores/workspace';

export default function EntitiesPage() {
  const workspaceId = useWorkspaceStore((state) => state.workspaceId);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);

  // All state updates happen after the await, so the effect body never renders
  // synchronously into another render.
  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;

    void (async () => {
      try {
        const rows = await api.list<Entity>('entities', {
          workspace_id: workspaceId,
          include_archived: includeArchived,
          limit: 100,
        });
        if (cancelled) return;
        setEntities(rows);
        setError(null);
      } catch (cause) {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : 'Failed to load entities');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [workspaceId, includeArchived, reloadToken]);

  const reload = () => setReloadToken((token) => token + 1);

  const archive = async (id: string) => {
    if (!workspaceId) return;
    await api.archive('entities', id, workspaceId);
    reload();
  };

  if (!workspaceId) return <NoWorkspace />;

  // Filtering the loaded page client-side; server-side search is a separate concern.
  const visible = entities.filter((entity) =>
    entity.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Entities</h1>
        <Button asChild>
          <Link href="/entities/new">New entity</Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Filter by name…"
          className="max-w-xs"
        />
        <label className="text-muted-foreground flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(event) => setIncludeArchived(event.target.checked)}
          />
          Include archived
        </label>
      </div>

      {error ? <EmptyState title="Could not load entities" hint={error} /> : null}

      {!error && visible.length === 0 ? (
        <EmptyState
          title={loading ? 'Loading…' : 'No entities yet'}
          hint={loading ? undefined : 'Create one, or bulk-import from CSV.'}
        />
      ) : null}

      {visible.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>Email</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((entity) => (
              <TableRow key={entity.id}>
                <TableCell className="font-medium">
                  {entity.name}
                  {entity.archived_at ? (
                    <Badge variant="secondary" className="ml-2">
                      archived
                    </Badge>
                  ) : null}
                </TableCell>
                <TableCell className="capitalize">{entity.entity_type}</TableCell>
                <TableCell className="capitalize">
                  {entity.relationship_stage.replace('_', ' ')}
                </TableCell>
                <TableCell className="text-muted-foreground">{entity.primary_email ?? '—'}</TableCell>
                <TableCell className="text-right">
                  {entity.archived_at ? null : (
                    <Button size="sm" variant="ghost" onClick={() => void archive(entity.id)}>
                      Archive
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}
    </div>
  );
}
