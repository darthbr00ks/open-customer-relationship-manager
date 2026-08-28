'use client';

import Link from 'next/link';
import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useCachedList } from '@/lib/data-cache';
import { OBJECTS, titleOf, type ObjectKey } from '@/lib/objects';

/**
 * Global search across every object. There is no
 * server-side search endpoint yet (README "Known gaps"), so this searches
 * the same cached pages every list view already loaded — instant once
 * visited, and good enough for a workspace this app is meant to run.
 */
export function CommandPalette({ workspaceId }: { workspaceId: string | null }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing = target != null && (['INPUT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable);
      if ((event.key === 'k' && (event.metaKey || event.ctrlKey)) || (event.key === '/' && !typing)) {
        event.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setQuery('');
  };

  const entities = useCachedList<Record<string, unknown>>('entities', workspaceId);
  const persons = useCachedList<Record<string, unknown>>('persons', workspaceId);
  const deals = useCachedList<Record<string, unknown>>('deals', workspaceId);
  const cases = useCachedList<Record<string, unknown>>('cases', workspaceId);
  const incidents = useCachedList<Record<string, unknown>>('incidents', workspaceId);
  const requests = useCachedList<Record<string, unknown>>('requests', workspaceId);
  const chat_channels = useCachedList<Record<string, unknown>>('chat-channels', workspaceId);
  const products = useCachedList<Record<string, unknown>>('products', workspaceId);
  const offerings = useCachedList<Record<string, unknown>>('offerings', workspaceId);
  const quotes = useCachedList<Record<string, unknown>>('quotes', workspaceId);
  const orders = useCachedList<Record<string, unknown>>('orders', workspaceId);
  const subscriptions = useCachedList<Record<string, unknown>>('subscriptions', workspaceId);
  const service_deliveries = useCachedList<Record<string, unknown>>('service-deliveries', workspaceId);
  // Keyed by `ObjectKey`, so a newly registered object is a compile error here
  // until it is searchable too.
  const byResource: Record<ObjectKey, { rows: Record<string, unknown>[] }> = {
    entities,
    persons,
    deals,
    cases,
    incidents,
    requests,
    chat_channels,
    products,
    offerings,
    quotes,
    orders,
    subscriptions,
    service_deliveries,
  };

  const q = query.trim().toLowerCase();
  const groups = q.length === 0
    ? []
    : (Object.keys(OBJECTS) as (keyof typeof OBJECTS)[]).map((key) => {
        const object = OBJECTS[key];
        const { rows } = byResource[key];
        const matches = rows
          .filter((row) => object.searchFields.some((field) => String(row[field] ?? '').toLowerCase().includes(q)))
          .slice(0, 5);
        return { object, matches };
      }).filter((group) => group.matches.length > 0);

  return (
    <>
      <Button variant="outline" size="sm" className="text-muted-foreground gap-2" onClick={() => setOpen(true)}>
        <Search className="size-4" />
        <span className="hidden sm:inline">Search…</span>
        <kbd className="bg-muted ml-2 hidden rounded border px-1.5 py-0.5 font-mono text-[10px] sm:inline">/</kbd>
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent showClose={false} className="gap-0 p-0 sm:max-w-lg">
          <DialogTitle className="sr-only">Search</DialogTitle>
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <Search className="text-muted-foreground size-4 shrink-0" />
            <Input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search entities, people, deals, quotes, products…"
              className="border-none px-0 shadow-none focus-visible:ring-0"
            />
          </div>
          <div className="max-h-96 overflow-y-auto p-2">
            {q.length === 0 ? (
              <p className="text-muted-foreground p-4 text-center text-sm">Start typing to search everything you&apos;ve loaded.</p>
            ) : groups.length === 0 ? (
              <p className="text-muted-foreground p-4 text-center text-sm">No matches for &quot;{query}&quot;.</p>
            ) : (
              groups.map(({ object, matches }) => (
                <div key={object.key} className="mb-2">
                  <p className="text-muted-foreground px-2 py-1 text-xs font-semibold tracking-wide uppercase">
                    {object.plural}
                  </p>
                  {matches.map((row) => {
                    const Icon = object.icon;
                    return (
                      <Link
                        key={row.id as string}
                        href={`${object.routeBase}/${row.id}`}
                        onClick={() => setOpen(false)}
                        className="hover:bg-accent flex items-center gap-2 rounded-md px-2 py-2 text-sm"
                      >
                        <Icon className="text-muted-foreground size-4 shrink-0" />
                        {titleOf(object, row)}
                      </Link>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
