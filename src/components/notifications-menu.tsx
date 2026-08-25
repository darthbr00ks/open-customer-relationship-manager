'use client';

import { Bell, HelpCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';

export function NotificationsMenu() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notifications">
          <Bell />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <p className="text-sm font-medium">Notifications</p>
        <p className="text-muted-foreground mt-1 text-sm">
          Nothing yet — this app doesn&apos;t generate notifications in this build.
        </p>
      </PopoverContent>
    </Popover>
  );
}

const SHORTCUTS: [string, string][] = [
  ['Search', '/'],
  ['Create', 'C'],
  ['Toggle density', 'D'],
];

export function HelpMenu() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Help">
          <HelpCircle />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <p className="text-sm font-medium">Keyboard shortcuts</p>
        <dl className="mt-2 space-y-1.5 text-sm">
          {SHORTCUTS.map(([label, key]) => (
            <div key={label} className="flex items-center justify-between">
              <dt className="text-muted-foreground">{label}</dt>
              <dd>
                <kbd className="bg-muted rounded border px-1.5 py-0.5 font-mono text-xs">{key}</kbd>
              </dd>
            </div>
          ))}
        </dl>
        <Separator className="my-3" />
        <p className="text-muted-foreground text-xs">
          open-rm is an open relationship management tool. See the README in the repo for the data
          model and API.
        </p>
      </PopoverContent>
    </Popover>
  );
}
