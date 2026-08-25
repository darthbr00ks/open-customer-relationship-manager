'use client';

import { useState } from 'react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { WorkspaceSwitcher } from '@/components/workspace-switcher';
import { initials } from '@/lib/format';
import { useCurrentUserStore } from '@/stores/current-user';

/** Combines "who am I" (no auth — see README) and "which workspace" into one corner menu. */
export function UserMenu() {
  const displayName = useCurrentUserStore((state) => state.displayName);
  const setDisplayName = useCurrentUserStore((state) => state.setDisplayName);
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="focus-visible:ring-ring/50 rounded-full outline-none focus-visible:ring-2"
          aria-label="Account and workspace"
        >
          <Avatar>
            <AvatarFallback>{initials(displayName)}</AvatarFallback>
          </Avatar>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="display-name">Your name</Label>
          <div className="flex gap-2">
            <Input
              id="display-name"
              value={draft ?? displayName}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => {
                if (draft != null) setDisplayName(draft);
                setDraft(null);
              }}
            />
          </div>
          <p className="text-muted-foreground text-xs">
            There&apos;s still no app login yet — this only labels records you own and notes you
            write. Telephony sign-in lives in the phone button beside this menu.
          </p>
        </div>

        <Separator />

        <div className="space-y-1.5">
          <Label>Workspace</Label>
          <WorkspaceSwitcher compact />
        </div>
      </PopoverContent>
    </Popover>
  );
}
