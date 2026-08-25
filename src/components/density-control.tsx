'use client';

import { Rows4 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { DENSITIES, DENSITY_LABELS, useUIStore, type Density } from '@/stores/ui';

/** Row-height preview bars, tighter for denser options, so the choice is visible before it's picked. */
const PREVIEW_GAPS: Record<Density, string> = {
  comfortable: 'gap-1.5',
  compact: 'gap-1',
  dense: 'gap-0.5',
  ultra: 'gap-[2px]',
};

const DESCRIPTIONS: Record<Density, string> = {
  comfortable: 'Spacious rows, easiest to scan.',
  compact: 'Tighter rows, a bit more per screen.',
  dense: 'Small type, rows close together.',
  ultra: 'Maximum records on screen at once.',
};

export function DensityControl() {
  const density = useUIStore((state) => state.density);
  const setDensity = useUIStore((state) => state.setDensity);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Density: ${DENSITY_LABELS[density]}`}>
          <Rows4 />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-2">
        <p className="text-muted-foreground px-2 pt-1 pb-2 text-xs font-medium">Density</p>
        <div className="flex flex-col gap-1">
          {DENSITIES.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setDensity(option)}
              className={cn(
                'flex items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent',
                option === density && 'bg-accent',
              )}
            >
              <span className={cn('flex w-5 flex-col', PREVIEW_GAPS[option])} aria-hidden="true">
                <span className="bg-foreground/60 h-[2px] w-full rounded-full" />
                <span className="bg-foreground/60 h-[2px] w-full rounded-full" />
                <span className="bg-foreground/60 h-[2px] w-full rounded-full" />
              </span>
              <span className="flex-1">
                <span className="block font-medium">{DENSITY_LABELS[option]}</span>
                <span className="text-muted-foreground block text-xs">{DESCRIPTIONS[option]}</span>
              </span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
