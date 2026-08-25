'use client';

import { Contrast, Moon, Sun } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { THEME_LABELS, THEMES, useThemeStore, type Theme } from '@/stores/theme';

const THEME_ICONS: Record<Theme, typeof Sun> = {
  light: Sun,
  dark: Moon,
  'high-contrast': Contrast,
};

const DESCRIPTIONS: Record<Theme, string> = {
  light: 'Default, for a bright room.',
  dark: 'Easier on the eyes in low light.',
  'high-contrast': 'Maximum contrast — black/white, thicker borders.',
};

export function ThemeControl() {
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);
  const Icon = THEME_ICONS[theme];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Theme: ${THEME_LABELS[theme]}`}>
          <Icon />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-2">
        <p className="text-muted-foreground px-2 pt-1 pb-2 text-xs font-medium">Theme</p>
        <div className="flex flex-col gap-1">
          {THEMES.map((option) => {
            const OptionIcon = THEME_ICONS[option];
            return (
              <button
                key={option}
                type="button"
                onClick={() => setTheme(option)}
                className={cn(
                  'flex items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent',
                  option === theme && 'bg-accent',
                )}
              >
                <OptionIcon className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
                <span className="flex-1">
                  <span className="block font-medium">{THEME_LABELS[option]}</span>
                  <span className="text-muted-foreground block text-xs">{DESCRIPTIONS[option]}</span>
                </span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
