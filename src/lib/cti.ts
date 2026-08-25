/**
 * Shared client-side CTI metadata. The initial implementation keeps config and
 * session state local to a browser, but this provider/session split leaves room
 * for real adapters (screen-pop, click-to-dial, activity sync) later.
 */
export const CTI_PROVIDERS = [
  {
    id: 'open-cti',
    label: 'Open CTI',
    description: 'A generic Open CTI-compatible telephony bridge.',
  },
  {
    id: 'custom',
    label: 'Custom bridge',
    description: 'Another telephony surface using the same session model.',
  },
] as const;

export type CtiProviderId = (typeof CTI_PROVIDERS)[number]['id'];
export type CtiSessionStatus = 'disconnected' | 'connected';

export type CtiConfig = {
  providerId: CtiProviderId;
  providerLabel: string;
  endpoint: string;
  username: string;
  extension: string;
};

export type CtiSession = {
  status: CtiSessionStatus;
  connectedAt: string | null;
};

export function providerDetails(providerId: CtiProviderId) {
  return CTI_PROVIDERS.find((provider) => provider.id === providerId) ?? CTI_PROVIDERS[0];
}

export function defaultProviderLabel(providerId: CtiProviderId) {
  return providerDetails(providerId).label;
}
