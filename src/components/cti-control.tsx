'use client';

import { PhoneCall, PhoneOff } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { CTI_PROVIDERS, providerDetails, type CtiProviderId } from '@/lib/cti';
import { cn } from '@/lib/utils';
import { useCtiStore } from '@/stores/cti';

const statusLabel = {
  connected: 'Connected',
  disconnected: 'Disconnected',
} as const;

export function CtiControl() {
  const config = useCtiStore((state) => state.config);
  const session = useCtiStore((state) => state.session);
  const setConfig = useCtiStore((state) => state.setConfig);
  const setProvider = useCtiStore((state) => state.setProvider);
  const connect = useCtiStore((state) => state.connect);
  const disconnect = useCtiStore((state) => state.disconnect);

  const provider = providerDetails(config.providerId);
  const isConnected = session.status === 'connected';
  const canConnect = config.endpoint.trim() !== '' && config.username.trim() !== '';
  const StatusIcon = isConnected ? PhoneCall : PhoneOff;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Telephony: ${statusLabel[session.status]}`}
          className="relative"
        >
          <StatusIcon />
          <span
            className={cn(
              'absolute top-2 right-2 size-2 rounded-full border border-background',
              isConnected ? 'bg-emerald-500' : 'bg-muted-foreground/40',
            )}
            aria-hidden="true"
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-medium">Telephony</p>
            <p className="text-muted-foreground text-xs">
              CTI sign-in is separate from your open-rm identity and stays in this browser.
            </p>
          </div>
          <Badge variant={isConnected ? 'default' : 'secondary'}>{statusLabel[session.status]}</Badge>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cti-provider">Provider</Label>
            <Select value={config.providerId} onValueChange={(value) => setProvider(value as CtiProviderId)}>
              <SelectTrigger id="cti-provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CTI_PROVIDERS.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">{provider.description}</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cti-provider-label">Connection label</Label>
            <Input
              id="cti-provider-label"
              value={config.providerLabel}
              onChange={(event) => setConfig({ providerLabel: event.target.value })}
              placeholder={provider.label}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cti-endpoint">Endpoint</Label>
            <Input
              id="cti-endpoint"
              value={config.endpoint}
              onChange={(event) => setConfig({ endpoint: event.target.value })}
              placeholder="https://telephony.example.com/opencti"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cti-username">Agent / user</Label>
              <Input
                id="cti-username"
                value={config.username}
                onChange={(event) => setConfig({ username: event.target.value })}
                placeholder="agent@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cti-extension">Extension</Label>
              <Input
                id="cti-extension"
                value={config.extension}
                onChange={(event) => setConfig({ extension: event.target.value })}
                placeholder="Optional"
              />
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-3">
          <div className="rounded-md border p-3">
            <p className="text-sm font-medium">{config.providerLabel || provider.label}</p>
            <p className="text-muted-foreground mt-1 text-xs">
              {isConnected
                ? `Connected as ${config.username}${config.extension ? ` · Ext ${config.extension}` : ''}`
                : 'Ready for a browser-local CTI session.'}
            </p>
            {session.connectedAt ? (
              <p className="text-muted-foreground mt-1 text-xs">
                Connected {new Date(session.connectedAt).toLocaleString()}
              </p>
            ) : null}
          </div>

          <div className="flex gap-2">
            <Button className="flex-1" onClick={connect} disabled={isConnected || !canConnect}>
              Log in
            </Button>
            <Button variant="secondary" className="flex-1" onClick={disconnect} disabled={!isConnected}>
              Log out
            </Button>
          </div>

          <p className="text-muted-foreground text-xs">
            This first cut stores provider details locally so a real CTI adapter can add screen-pop,
            click-to-dial, and call logging later without changing the shell entry point.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
