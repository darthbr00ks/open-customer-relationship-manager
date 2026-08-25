'use client';

import { MoreHorizontal, type LucideIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type RecordAction = {
  key: string;
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  /** Shown as its own button; everything else collapses into the "More" menu (spec §11). */
  primary?: boolean;
  variant?: 'default' | 'outline' | 'destructive';
};

/** Sticky record-page header: title, archived state, badges, and contextual actions (spec §2/§11). */
export function RecordHeader({
  title,
  badges,
  archived,
  actions,
}: {
  title: string;
  badges?: React.ReactNode;
  archived?: boolean;
  actions: RecordAction[];
}) {
  const primary = actions.filter((action) => action.primary);
  const overflow = actions.filter((action) => !action.primary);

  return (
    <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{title}</h1>
          {archived ? <Badge variant="secondary">Archived</Badge> : null}
        </div>
        {badges ? <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-sm">{badges}</div> : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {primary.map((action) => (
          <Button key={action.key} size="sm" variant={action.variant ?? 'outline'} onClick={action.onClick}>
            <action.icon /> {action.label}
          </Button>
        ))}
        {overflow.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {overflow.map((action) => (
                <DropdownMenuItem key={action.key} onSelect={action.onClick} variant={action.variant === 'destructive' ? 'destructive' : 'default'}>
                  <action.icon /> {action.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </div>
  );
}
