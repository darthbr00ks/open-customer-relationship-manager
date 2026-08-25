'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Rendering density, from spacious to as-tight-as-legible. */
export const DENSITIES = ['comfortable', 'compact', 'dense', 'ultra'] as const;
export type Density = (typeof DENSITIES)[number];

export const DENSITY_LABELS: Record<Density, string> = {
  comfortable: 'Comfortable',
  compact: 'Compact',
  dense: 'Dense',
  ultra: 'Ultra',
};

/**
 * One global knob that scales row height, padding, gaps, and type size
 * everywhere at once — tables, record sections, and forms all read it, so
 * there is nothing to configure twice. Persisted so a reload keeps the
 * chosen density; applied to `<html data-density>` by `DensityProvider` so
 * plain CSS custom properties can do the rest without a re-render per node.
 */
type UIState = {
  density: Density;
  setDensity: (density: Density) => void;
  cycleDensity: () => void;
};

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      density: 'comfortable',
      setDensity: (density) => set({ density }),
      cycleDensity: () =>
        set((state) => {
          const next = DENSITIES[(DENSITIES.indexOf(state.density) + 1) % DENSITIES.length];
          return { density: next };
        }),
    }),
    { name: 'open-rm-ui' },
  ),
);
