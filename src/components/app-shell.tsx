import Link from 'next/link';

import { WorkspaceSwitcher } from '@/components/workspace-switcher';

const NAV = [
  { href: '/', label: 'Dashboard' },
  { href: '/entities', label: 'Entities' },
  { href: '/cases', label: 'Cases' },
  { href: '/import', label: 'Import' },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-6 py-3">
          <Link href="/" className="font-semibold tracking-tight">
            open-rm
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto">
            <WorkspaceSwitcher />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
