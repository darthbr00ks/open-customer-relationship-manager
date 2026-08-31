'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, GripVertical, Home, SlidersHorizontal } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { NAV_OBJECT_ORDER, OBJECTS, type ObjectKey } from '@/lib/objects';
import { cn } from '@/lib/utils';
import { useCurrentUserStore } from '@/stores/current-user';

const STORAGE_KEY_PREFIX = 'open-rm-primary-tab-order';
const GAP_PX = 4;
const OVERFLOW_BUTTON_PX = 38;

function validOrder(value: unknown): ObjectKey[] | null {
  if (!Array.isArray(value)) return null;
  const known = new Set<ObjectKey>(NAV_OBJECT_ORDER);
  const saved = value.filter((item): item is ObjectKey => typeof item === 'string' && known.has(item as ObjectKey));
  if (new Set(saved).size !== saved.length) return null;
  return [...saved, ...NAV_OBJECT_ORDER.filter((key) => !saved.includes(key))];
}

export function PrimaryNavigation() {
  const pathname = usePathname();
  const userId = useCurrentUserStore((state) => state.userId);
  const storageKey = `${STORAGE_KEY_PREFIX}:${userId}`;
  const containerRef = useRef<HTMLElement>(null);
  const measureRefs = useRef(new Map<string, HTMLSpanElement>());
  const [order, setOrder] = useState<ObjectKey[]>(NAV_OBJECT_ORDER);
  const [visibleCount, setVisibleCount] = useState(order.length);
  const [dragging, setDragging] = useState<ObjectKey | null>(null);
  const [reordering, setReordering] = useState(false);

  useEffect(() => {
    let nextOrder: ObjectKey[] = NAV_OBJECT_ORDER;
    try {
      const saved = validOrder(JSON.parse(localStorage.getItem(storageKey) ?? 'null'));
      nextOrder = saved ?? NAV_OBJECT_ORDER;
    } catch {
      // Ignore malformed browser state and retain the application default.
    }
    const frame = requestAnimationFrame(() => setOrder(nextOrder));
    return () => cancelAnimationFrame(frame);
  }, [storageKey]);

  const calculateVisible = useCallback(() => {
    const available = containerRef.current?.clientWidth ?? 0;
    const homeWidth = measureRefs.current.get('home')?.getBoundingClientRect().width ?? 0;
    const widths = order.map((key) => measureRefs.current.get(key)?.getBoundingClientRect().width ?? 0);
    const fullWidth = homeWidth + widths.reduce((sum, width) => sum + width + GAP_PX, 0);
    if (fullWidth <= available) {
      setVisibleCount(order.length);
      return;
    }
    let used = homeWidth + GAP_PX;
    let count = 0;
    const limit = Math.max(0, available - OVERFLOW_BUTTON_PX - GAP_PX);
    for (const width of widths) {
      if (used + width > limit) break;
      used += width + GAP_PX;
      count += 1;
    }
    setVisibleCount(count);
  }, [order]);

  useLayoutEffect(() => {
    calculateVisible();
    const observer = new ResizeObserver(calculateVisible);
    if (containerRef.current) observer.observe(containerRef.current);
    for (const node of measureRefs.current.values()) observer.observe(node);
    return () => observer.disconnect();
  }, [calculateVisible]);

  function moveTab(source: ObjectKey, target: ObjectKey) {
    if (source === target) return;
    setOrder((current) => {
      const next = current.filter((key) => key !== source);
      next.splice(next.indexOf(target), 0, source);
      localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
    setDragging(null);
  }

  const visible = order.slice(0, visibleCount);
  const overflow = order.slice(visibleCount);

  return (
    <>
      <nav ref={containerRef} className="relative flex min-w-0 flex-1 items-center gap-1 overflow-hidden text-sm">
        <NavLink href="/" active={pathname === '/'}>
          <Home className="size-4" /> Home
        </NavLink>
        {visible.map((key) => {
          const object = OBJECTS[key];
          const Icon = object.icon;
          return (
            <NavLink
              key={key}
              href={object.routeBase}
              active={pathname.startsWith(object.routeBase)}
              draggable
              dragging={dragging === key}
              onDragStart={() => setDragging(key)}
              onDragEnd={() => setDragging(null)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => dragging && moveTab(dragging, key)}
              title="Drag to reorder tab"
            >
              <Icon className="size-4" /> {object.plural}
            </NavLink>
          );
        })}

        {overflow.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="px-2" aria-label={`${overflow.length} more tabs`}>
                <ChevronDown className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {overflow.map((key) => {
                const object = OBJECTS[key];
                const Icon = object.icon;
                return (
                  <DropdownMenuItem key={key} asChild>
                    <Link href={object.routeBase} className={cn(pathname.startsWith(object.routeBase) && 'bg-accent font-medium')}>
                      <Icon /> {object.plural}
                    </Link>
                  </DropdownMenuItem>
                );
              })}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setReordering(true)}>
                <SlidersHorizontal /> Reorder tabs…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}

        <div className="pointer-events-none invisible absolute flex gap-1" aria-hidden>
          <Measure ref={(node) => setMeasureRef(measureRefs.current, 'home', node)}><Home className="size-4" /> Home</Measure>
          {order.map((key) => {
            const object = OBJECTS[key];
            const Icon = object.icon;
            return <Measure key={key} ref={(node) => setMeasureRef(measureRefs.current, key, node)}><Icon className="size-4" /> {object.plural}</Measure>;
          })}
        </div>
      </nav>

      <Dialog open={reordering} onOpenChange={setReordering}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reorder navigation tabs</DialogTitle>
            <DialogDescription>Drag each tab into your preferred order. This order is saved in this browser.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            {order.map((key) => {
              const object = OBJECTS[key];
              const Icon = object.icon;
              return (
                <div
                  key={key}
                  draggable
                  onDragStart={() => setDragging(key)}
                  onDragEnd={() => setDragging(null)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => dragging && moveTab(dragging, key)}
                  className={cn(
                    'flex cursor-grab items-center gap-3 rounded-md border bg-background px-3 py-2 text-sm active:cursor-grabbing',
                    dragging === key && 'opacity-40',
                  )}
                >
                  <GripVertical className="text-muted-foreground size-4" />
                  <Icon className="size-4" />
                  <span>{object.plural}</span>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function setMeasureRef(map: Map<string, HTMLSpanElement>, key: string, node: HTMLSpanElement | null) {
  if (node) map.set(key, node);
  else map.delete(key);
}

function Measure({ children, ref }: { children: React.ReactNode; ref: React.Ref<HTMLSpanElement> }) {
  return <span ref={ref} className="flex items-center gap-1.5 rounded-md px-3 py-1.5 whitespace-nowrap">{children}</span>;
}

function NavLink({
  href,
  active,
  children,
  dragging,
  ...props
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
  dragging?: boolean;
} & React.ComponentPropsWithoutRef<'a'>) {
  return (
    <Link
      href={href}
      className={cn(
        'flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 whitespace-nowrap transition-colors',
        active ? 'bg-accent text-accent-foreground font-medium' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
        dragging && 'opacity-40',
      )}
      {...props}
    >
      {children}
    </Link>
  );
}
