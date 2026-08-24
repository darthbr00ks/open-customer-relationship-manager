'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { NoWorkspace } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api-client';
import { ENTITY_TYPES, RELATIONSHIP_STAGES, type Entity } from '@/lib/types';
import { useWorkspaceStore } from '@/stores/workspace';

export default function NewEntityPage() {
  const router = useRouter();
  const workspaceId = useWorkspaceStore((state) => state.workspaceId);

  const [form, setForm] = useState({
    name: '',
    entity_type: 'company',
    relationship_stage: 'prospect',
    primary_email: '',
    primary_domain: '',
    city: '',
    notes: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!workspaceId) return;
    setSaving(true);
    setError(null);
    try {
      // Empty optional fields are omitted rather than sent as empty strings.
      const payload = Object.fromEntries(
        Object.entries({ ...form, workspace_id: workspaceId }).filter(([, value]) => value !== ''),
      );
      await api.create<Entity>('entities', payload);
      router.push('/entities');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save');
      setSaving(false);
    }
  };

  if (!workspaceId) return <NoWorkspace />;

  return (
    <form onSubmit={submit} className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New entity</h1>
        <p className="text-muted-foreground text-sm">An organization you have a relationship with.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            required
            value={form.name}
            onChange={(event) => set('name', event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="entity_type">Type</Label>
          <Select value={form.entity_type} onValueChange={(value) => set('entity_type', value)}>
            <SelectTrigger id="entity_type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ENTITY_TYPES.map((type) => (
                <SelectItem key={type} value={type} className="capitalize">
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="relationship_stage">Stage</Label>
          <Select
            value={form.relationship_stage}
            onValueChange={(value) => set('relationship_stage', value)}
          >
            <SelectTrigger id="relationship_stage">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RELATIONSHIP_STAGES.map((stage) => (
                <SelectItem key={stage} value={stage} className="capitalize">
                  {stage.replace('_', ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="primary_email">Primary email</Label>
          <Input
            id="primary_email"
            type="email"
            value={form.primary_email}
            onChange={(event) => set('primary_email', event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="primary_domain">Primary domain</Label>
          <Input
            id="primary_domain"
            value={form.primary_domain}
            onChange={(event) => set('primary_domain', event.target.value)}
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="city">City</Label>
          <Input id="city" value={form.city} onChange={(event) => set('city', event.target.value)} />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" value={form.notes} onChange={(event) => set('notes', event.target.value)} />
        </div>
      </div>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={saving || !form.name}>
          {saving ? 'Saving…' : 'Create entity'}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.push('/entities')}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
