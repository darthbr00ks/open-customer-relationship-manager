'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const THEMES = ['light', 'dark', 'high-contrast'] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_LABELS: Record<Theme, string> = {
  light: 'Light',
  dark: 'Dark',
  'high-contrast': 'High contrast',
};

/**
 * Explicit theme choice, applied to `<html data-theme>` by ThemeProvider and
 * consumed by CSS custom properties in globals.css. Persisted like density —
 * a reload keeps what was picked.
 */
type ThemeState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'light',
      setTheme: (theme) => set({ theme }),
    }),
    { name: 'open-rm-theme' },
  ),
);
