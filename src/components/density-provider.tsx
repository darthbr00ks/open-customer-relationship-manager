'use client';

import { useEffect } from 'react';

import { useUIStore } from '@/stores/ui';

/** Stamps the persisted density onto `<html>` so the CSS in globals.css can act on it. */
export function DensityProvider() {
  const density = useUIStore((state) => state.density);

  useEffect(() => {
    document.documentElement.dataset.density = density;
  }, [density]);

  return null;
}
