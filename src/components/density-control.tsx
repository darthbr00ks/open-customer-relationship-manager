'use client';

import { Rows4 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { DENSITIES, DENSITY_LABELS, MAX_SECTION_COLUMNS, MIN_SECTION_COLUMNS, useUIStore, type Density } from '@/stores/ui';

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

const COLUMN_OPTIONS = Array.from(
  { length: MAX_SECTION_COLUMNS - MIN_SECTION_COLUMNS + 1 },
  (_, i) => MIN_SECTION_COLUMNS + i,
);

export function DensityControl() {
  const density = useUIStore((state) => state.density);
  const setDensity = useUIStore((state) => state.setDensity);
  const sectionColumns = useUIStore((state) => state.sectionColumns);
  const setSectionColumns = useUIStore((state) => state.setSectionColumns);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Density: ${DENSITY_LABELS[density]}, ${sectionColumns} column${sectionColumns === 1 ? '' : 's'}`}
        >
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

        <Separator className="my-2" />

        <div className="px-2 pb-1">
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-muted-foreground text-xs font-medium">Columns per section</p>
            <span className="text-xs font-medium tabular-nums">{sectionColumns}</span>
          </div>
          <p className="text-muted-foreground mb-2 text-xs">Fields per row on record pages and forms.</p>
          <div className="grid grid-cols-6 gap-1">
            {COLUMN_OPTIONS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setSectionColumns(n)}
                aria-pressed={n === sectionColumns}
                aria-label={`${n} column${n === 1 ? '' : 's'}`}
                className={cn(
                  'flex h-8 items-center justify-center rounded-md border text-xs font-medium transition-colors hover:bg-accent',
                  n === sectionColumns ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground',
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
