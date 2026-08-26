'use client';

import { useEffect, useState } from 'react';

import { EmptyState, NoWorkspace } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api-client';
import type { PipelineReport } from '@/lib/types';
import { useWorkspaceStore } from '@/stores/workspace';

export default function DashboardPage() {
  const workspaceId = useWorkspaceStore((state) => state.workspaceId);
  const [report, setReport] = useState<PipelineReport | null>(null);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;

    void (async () => {
      try {
        const result = (await api.reportPipeline(workspaceId)) as
          | PipelineReport
          | { detail: string };
        if (cancelled) return;
        // A cold cache returns 202 with a job id; the worker fills it in shortly.
        setReport('by_stage' in result ? result : null);
        setError(null);
      } catch (cause) {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : 'Failed to load report');
      } finally {
        if (!cancelled) setPending(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [workspaceId, reloadToken]);

  const refresh = () => {
    setPending(true);
    setReloadToken((token) => token + 1);
  };

  if (!workspaceId) return <NoWorkspace />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pipeline</h1>
          <p className="text-muted-foreground text-sm">
            Open deal value by stage, computed in the background and served from cache.
          </p>
        </div>
        <Button onClick={refresh} disabled={pending}>
          {pending ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>

      {error ? <EmptyState title="Could not load the report" hint={error} /> : null}

      {!report && !error ? (
        <EmptyState
          title="Report is being generated"
          hint="The worker is computing it now — refresh in a moment. Make sure `npm run worker` is running."
        />
      ) : null}

      {report ? (
        <Card>
          <CardHeader>
            <CardTitle>Open pipeline</CardTitle>
            <CardDescription>
              Total {report.total_open_value} · generated {new Date(report.generated_at).toLocaleString()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {report.by_stage.length === 0 ? (
              <p className="text-muted-foreground text-sm">No open deals in this workspace.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Stage</TableHead>
                    <TableHead>Deals</TableHead>
                    <TableHead>Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.by_stage.map((row) => (
                    <TableRow key={row.stage}>
                      <TableCell className="capitalize">{row.stage}</TableCell>
                      <TableCell>{row.count}</TableCell>
                      <TableCell>{row.value}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
