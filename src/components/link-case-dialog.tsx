'use client';

import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api-client';
import { invalidateList, useCachedList } from '@/lib/data-cache';
import { IMPACT_LEVELS, type SupportCase } from '@/lib/types';

/** Links an existing Case to this Incident via the IncidentCase junction (spec §9). */
export function LinkCaseDialog({
  open,
  onOpenChange,
  incidentId,
  workspaceId,
  alreadyLinkedCaseIds,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  incidentId: string;
  workspaceId: string;
  alreadyLinkedCaseIds: Set<string>;
}) {
  const { rows: cases } = useCachedList<SupportCase>('cases', workspaceId);
  const linkable = useMemo(() => cases.filter((c) => !alreadyLinkedCaseIds.has(c.id)), [cases, alreadyLinkedCaseIds]);

  const [caseId, setCaseId] = useState('');
  const [impactLevel, setImpactLevel] = useState('');
  const [impactDescription, setImpactDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCase = cases.find((c) => c.id === caseId);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedCase) return;
    if (!selectedCase.entity_id) {
      setError('That case has no entity on it, so it cannot be linked (an incident-case link requires one).');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.create('incident-cases', {
        workspace_id: workspaceId,
        incident_id: incidentId,
        case_id: caseId,
        entity_id: selectedCase.entity_id,
        impact_level: impactLevel || undefined,
        impact_description: impactDescription || undefined,
      });
      invalidateList('incident-cases', workspaceId);
      onOpenChange(false);
      setCaseId('');
      setImpactLevel('');
      setImpactDescription('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not link case');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Link a case to this incident</DialogTitle>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label>Case</Label>
            <Select value={caseId} onValueChange={setCaseId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a case…" />
              </SelectTrigger>
              <SelectContent>
                {linkable.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.case_number} — {c.subject}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Impact level</Label>
            <Select value={impactLevel} onValueChange={setImpactLevel}>
              <SelectTrigger>
                <SelectValue placeholder="Optional" />
              </SelectTrigger>
              <SelectContent>
                {IMPACT_LEVELS.map((level) => (
                  <SelectItem key={level} value={level} className="capitalize">
                    {level}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="impact-description">Impact description</Label>
            <Textarea id="impact-description" value={impactDescription} onChange={(e) => setImpactDescription(e.target.value)} rows={2} />
          </div>

          {error ? <p className="text-destructive text-sm">{error}</p> : null}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !caseId}>
              {saving ? 'Linking…' : 'Link case'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
