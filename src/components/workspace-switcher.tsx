'use client';

import { useState, useSyncExternalStore } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useWorkspaceStore } from '@/stores/workspace';

/**
 * Picks the workspace all screens read from.
 *
 * Until there is authentication, the workspace is entered by hand; a fresh
 * install can generate an id so the app is usable immediately.
 */
export function WorkspaceSwitcher({ compact = false }: { compact?: boolean }) {
  const workspaceId = useWorkspaceStore((state) => state.workspaceId);
  const setWorkspaceId = useWorkspaceStore((state) => state.setWorkspaceId);

  // The persisted store only has a value on the client; render a placeholder
  // until it has hydrated so the server and client markup agree.
  const hydrated = useSyncExternalStore(
    (onChange) => useWorkspaceStore.persist.onFinishHydration(onChange),
    () => useWorkspaceStore.persist.hasHydrated(),
    () => false,
  );

  // `null` means "follow the store"; typing takes over until the edit is applied.
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? workspaceId ?? '';

  if (!hydrated) {
    return <div className={compact ? 'h-9 w-full' : 'h-9 w-72'} />;
  }

  return (
    <div className={compact ? 'flex flex-col gap-2' : 'flex items-center gap-2'}>
      <Input
        value={value}
        onChange={(event) => setDraft(event.target.value)}
        placeholder="workspace uuid"
        className={compact ? 'w-full font-mono text-xs' : 'w-72 font-mono text-xs'}
        aria-label="Workspace ID"
      />
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" onClick={() => setDraft(crypto.randomUUID())}>
          New
        </Button>
        <Button
          size="sm"
          onClick={() => {
            if (!value) return;
            setWorkspaceId(value);
            setDraft(null);
          }}
          disabled={value === '' || value === workspaceId}
          className={compact ? 'flex-1' : undefined}
        >
          Use
        </Button>
      </div>
    </div>
  );
}
