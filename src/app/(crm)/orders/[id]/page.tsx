'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Archive, ArchiveRestore, Pencil, Repeat, ShoppingCart, Truck, Wrench } from 'lucide-react';
import { useState } from 'react';

import { NoWorkspace } from '@/components/empty-state';
import { RecordFormDialog } from '@/components/record-form-dialog';
import { RecordHeader, type RecordAction } from '@/components/record-header';
import { RecordOverview } from '@/components/record-overview';
import { RecordTabs } from '@/components/record-tabs';
import { RelatedList } from '@/components/related-list';
import { ChildFormDialog } from '@/components/selling/child-form-dialog';
import { DocumentTotals, transactionLineColumns } from '@/components/selling/lines';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api, ApiError } from '@/lib/api-client';
import { invalidateList, useCachedList } from '@/lib/data-cache';
import { formatCurrency, formatDateTime, formatLabel } from '@/lib/format';
import { OBJECTS } from '@/lib/objects';
import { billingStatusTone, fulfillmentStatusTone, orderStatusTone } from '@/lib/schema/order';
import { SHIPMENT_FIELDS, SHIPMENT_LINE_FIELDS, shipmentStatusTone } from '@/lib/schema/selling-children';
import { serviceDeliveryStatusTone } from '@/lib/schema/service-delivery';
import { subscriptionStatusTone } from '@/lib/schema/subscription';
import type { Order, OrderLine, ServiceDelivery, Shipment, ShipmentLine, Subscription } from '@/lib/types';
import { useWorkspaceStore } from '@/stores/workspace';

const object = OBJECTS.orders;

/**
 * An order is where the three lifecycles the model keeps apart become visible
 * at once: what was sold, what has shipped, and what is being billed.
 */
export default function OrderRecordPage() {
  const { id } = useParams<{ id: string }>();
  const workspaceId = useWorkspaceStore((state) => state.workspaceId);

  const { rows: orders, loading } = useCachedList<Order>('orders', workspaceId, { includeArchived: true });
  const { rows: lines } = useCachedList<OrderLine>('order-lines', workspaceId, { limit: 200 });
  const { rows: shipments } = useCachedList<Shipment>('shipments', workspaceId, { limit: 200 });
  const { rows: shipmentLines } = useCachedList<ShipmentLine>('shipment-lines', workspaceId, { limit: 200 });
  const { rows: subscriptions } = useCachedList<Subscription>('subscriptions', workspaceId);
  const { rows: deliveries } = useCachedList<ServiceDelivery>('service-deliveries', workspaceId);

  const [editing, setEditing] = useState(false);
  const [addingShipment, setAddingShipment] = useState(false);
  const [addingLineTo, setAddingLineTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!workspaceId) return <NoWorkspace />;
  const order = orders.find((row) => row.id === id);
  if (!order) {
    return <p className="text-muted-foreground text-sm">{loading ? 'Loading…' : 'Order not found in this workspace.'}</p>;
  }

  const orderLines = lines.filter((line) => line.order_id === order.id);
  const orderShipments = shipments.filter((shipment) => shipment.order_id === order.id);
  const orderSubscriptions = subscriptions.filter((subscription) => subscription.order_id === order.id);
  const orderDeliveries = deliveries.filter((delivery) => delivery.order_id === order.id);
  const shippableLines = orderLines.filter((line) => line.fulfillment_policy === 'shipping');

  const toggleArchive = async () => {
    if (order.archived_at) await api.update('orders', order.id, workspaceId, { archived_at: null });
    else await api.archive('orders', order.id, workspaceId);
    invalidateList('orders', workspaceId);
  };

  /** Sending a shipment moves stock and fulfillment — never billing. */
  const ship = async (shipment: Shipment) => {
    setError(null);
    try {
      await api.action('shipments', shipment.id, 'ship', workspaceId);
      for (const resource of ['shipments', 'order-lines', 'orders', 'inventory-items'] as const) {
        invalidateList(resource, workspaceId);
      }
    } catch (caught) {
      setError(caught instanceof ApiError ? String(caught.message) : 'Could not ship this shipment.');
    }
  };

  const actions: RecordAction[] = [
    { key: 'edit', label: 'Edit', icon: Pencil, onClick: () => setEditing(true), primary: true },
  ];
  if (shippableLines.length > 0) {
    actions.push({ key: 'add-shipment', label: 'New Shipment', icon: Truck, onClick: () => setAddingShipment(true), primary: true });
  }
  actions.push(
    order.archived_at
      ? { key: 'unarchive', label: 'Unarchive', icon: ArchiveRestore, onClick: () => void toggleArchive() }
      : { key: 'archive', label: 'Archive', icon: Archive, onClick: () => void toggleArchive(), variant: 'destructive' },
  );

  return (
    <div>
      <RecordHeader
        title={order.order_number}
        archived={Boolean(order.archived_at)}
        actions={actions}
        badges={
          <>
            <Badge variant={orderStatusTone(order.status)}>{formatLabel(order.status)}</Badge>
            <Badge variant={fulfillmentStatusTone(order.fulfillment_status)}>
              {formatLabel(order.fulfillment_status)}
            </Badge>
            <Badge variant={billingStatusTone(order.billing_status)}>{formatLabel(order.billing_status)}</Badge>
            <span>·</span>
            <span className="tabular-nums">{formatCurrency(order.total_amount, order.currency_code)}</span>
          </>
        }
      />

      {error ? <p className="text-destructive pt-4 text-sm">{error}</p> : null}

      <RecordTabs
        noteParentType="order"
        recordId={order.id}
        workspaceId={workspaceId}
        overview={
          <RecordOverview
            layout={object.layout}
            row={order}
            workspaceId={workspaceId}
            resource={object.resource}
            recordId={order.id}
          />
        }
        related={
          <>
            <RelatedList
              title="Order lines"
              icon={ShoppingCart}
              rows={orderLines}
              emptyLabel="No lines on this order."
              columns={transactionLineColumns<OrderLine>({ fulfillment: true })}
            />
            <DocumentTotals
              currency={order.currency_code}
              subtotal={order.subtotal_amount}
              discount={order.discount_amount}
              tax={order.tax_amount}
              total={order.total_amount}
            />

            {shippableLines.length > 0 ? (
              <RelatedList
                title="Shipments"
                icon={Truck}
                rows={orderShipments}
                onAdd={() => setAddingShipment(true)}
                addLabel="New shipment"
                emptyLabel="Nothing has been packed yet. An order line can go out in as many shipments as it needs."
                expand={(row) => (
                  <ShipmentDetail
                    shipment={row}
                    lines={shipmentLines.filter((line) => line.shipment_id === row.id)}
                    orderLines={orderLines}
                    onAddLine={() => setAddingLineTo(row.id)}
                    onShip={() => void ship(row)}
                  />
                )}
                columns={[
                  { key: 'shipment_number', label: 'Shipment', render: (row) => row.shipment_number },
                  {
                    key: 'status',
                    label: 'Status',
                    render: (row) => <Badge variant={shipmentStatusTone(row.status)}>{formatLabel(row.status)}</Badge>,
                  },
                  { key: 'carrier', label: 'Carrier', render: (row) => row.carrier ?? '—' },
                  {
                    key: 'tracking_number',
                    label: 'Tracking',
                    render: (row) =>
                      row.tracking_url ? (
                        <a href={row.tracking_url} target="_blank" rel="noreferrer" className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                          {row.tracking_number ?? 'Track'}
                        </a>
                      ) : (
                        (row.tracking_number ?? '—')
                      ),
                  },
                  { key: 'shipped_at', label: 'Shipped', render: (row) => (row.shipped_at ? formatDateTime(row.shipped_at) : '—') },
                  { key: 'is_return', label: 'Direction', render: (row) => (row.is_return ? 'Return' : 'Outbound') },
                ]}
              />
            ) : null}

            {orderSubscriptions.length > 0 ? (
              <RelatedList
                title="Subscriptions"
                icon={Repeat}
                rows={orderSubscriptions}
                href={(row) => `/subscriptions/${row.id}`}
                columns={[
                  {
                    key: 'name',
                    label: 'Subscription',
                    render: (row) => (
                      <Link href={`/subscriptions/${row.id}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
                        {row.name}
                      </Link>
                    ),
                  },
                  {
                    key: 'status',
                    label: 'Status',
                    render: (row) => <Badge variant={subscriptionStatusTone(row.status)}>{formatLabel(row.status)}</Badge>,
                  },
                  {
                    key: 'quantity',
                    label: 'Quantity',
                    render: (row) => (
                      <span className="tabular-nums">
                        {row.quantity} {row.unit_of_measure}
                      </span>
                    ),
                  },
                  { key: 'current_period_end', label: 'Period ends', render: (row) => row.current_period_end ?? '—' },
                ]}
              />
            ) : null}

            {orderDeliveries.length > 0 ? (
              <RelatedList
                title="Service deliveries"
                icon={Wrench}
                rows={orderDeliveries}
                href={(row) => `/service-deliveries/${row.id}`}
                columns={[
                  {
                    key: 'name',
                    label: 'Engagement',
                    render: (row) => (
                      <Link href={`/service-deliveries/${row.id}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
                        {row.name}
                      </Link>
                    ),
                  },
                  {
                    key: 'status',
                    label: 'Status',
                    render: (row) => (
                      <Badge variant={serviceDeliveryStatusTone(row.status)}>{formatLabel(row.status)}</Badge>
                    ),
                  },
                  { key: 'estimated_hours', label: 'Estimated hours', render: (row) => row.estimated_hours ?? '—' },
                  { key: 'hours_consumed', label: 'Hours used', render: (row) => row.hours_consumed },
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
          objectKey="orders"
          mode="edit"
          workspaceId={workspaceId}
          recordId={order.id}
          initialValues={order}
        />
      ) : null}
      {addingShipment ? (
        <ChildFormDialog
          open
          onOpenChange={setAddingShipment}
          title="New shipment"
          description="Add the lines it carries, then send it — sending moves stock and fulfillment, not billing."
          resource="shipments"
          fields={SHIPMENT_FIELDS}
          fixed={{ order_id: order.id }}
          initialValues={{
            shipment_number: `SHP-${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
            status: 'pending',
            is_return: false,
            ship_to_name: order.ship_to_name,
            ship_to_address_line_1: order.ship_to_address_line_1,
            ship_to_city: order.ship_to_city,
            ship_to_region: order.ship_to_region,
            ship_to_postal_code: order.ship_to_postal_code,
            ship_to_country_code: order.ship_to_country_code,
          }}
          workspaceId={workspaceId}
        />
      ) : null}
      {addingLineTo ? (
        <ShipmentLineDialog
          shipmentId={addingLineTo}
          orderLines={shippableLines}
          workspaceId={workspaceId}
          onClose={() => setAddingLineTo(null)}
        />
      ) : null}
    </div>
  );
}

function ShipmentDetail({
  shipment,
  lines,
  orderLines,
  onAddLine,
  onShip,
}: {
  shipment: Shipment;
  lines: ShipmentLine[];
  orderLines: OrderLine[];
  onAddLine: () => void;
  onShip: () => void;
}) {
  const sendable = shipment.status === 'pending' || shipment.status === 'packed';

  return (
    <div className="text-sm">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-medium">Contents</span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onAddLine}>
            Add line
          </Button>
          {sendable ? (
            <Button size="sm" onClick={onShip} disabled={lines.length === 0}>
              <Truck /> Ship it
            </Button>
          ) : null}
        </div>
      </div>
      {lines.length === 0 ? (
        <p className="text-muted-foreground">Nothing on this shipment yet.</p>
      ) : (
        <ul className="space-y-1">
          {lines.map((line) => {
            const orderLine = orderLines.find((candidate) => candidate.id === line.order_line_id);
            return (
              <li key={line.id} className="tabular-nums">
                {orderLine?.name ?? 'Unknown line'} — {line.quantity} {orderLine?.unit_of_measure ?? ''}
                {line.backordered_quantity !== '0' ? ` (${line.backordered_quantity} backordered)` : ''}
                {line.serial_numbers ? ` · serials ${line.serial_numbers}` : ''}
                {line.lot_number ? ` · lot ${line.lot_number}` : ''}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Picking which order line a shipment line covers needs the order's own lines, not a global lookup. */
function ShipmentLineDialog({
  shipmentId,
  orderLines,
  workspaceId,
  onClose,
}: {
  shipmentId: string;
  orderLines: OrderLine[];
  workspaceId: string;
  onClose: () => void;
}) {
  const first = orderLines[0];
  if (!first) return null;

  return (
    <ChildFormDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title="Add a line to the shipment"
      description={
        orderLines.length > 1
          ? 'One line at a time — a shipment can carry several, in whatever quantities actually fit.'
          : undefined
      }
      resource="shipment-lines"
      fields={[
        {
          key: 'order_line_id',
          label: 'Order line',
          type: 'select',
          required: true,
          options: orderLines.map((line) => line.id),
          optionLabel: (value) => orderLines.find((line) => line.id === value)?.name ?? value,
        },
        ...SHIPMENT_LINE_FIELDS,
      ]}
      fixed={{ shipment_id: shipmentId }}
      initialValues={{
        order_line_id: first.id,
        quantity: remainingQuantity(first),
        backordered_quantity: 0,
      }}
      workspaceId={workspaceId}
      onSaved={onClose}
    />
  );
}

/** What is left to send on a line, as the default shipment quantity. */
function remainingQuantity(line: OrderLine): number {
  return Math.max(Number(line.quantity) - Number(line.quantity_fulfilled), 0);
}
