'use client';

import { useEffect, useState } from 'react';

import { EmptyState, NoWorkspace } from '@/components/empty-state';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api-client';
import type { SupportCase } from '@/lib/types';
import { useWorkspaceStore } from '@/stores/workspace';

const PRIORITY_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  low: 'outline',
  medium: 'secondary',
  high: 'default',
  urgent: 'destructive',
};

export default function CasesPage() {
  const workspaceId = useWorkspaceStore((state) => state.workspaceId);
  const [cases, setCases] = useState<SupportCase[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;

    void (async () => {
      try {
        const rows = await api.list<SupportCase>('cases', {
          workspace_id: workspaceId,
          limit: 100,
        });
        if (!cancelled) setCases(rows);
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'Failed to load cases');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  if (!workspaceId) return <NoWorkspace />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Cases</h1>

      {error ? <EmptyState title="Could not load cases" hint={error} /> : null}

      {!error && cases.length === 0 ? (
        <EmptyState title="No cases yet" hint="Cases created through the API appear here." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Number</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Priority</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cases.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-mono text-xs">{item.case_number}</TableCell>
                <TableCell className="font-medium">{item.subject}</TableCell>
                <TableCell className="capitalize">{item.status}</TableCell>
                <TableCell>
                  <Badge variant={PRIORITY_VARIANT[item.priority] ?? 'secondary'}>{item.priority}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
