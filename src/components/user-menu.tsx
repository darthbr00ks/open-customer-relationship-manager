'use client';

import { useState } from 'react';
import { LogIn, LogOut, Mail } from 'lucide-react';
import Link from 'next/link';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { WorkspaceSwitcher } from '@/components/workspace-switcher';
import { initials } from '@/lib/format';
import { useCurrentUserStore } from '@/stores/current-user';

/**
 * "Who am I" and "which workspace", in one corner menu.
 *
 * The identity half has two faces. Signed in, the name comes from the identity
 * provider and is shown rather than edited, with a way out. With no provider
 * configured, it stays the editable per-browser label the app has always had.
 */
export function UserMenu() {
  const displayName = useCurrentUserStore((state) => state.displayName);
  const setDisplayName = useCurrentUserStore((state) => state.setDisplayName);
  const signedIn = useCurrentUserStore((state) => state.signedIn);
  const authEnabled = useCurrentUserStore((state) => state.authEnabled);
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
        {signedIn ? (
          <div className="space-y-2">
            <Label>Signed in as</Label>
            <p className="text-sm font-medium">{displayName}</p>
            <p className="text-muted-foreground text-xs">
              Your name and address come from your identity provider.
            </p>
          </div>
        ) : (
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
              {authEnabled
                ? 'You are not signed in — this just labels records you own and notes you write.'
                : "There's no login on this deployment — this just labels records you own and notes you write."}
            </p>
          </div>
        )}

        <Separator />

        <div className="space-y-1.5">
          <Label>Workspace</Label>
          <WorkspaceSwitcher compact />
        </div>

        <Separator />

        <div className="space-y-2">
          <Button asChild variant="outline" size="sm" className="w-full justify-start">
            <Link href="/settings/email">
              <Mail /> Email settings
            </Link>
          </Button>

          {signedIn ? (
            // A form, not a link: signing out changes state, and a POST keeps a
            // link prefetcher or a scanner from doing it by accident.
            <form action="/api/auth/logout" method="post">
              <Button type="submit" variant="outline" size="sm" className="w-full justify-start">
                <LogOut /> Sign out
              </Button>
            </form>
          ) : authEnabled ? (
            <Button asChild variant="outline" size="sm" className="w-full justify-start">
              <a href="/api/auth/login">
                <LogIn /> Sign in
              </a>
            </Button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
