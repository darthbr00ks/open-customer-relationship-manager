'use client';

import { useEffect } from 'react';

import { useThemeStore } from '@/stores/theme';

/** Stamps the persisted theme onto `<html>` so the CSS in globals.css can act on it. */
export function ThemeProvider() {
  const theme = useThemeStore((state) => state.theme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return null;
}
