'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home } from 'lucide-react';

import { CommandPalette } from '@/components/command-palette';
import { CtiControl } from '@/components/cti-control';
import { CreateMenu } from '@/components/create-menu';
import { DensityControl } from '@/components/density-control';
import { HelpMenu, NotificationsMenu } from '@/components/notifications-menu';
import { ThemeControl } from '@/components/theme-control';
import { UserMenu } from '@/components/user-menu';
import { cn } from '@/lib/utils';
import { NAV_OBJECT_ORDER, OBJECTS } from '@/lib/objects';
import { useWorkspaceStore } from '@/stores/workspace';

/**
 * Persistent app shell with a logo, one top-level tab per object, and a
 * right-side cluster of Search / Create / Notifications / Help / User menu
 * that stays constant as the user moves between object workspaces.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
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

          <nav className="flex flex-1 items-center gap-1 overflow-x-auto text-sm">
            <NavLink href="/" active={pathname === '/'}>
              <Home className="size-4" /> Home
            </NavLink>
            {NAV_OBJECT_ORDER.map((key) => {
              const object = OBJECTS[key];
              const Icon = object.icon;
              return (
                <NavLink key={key} href={object.routeBase} active={pathname.startsWith(object.routeBase)}>
                  <Icon className="size-4" /> {object.plural}
                </NavLink>
              );
            })}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            <CommandPalette workspaceId={workspaceId} />
            <CreateMenu workspaceId={workspaceId} />
            <DensityControl />
            <ThemeControl />
            <NotificationsMenu />
            <HelpMenu />
            <CtiControl />
            <UserMenu />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}

function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-1.5 rounded-md px-3 py-1.5 whitespace-nowrap transition-colors',
        active
          ? 'bg-accent text-accent-foreground font-medium'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
      )}
    >
      {children}
    </Link>
  );
}
