'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Plus, ShieldCheck, Users } from 'lucide-react';

import { PermissionGrid } from '@/components/security/permission-grid';
import { EmptyState, NoWorkspace } from '@/components/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api-client';
import {
  archiveProfile,
  assignProfile,
  createProfile,
  fetchAssignments,
  fetchPermissionCatalog,
  fetchProfile,
  fetchProfiles,
  saveGrants,
  setUpProfiles,
  type PermissionCatalog,
  type ProfileDetail,
  type ProfileListing,
  type ProfileGrants,
  type UserAssignment,
} from '@/lib/security/client';
import { usePermissionsStore } from '@/stores/permissions';
import { useWorkspaceStore } from '@/stores/workspace';

/**
 * Settings → Profiles: object- and field-level security, per profile.
 *
 * Three things, in the order somebody actually needs them: turn permissions on,
 * decide what each profile may do, and say who has which profile. The grid is
 * the middle one and does the real work (`components/security/permission-grid.tsx`).
 */
export default function ProfilesSettingsPage() {
  const workspaceId = useWorkspaceStore((state) => state.workspaceId);
  const refreshPermissions = usePermissionsStore((state) => state.refresh);

  const [listing, setListing] = useState<ProfileListing | null>(null);
  const [catalog, setCatalog] = useState<PermissionCatalog | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ProfileDetail | null>(null);
  const [draft, setDraft] = useState<ProfileGrants | null>(null);
  const [assignments, setAssignments] = useState<UserAssignment[] | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const explain = (caught: unknown, fallback: string) =>
    setError(caught instanceof ApiError ? String(caught.detail) : fallback);

  /* The listing, the catalog and the assignments: everything the page frames. */
  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;

    (async () => {
      try {
        const [profiles, loadedCatalog, users] = await Promise.all([
          fetchProfiles(workspaceId),
          fetchPermissionCatalog(),
          fetchAssignments(workspaceId).catch(() => ({ users: [] })),
        ]);
        if (cancelled) return;

        setListing(profiles);
        setCatalog(loadedCatalog);
        setAssignments(users.users);
        setError(null);
        setSelectedId((current) => current ?? profiles.profiles[0]?.id ?? null);
      } catch (caught) {
        if (!cancelled) explain(caught, 'Could not load profiles');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [workspaceId, reloadToken]);

  /* The selected profile's grants. */
  useEffect(() => {
    if (!workspaceId || !selectedId) return;
    let cancelled = false;

    (async () => {
      try {
        const loaded = await fetchProfile(workspaceId, selectedId);
        if (cancelled) return;
        setDetail(loaded);
        setDraft(loaded.grants);
      } catch (caught) {
        if (!cancelled) explain(caught, 'Could not load that profile');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [workspaceId, selectedId, reloadToken]);

  if (!workspaceId) return <NoWorkspace />;

  // Derived rather than cleared in the effect above: with nothing selected
  // there is nothing to show, and clearing state synchronously in an effect
  // just to say so costs an extra render.
  const active = selectedId ? detail : null;
  const activeDraft = selectedId ? draft : null;

  const run = async (work: () => Promise<unknown>, fallback: string) => {
    setBusy(true);
    setError(null);
    try {
      await work();
      setReloadToken((token) => token + 1);
      // An administrator can change their own access here, so the app's own
      // idea of what it may show has to be re-read rather than left stale.
      await refreshPermissions();
    } catch (caught) {
      explain(caught, fallback);
    } finally {
      setBusy(false);
    }
  };

  const unconfigured = listing !== null && !listing.configured;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Profiles</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          What each kind of user may do — object by object, and field by field.
        </p>
      </div>

      {error ? (
        <p
          role="alert"
          className="border-destructive/40 text-destructive flex items-start gap-2 rounded-md border border-dashed p-3 text-sm"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      ) : null}

      {listing && !listing.provider.enforces ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Permissions are not being enforced</CardTitle>
            <CardDescription>
              This server runs the “{listing.provider.label}” provider, so every signed-in user may
              do everything. Set <code>PERMISSIONS_PROVIDER=profiles</code> to enforce what you
              configure here.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {unconfigured ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="size-4" /> Set up profiles
            </CardTitle>
            <CardDescription>
              This workspace has no profiles, so everyone can do everything. Setting them up creates
              an <strong>Administrator</strong> and a <strong>Standard User</strong> profile and
              makes you an administrator.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              disabled={busy}
              onClick={() => void run(() => setUpProfiles(workspaceId), 'Setting up profiles failed')}
            >
              <ShieldCheck /> Set up profiles
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Tabs defaultValue="permissions">
        <TabsList>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
          <TabsTrigger value="people">
            <Users className="size-3.5" /> People
          </TabsTrigger>
        </TabsList>

        <TabsContent value="permissions" className="space-y-4 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={selectedId ?? ''} onValueChange={setSelectedId}>
              <SelectTrigger className="w-72">
                <SelectValue placeholder="Pick a profile" />
              </SelectTrigger>
              <SelectContent>
                {(listing?.profiles ?? []).map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    {profile.name}
                    {profile.is_admin ? ' · admin' : ''}
                    {profile.is_default ? ' · default' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={() => setCreating(true)} disabled={busy}>
              <Plus /> New profile
            </Button>

            {active && !active.is_admin ? (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  void run(() => archiveProfile(workspaceId, active.id), 'Archiving failed').then(
                    () => setSelectedId(null),
                  )
                }
              >
                Archive
              </Button>
            ) : null}

            <div className="ml-auto flex items-center gap-2">
              {active ? (
                <span className="text-muted-foreground text-xs">
                  {active.assigned_users} {active.assigned_users === 1 ? 'user' : 'users'}
                </span>
              ) : null}
              {active && !active.is_admin && activeDraft ? (
                <Button
                  disabled={busy}
                  onClick={() =>
                    void run(() => saveGrants(workspaceId, active.id, activeDraft), 'Saving failed')
                  }
                >
                  {busy ? 'Saving…' : 'Save permissions'}
                </Button>
              ) : null}
            </div>
          </div>

          {active?.is_admin ? (
            <p className="text-muted-foreground rounded-md border border-dashed p-3 text-sm">
              <Badge variant="secondary" className="mr-2">
                Administrator
              </Badge>
              Has full access to every object and field, including these settings. Its grants are
              not editable — an administrator that could be restricted is a workspace that can lock
              itself out.
            </p>
          ) : null}

          {catalog && activeDraft ? (
            <PermissionGrid
              catalog={catalog}
              grants={activeDraft}
              disabled={busy || active?.is_admin}
              onChange={setDraft}
            />
          ) : (
            <EmptyState
              title={listing?.profiles.length ? 'Pick a profile' : 'No profiles yet'}
              hint={
                listing?.profiles.length
                  ? 'Choose one above to edit what it may do.'
                  : 'Set up profiles to start restricting access.'
              }
            />
          )}
        </TabsContent>

        <TabsContent value="people" className="space-y-4 pt-4">
          {assignments && assignments.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">User</th>
                    <th className="px-3 py-2 text-left font-medium">Last sign-in</th>
                    <th className="w-72 px-3 py-2 text-left font-medium">Profile</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {assignments.map((user) => (
                    <tr key={user.user_id}>
                      <td className="px-3 py-2">
                        <div className="font-medium">{user.name ?? user.email ?? 'Unnamed user'}</div>
                        {user.email ? (
                          <div className="text-muted-foreground text-xs">{user.email}</div>
                        ) : null}
                      </td>
                      <td className="text-muted-foreground px-3 py-2">
                        {user.last_login_at
                          ? new Date(user.last_login_at).toLocaleDateString()
                          : 'Never'}
                      </td>
                      <td className="px-3 py-2">
                        <Select
                          value={user.profile_id ?? 'none'}
                          disabled={busy}
                          onValueChange={(value) =>
                            void run(
                              () =>
                                assignProfile(
                                  workspaceId,
                                  user.user_id,
                                  value === 'none' ? null : value,
                                ),
                              'Assigning failed',
                            )
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Default profile</SelectItem>
                            {(listing?.profiles ?? []).map((profile) => (
                              <SelectItem key={profile.id} value={profile.id}>
                                {profile.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="Nobody has signed in yet"
              hint="Users appear here the first time they sign in through your identity provider."
            />
          )}
        </TabsContent>
      </Tabs>

      {creating ? (
        <NewProfileDialog
          workspaceId={workspaceId}
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            setSelectedId(id);
            setReloadToken((token) => token + 1);
          }}
        />
      ) : null}
    </div>
  );
}

function NewProfileDialog({
  workspaceId,
  onClose,
  onCreated,
}: {
  workspaceId: string;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [form, setForm] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** The key is derived rather than asked for — it is an implementation detail. */
  const key = form.name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const profile = await createProfile({
        workspace_id: workspaceId,
        name: form.name.trim(),
        key,
        description: form.description.trim() || null,
      });
      onCreated(profile.id);
    } catch (caught) {
      setError(caught instanceof ApiError ? String(caught.detail) : 'Creating the profile failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New profile</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="profile-name">Name</Label>
            <Input
              id="profile-name"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="Support Agent"
            />
            {key ? <p className="text-muted-foreground text-xs">Key: {key}</p> : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profile-description">Description</Label>
            <Textarea
              id="profile-description"
              rows={3}
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />
          </div>
          <p className="text-muted-foreground text-xs">
            A new profile starts with nothing granted. Give it access on the next screen.
          </p>
          {error ? (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !key}>
              {saving ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
