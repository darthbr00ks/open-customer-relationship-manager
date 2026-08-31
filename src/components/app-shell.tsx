'use client';

import Link from 'next/link';

import { CommandPalette } from '@/components/command-palette';
import { CreateMenu } from '@/components/create-menu';
import { DensityControl } from '@/components/density-control';
import { HelpMenu, NotificationsMenu } from '@/components/notifications-menu';
import { PrimaryNavigation } from '@/components/primary-navigation';
import { ThemeControl } from '@/components/theme-control';
import { UserMenu } from '@/components/user-menu';
import { useWorkspaceStore } from '@/stores/workspace';

/**
 * Persistent app shell with a logo, one top-level tab per object, and a
 * right-side cluster of Search / Create / Notifications / Help / User menu
 * that stays constant as the user moves between object workspaces.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const workspaceId = useWorkspaceStore((state) => state.workspaceId);

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b">
        <div
          className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-1 px-4 sm:gap-4 sm:px-6"
          style={{ paddingBlock: 'var(--d-header-py)' }}
        >
          <Link href="/" className="mr-2 shrink-0 font-semibold tracking-tight">
            open-rm
          </Link>

          <PrimaryNavigation />

          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            <CommandPalette workspaceId={workspaceId} />
            <CreateMenu workspaceId={workspaceId} />
            <DensityControl />
            <ThemeControl />
            <NotificationsMenu />
            <HelpMenu />
            <UserMenu />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
