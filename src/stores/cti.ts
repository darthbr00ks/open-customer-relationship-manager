'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { defaultProviderLabel, type CtiConfig, type CtiProviderId, type CtiSession } from '@/lib/cti';

type CtiState = {
  config: CtiConfig;
  session: CtiSession;
  setConfig: (patch: Partial<CtiConfig>) => void;
  setProvider: (providerId: CtiProviderId) => void;
  connect: () => void;
  disconnect: () => void;
};

const defaultProviderId: CtiProviderId = 'open-cti';

const defaultConfig = (): CtiConfig => ({
  providerId: defaultProviderId,
  providerLabel: defaultProviderLabel(defaultProviderId),
  endpoint: '',
  username: '',
  extension: '',
});

const defaultSession = (): CtiSession => ({
  status: 'disconnected',
  connectedAt: null,
});

function trimConfig(config: CtiConfig): CtiConfig {
  return {
    providerId: config.providerId,
    providerLabel: config.providerLabel.trim() || defaultProviderLabel(config.providerId),
    endpoint: config.endpoint.trim(),
    username: config.username.trim(),
    extension: config.extension.trim(),
  };
}

/**
 * Browser-local CTI config and session state. This is intentionally separate
 * from the app's "current user" placeholder so telephony auth does not get
 * confused with record ownership or workspace selection.
 */
export const useCtiStore = create<CtiState>()(
  persist(
    (set) => ({
      config: defaultConfig(),
      session: defaultSession(),
      setConfig: (patch) =>
        set((state) => {
          const config = trimConfig({ ...state.config, ...patch });
          return { config };
        }),
      setProvider: (providerId) =>
        set((state) => ({
          config: trimConfig({
            ...state.config,
            providerId,
            providerLabel:
              state.config.providerId === providerId && state.config.providerLabel.trim() !== ''
                ? state.config.providerLabel
                : defaultProviderLabel(providerId),
          }),
        })),
      connect: () =>
        set((state) => ({
          config: trimConfig(state.config),
          session: {
            status: 'connected',
            connectedAt: state.session.connectedAt ?? new Date().toISOString(),
          },
        })),
      disconnect: () =>
        set(() => ({
          session: defaultSession(),
        })),
    }),
    {
      name: 'open-rm-cti',
      merge: (persisted, current) => {
        const state = persisted as Partial<CtiState> | undefined;
        return {
          ...current,
          ...state,
          config: trimConfig({ ...current.config, ...(state?.config ?? {}) }),
          session: { ...current.session, ...(state?.session ?? {}) },
        };
      },
    },
  ),
);
