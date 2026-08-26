'use client';

import { useEffect, useRef, useState } from 'react';

import { NoWorkspace } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useWorkspaceStore } from '@/stores/workspace';

const SAMPLE = `name,entity_type,relationship_stage,primary_email
Acme Corp,company,customer,hello@acme.test
Wayne Foundation,nonprofit,partner,contact@wayne.test`;

type JobStatus = {
  id: string;
  state: string;
  progress: number;
  result: { received: number; imported: number; skipped: { row: number; reason: string }[] } | null;
  failed_reason: string | null;
};

export default function ImportPage() {
  const workspaceId = useWorkspaceStore((state) => state.workspaceId);
  const [csv, setCsv] = useState(SAMPLE);
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Stop polling when the component unmounts.
  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current);
  }, []);

  const poll = (jobId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const response = await fetch(`/api/v1/jobs/${jobId}`);
      if (!response.ok) return;
      const next = (await response.json()) as JobStatus;
      setStatus(next);
      if (next.state === 'completed' || next.state === 'failed') {
        if (pollRef.current) clearInterval(pollRef.current);
      }
    }, 700);
  };

  const submit = async () => {
    if (!workspaceId) return;
    setSubmitting(true);
    setError(null);
    setStatus(null);
    try {
      const response = await fetch('/api/v1/jobs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ job: 'import-entities', workspace_id: workspaceId, csv }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(String(body.detail));
      poll(body.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not queue the import');
    } finally {
      setSubmitting(false);
    }
  };

  if (!workspaceId) return <NoWorkspace />;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Import entities</h1>
        <p className="text-muted-foreground text-sm">
          Parsing and writing run in the background worker, so a large file does not tie up a request.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="csv">CSV</Label>
        <Textarea
          id="csv"
          value={csv}
          onChange={(event) => setCsv(event.target.value)}
          rows={10}
          className="font-mono text-xs"
        />
        <p className="text-muted-foreground text-xs">
          A header row naming entity fields, then one entity per line.
        </p>
      </div>

      <Button onClick={() => void submit()} disabled={submitting || csv.trim().length === 0}>
        {submitting ? 'Queueing…' : 'Start import'}
      </Button>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      {status ? (
        <Card>
          <CardHeader>
            <CardTitle className="capitalize">Job {status.state}</CardTitle>
            <CardDescription>
              {status.state === 'completed'
                ? 'Import finished.'
                : `Progress ${status.progress ?? 0}% — requires \`npm run worker\` to be running.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {status.result ? (
              <>
                <p>
                  Imported {status.result.imported} of {status.result.received} rows.
                </p>
                {status.result.skipped.length > 0 ? (
                  <div>
                    <p className="font-medium">Skipped rows</p>
                    <ul className="text-muted-foreground mt-1 space-y-1">
                      {status.result.skipped.map((row) => (
                        <li key={row.row}>
                          Row {row.row}: {row.reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </>
            ) : null}
            {status.failed_reason ? <p className="text-destructive">{status.failed_reason}</p> : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
