'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Archive, ArchiveRestore, Boxes, Coins, Layers, Pencil, Plus, Wrench } from 'lucide-react';
import { useEffect, useState } from 'react';

import { NoWorkspace } from '@/components/empty-state';
import { RecordFormDialog } from '@/components/record-form-dialog';
import { RecordHeader, type RecordAction } from '@/components/record-header';
import { RecordOverview } from '@/components/record-overview';
import { RecordTabs } from '@/components/record-tabs';
import { RelatedList } from '@/components/related-list';
import { ChildFormDialog } from '@/components/selling/child-form-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api-client';
import { invalidateList, useCachedList } from '@/lib/data-cache';
import { formatCurrency, formatDate, formatLabel } from '@/lib/format';
import { OBJECTS } from '@/lib/objects';
import { offeringTypeTone } from '@/lib/schema/offering';
import {
  BUNDLE_COMPONENT_FIELDS,
  INVENTORY_ITEM_FIELDS,
  PRICE_FIELDS,
  PRICE_TIER_FIELDS,
  SERVICE_DEFINITION_FIELDS,
} from '@/lib/schema/selling-children';
import { subtract } from '@/lib/selling/money';
import type {
  BundleComponent,
  InventoryItem,
  Offering,
  Price,
  PriceTier,
  ResolvedCharge,
  ServiceDefinition,
} from '@/lib/types';
import { useWorkspaceStore } from '@/stores/workspace';

const object = OBJECTS.offerings;

export default function OfferingRecordPage() {
  const { id } = useParams<{ id: string }>();
  const workspaceId = useWorkspaceStore((state) => state.workspaceId);

  const { rows: offerings, loading } = useCachedList<Offering>('offerings', workspaceId, { includeArchived: true });
  const { rows: prices } = useCachedList<Price>('prices', workspaceId, { limit: 200 });
  const { rows: tiers } = useCachedList<PriceTier>('price-tiers', workspaceId, { limit: 200 });
  const { rows: components } = useCachedList<BundleComponent>('bundle-components', workspaceId, { limit: 200 });
  const { rows: inventory } = useCachedList<InventoryItem>('inventory-items', workspaceId, { limit: 200 });
  const { rows: definitions } = useCachedList<ServiceDefinition>('service-definitions', workspaceId, { limit: 200 });

  const [editing, setEditing] = useState(false);
  const [addingPrice, setAddingPrice] = useState(false);
  const [addingTierFor, setAddingTierFor] = useState<string | null>(null);
  const [addingComponent, setAddingComponent] = useState(false);
  const [addingStock, setAddingStock] = useState(false);
  const [editingDefinition, setEditingDefinition] = useState(false);

  if (!workspaceId) return <NoWorkspace />;
  const offering = offerings.find((row) => row.id === id);
  if (!offering) {
    return <p className="text-muted-foreground text-sm">{loading ? 'Loading…' : 'Offering not found in this workspace.'}</p>;
  }

  const offeringPrices = prices.filter((price) => price.offering_id === offering.id);
  const offeringComponents = components.filter((component) => component.parent_offering_id === offering.id);
  const offeringStock = inventory.filter((item) => item.offering_id === offering.id);
  const definition = definitions.find((row) => row.offering_id === offering.id);

  const toggleArchive = async () => {
    if (offering.archived_at) await api.update('offerings', offering.id, workspaceId, { archived_at: null });
    else await api.archive('offerings', offering.id, workspaceId);
    invalidateList('offerings', workspaceId);
  };

  const actions: RecordAction[] = [
    { key: 'edit', label: 'Edit', icon: Pencil, onClick: () => setEditing(true), primary: true },
    { key: 'add-price', label: 'Add Price', icon: Coins, onClick: () => setAddingPrice(true), primary: true },
  ];
  if (offering.offering_type === 'bundle') {
    actions.push({ key: 'add-component', label: 'Add Component', icon: Layers, onClick: () => setAddingComponent(true) });
  }
  if (offering.fulfillment_policy === 'shipping') {
    actions.push({ key: 'add-stock', label: 'Add Stock', icon: Boxes, onClick: () => setAddingStock(true) });
  }
  if (offering.offering_type === 'service') {
    actions.push({
      key: 'service-definition',
      label: definition ? 'Edit Service Definition' : 'Add Service Definition',
      icon: Wrench,
      onClick: () => setEditingDefinition(true),
    });
  }
  actions.push(
    offering.archived_at
      ? { key: 'unarchive', label: 'Unarchive', icon: ArchiveRestore, onClick: () => void toggleArchive() }
      : { key: 'archive', label: 'Archive', icon: Archive, onClick: () => void toggleArchive(), variant: 'destructive' },
  );

  return (
    <div>
      <RecordHeader
        title={offering.name}
        archived={Boolean(offering.archived_at)}
        actions={actions}
        badges={
          <>
            <span className="font-mono text-xs">{offering.sku}</span>
            <span>·</span>
            <Badge variant={offeringTypeTone(offering.offering_type)}>{formatLabel(offering.offering_type)}</Badge>
            <span>·</span>
            <span>per {offering.unit_of_measure}</span>
            <span>·</span>
            <Link href={`/products/${offering.product_id}`} className="text-primary hover:underline">
              View product
            </Link>
          </>
        }
      />

      <RecordTabs
        noteParentType="offering"
        recordId={offering.id}
        workspaceId={workspaceId}
        overview={
          <RecordOverview
            layout={object.layout}
            row={offering}
            workspaceId={workspaceId}
            resource={object.resource}
            recordId={offering.id}
          />
        }
        related={
          <>
            <PriceCheck offering={offering} workspaceId={workspaceId} />

            <RelatedList
              title="Prices"
              icon={Coins}
              rows={offeringPrices}
              onAdd={() => setAddingPrice(true)}
              addLabel="Add price"
              emptyLabel="No prices yet. An offering can carry several at once — a setup fee, a recurring charge, and a usage rate."
              expand={(row) => (
                <PriceTiers
                  price={row}
                  tiers={tiers.filter((tier) => tier.price_id === row.id)}
                  onAddTier={() => setAddingTierFor(row.id)}
                />
              )}
              columns={[
                { key: 'name', label: 'Charge', render: (row) => row.name ?? 'List price' },
                { key: 'charge_type', label: 'Type', render: (row) => formatLabel(row.charge_type) },
                { key: 'pricing_model', label: 'Model', render: (row) => formatLabel(row.pricing_model) },
                {
                  key: 'unit_amount',
                  label: 'Amount',
                  render: (row) => (
                    <span className="tabular-nums">{formatCurrency(row.unit_amount, row.currency_code)}</span>
                  ),
                },
                {
                  key: 'billing_period',
                  label: 'Billing',
                  render: (row) =>
                    row.billing_period
                      ? `${row.billing_interval_count > 1 ? `every ${row.billing_interval_count} ` : 'per '}${row.billing_period}`
                      : '—',
                },
                {
                  key: 'included_quantity',
                  label: 'Included',
                  render: (row) => row.included_quantity ?? '—',
                },
                {
                  key: 'effective',
                  label: 'Effective',
                  render: (row) =>
                    row.effective_from || row.effective_until
                      ? `${row.effective_from ? formatDate(row.effective_from) : 'always'} → ${row.effective_until ? formatDate(row.effective_until) : 'open'}`
                      : 'Always',
                },
              ]}
            />

            {offering.offering_type === 'bundle' ? (
              <RelatedList
                title="Bundle components"
                icon={Layers}
                rows={offeringComponents}
                onAdd={() => setAddingComponent(true)}
                addLabel="Add component"
                emptyLabel="A bundle is made of other offerings — add the ones it contains."
                columns={[
                  {
                    key: 'child_offering_id',
                    label: 'Component',
                    render: (row) => {
                      const child = offerings.find((candidate) => candidate.id === row.child_offering_id);
                      return child ? (
                        <Link href={`/offerings/${child.id}`} className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                          {child.name}
                        </Link>
                      ) : (
                        'Unknown'
                      );
                    },
                  },
                  { key: 'default_quantity', label: 'Quantity', render: (row) => row.default_quantity },
                  {
                    key: 'is_required',
                    label: 'Required',
                    render: (row) => (row.is_required ? 'Yes' : <Badge variant="outline">Optional</Badge>),
                  },
                  {
                    key: 'is_separately_priced',
                    label: 'Pricing',
                    render: (row) => (row.is_separately_priced ? 'Priced separately' : 'Covered by bundle'),
                  },
                  {
                    key: 'is_visible_to_customer',
                    label: 'Shown',
                    render: (row) => (row.is_visible_to_customer ? 'Yes' : 'Hidden'),
                  },
                ]}
              />
            ) : null}

            {offering.offering_type === 'good' ? (
              <RelatedList
                title="Inventory"
                icon={Boxes}
                rows={offeringStock}
                onAdd={() => setAddingStock(true)}
                addLabel="Add stock"
                emptyLabel="No stock tracked. Inventory is per offering — a large blue shirt is not a medium red one."
                columns={[
                  { key: 'location_code', label: 'Location', render: (row) => row.location_name ?? row.location_code },
                  { key: 'quantity_on_hand', label: 'On hand', render: (row) => <span className="tabular-nums">{row.quantity_on_hand}</span> },
                  { key: 'quantity_reserved', label: 'Reserved', render: (row) => <span className="tabular-nums">{row.quantity_reserved}</span> },
                  {
                    key: 'available',
                    // Derived rather than stored, so the two numbers it comes
                    // from cannot drift apart.
                    label: 'Available',
                    render: (row) => (
                      <span className="font-medium tabular-nums">
                        {subtract(row.quantity_on_hand, row.quantity_reserved)}
                      </span>
                    ),
                  },
                  { key: 'reorder_point', label: 'Reorder at', render: (row) => row.reorder_point ?? '—' },
                  { key: 'status', label: 'Status', render: (row) => formatLabel(row.status) },
                ]}
              />
            ) : null}

            {offering.offering_type === 'service' ? (
              <RelatedList
                title="Service definition"
                icon={Wrench}
                rows={definition ? [definition] : []}
                onAdd={() => setEditingDefinition(true)}
                addLabel={definition ? 'Edit' : 'Add definition'}
                emptyLabel="What this service promises — scope, hours, SLA — reused by every engagement sold from it."
                columns={[
                  { key: 'scope_type', label: 'Scope', render: (row) => formatLabel(row.scope_type) },
                  { key: 'estimated_hours', label: 'Estimated hours', render: (row) => row.estimated_hours ?? '—' },
                  { key: 'delivery_location', label: 'Location', render: (row) => row.delivery_location ?? '—' },
                  { key: 'required_skills', label: 'Skills', render: (row) => row.required_skills ?? '—' },
                  { key: 'service_level_agreement', label: 'SLA', render: (row) => row.service_level_agreement ?? '—' },
                ]}
              />
            ) : null}
          </>
        }
      />

      {editing ? (
        <RecordFormDialog
          open
          onOpenChange={setEditing}
          objectKey="offerings"
          mode="edit"
          workspaceId={workspaceId}
          recordId={offering.id}
          initialValues={offering}
        />
      ) : null}
      {addingPrice ? (
        <ChildFormDialog
          open
          onOpenChange={setAddingPrice}
          title="Add a price"
          description="Prices are effective-dated and never overwritten — superseding one means closing its window and adding another."
          resource="prices"
          fields={PRICE_FIELDS}
          fixed={{ offering_id: offering.id }}
          initialValues={{ currency_code: 'USD', charge_type: 'one_time', pricing_model: 'flat', billing_interval_count: 1 }}
          workspaceId={workspaceId}
        />
      ) : null}
      {addingTierFor ? (
        <ChildFormDialog
          open
          onOpenChange={(open) => !open && setAddingTierFor(null)}
          title="Add a price band"
          resource="price-tiers"
          fields={PRICE_TIER_FIELDS}
          fixed={{ price_id: addingTierFor }}
          workspaceId={workspaceId}
        />
      ) : null}
      {addingComponent ? (
        <ChildFormDialog
          open
          onOpenChange={setAddingComponent}
          title="Add a bundle component"
          description="Each component keeps its own fulfillment and billing lifecycle."
          resource="bundle-components"
          fields={BUNDLE_COMPONENT_FIELDS}
          fixed={{ parent_offering_id: offering.id }}
          initialValues={{ default_quantity: 1, is_required: true, is_separately_priced: false, is_visible_to_customer: true }}
          workspaceId={workspaceId}
        />
      ) : null}
      {addingStock ? (
        <ChildFormDialog
          open
          onOpenChange={setAddingStock}
          title="Add stock"
          resource="inventory-items"
          fields={INVENTORY_ITEM_FIELDS}
          fixed={{ offering_id: offering.id }}
          initialValues={{ quantity_on_hand: 0, quantity_reserved: 0, status: 'available' }}
          workspaceId={workspaceId}
        />
      ) : null}
      {editingDefinition ? (
        <ChildFormDialog
          open
          onOpenChange={setEditingDefinition}
          title={definition ? 'Edit service definition' : 'Add a service definition'}
          resource="service-definitions"
          fields={SERVICE_DEFINITION_FIELDS}
          fixed={{ offering_id: offering.id }}
          recordId={definition?.id}
          initialValues={definition ?? { scope_type: 'fixed' }}
          workspaceId={workspaceId}
        />
      ) : null}
    </div>
  );
}

/** The bands of a tiered, volume, or graduated price, shown inline on its row. */
function PriceTiers({ price, tiers, onAddTier }: { price: Price; tiers: PriceTier[]; onAddTier: () => void }) {
  const tiered = ['tiered', 'volume', 'graduated'].includes(price.pricing_model);

  return (
    <div className="text-sm">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-medium">Bands</span>
        {tiered ? (
          <Button size="sm" variant="outline" onClick={onAddTier}>
            <Plus /> Add band
          </Button>
        ) : null}
      </div>
      {!tiered ? (
        <p className="text-muted-foreground">
          {formatLabel(price.pricing_model)} pricing does not use bands.
        </p>
      ) : tiers.length === 0 ? (
        <p className="text-muted-foreground">No bands yet — this price will come to nothing until one is added.</p>
      ) : (
        <ul className="space-y-1">
          {tiers.map((tier) => (
            <li key={tier.id} className="tabular-nums">
              {tier.up_to ? `Up to ${tier.up_to}` : 'And above'}: {formatCurrency(tier.unit_amount, price.currency_code)} per unit
              {tier.flat_amount && tier.flat_amount !== '0'
                ? ` + ${formatCurrency(tier.flat_amount, price.currency_code)} band fee`
                : ''}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * "What does this cost for 25 of them?" answered from the same pricing engine a
 * quote uses — including the honest answer that it is often several charges.
 */
function PriceCheck({ offering, workspaceId }: { offering: Offering; workspaceId: string }) {
  const [quantity, setQuantity] = useState('1');
  const [charges, setCharges] = useState<ResolvedCharge[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let canceled = false;
    const params = new URLSearchParams({ workspace_id: workspaceId, quantity: quantity || '1' });

    fetch(`/api/v1/offerings/${offering.id}/price?${params}`)
      .then((response) => response.json())
      .then((body) => {
        if (canceled) return;
        if (Array.isArray(body?.charges)) {
          setCharges(body.charges);
          setError(null);
        } else {
          setError('Could not price this offering.');
        }
      })
      .catch(() => !canceled && setError('Could not price this offering.'));

    return () => {
      canceled = true;
    };
  }, [offering.id, workspaceId, quantity]);

  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-4">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <Coins className="text-muted-foreground size-4" /> Price check
        </h3>
        <div className="flex items-center gap-2">
          <label htmlFor="price-check-quantity" className="text-muted-foreground text-sm">
            Quantity
          </label>
          <Input
            id="price-check-quantity"
            type="number"
            min="0"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            className="w-24"
          />
        </div>
      </div>

      <div className="rounded-md border p-4 text-sm">
        {error ? (
          <p className="text-muted-foreground">{error}</p>
        ) : charges == null ? (
          <p className="text-muted-foreground">Pricing…</p>
        ) : charges.length === 0 ? (
          <p className="text-muted-foreground">Nothing prices this offering yet.</p>
        ) : (
          <ul className="space-y-1">
            {charges.map((charge, index) => (
              <li key={charge.price_id ?? index} className="flex justify-between gap-4">
                <span>
                  {charge.name ?? 'List price'}{' '}
                  <span className="text-muted-foreground">
                    ({formatLabel(charge.charge_type)}
                    {charge.billing_period ? `, per ${charge.billing_period}` : ''}
                    {charge.billable_quantity !== quantity ? `, ${charge.billable_quantity} billable` : ''})
                  </span>
                </span>
                <span className="tabular-nums">{formatCurrency(charge.amount, charge.currency_code)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
