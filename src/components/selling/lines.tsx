'use client';

import type { RelatedColumn } from '@/components/related-list';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatLabel } from '@/lib/format';
import { offeringTypeTone } from '@/lib/schema/offering';
import { fulfillmentStatusTone } from '@/lib/schema/order';
import type { TransactionLine } from '@/lib/types';

/**
 * Columns for a quote's or an order's lines.
 *
 * Both carry the same snapshot of the catalog, so they read the same way: what
 * was sold, how it is charged, how much, and what it came to. The billing terms
 * are shown next to the charge because "$25" means something different per seat
 * per month than it does once.
 */
export function transactionLineColumns<Row extends TransactionLine>(options?: {
  /** Order lines also track how much of the line has actually gone out. */
  fulfillment?: boolean;
  /** Quote lines can be presented without being counted in the total. */
  optional?: boolean;
}): RelatedColumn<Row>[] {
  const columns: RelatedColumn<Row>[] = [
    {
      key: 'name',
      label: 'Line',
      render: (row) => (
        <div className="min-w-0">
          <div className="truncate">{row.name}</div>
          {row.sku ? <div className="text-muted-foreground font-mono text-xs">{row.sku}</div> : null}
        </div>
      ),
    },
    {
      key: 'offering_type',
      label: 'Type',
      render: (row) => <Badge variant={offeringTypeTone(row.offering_type)}>{formatLabel(row.offering_type)}</Badge>,
    },
    {
      key: 'charge_type',
      label: 'Charge',
      render: (row) => (
        <div className="text-sm">
          <div>{formatLabel(row.charge_type)}</div>
          {row.billing_period ? (
            <div className="text-muted-foreground text-xs">
              {row.billing_interval_count > 1 ? `every ${row.billing_interval_count} ` : 'per '}
              {row.billing_period}
              {row.term_months ? ` · ${row.term_months} mo term` : ''}
            </div>
          ) : null}
        </div>
      ),
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
    {
      key: 'unit_amount',
      label: 'Unit price',
      render: (row) => (
        <span className="tabular-nums">{formatCurrency(row.unit_amount, row.currency_code)}</span>
      ),
    },
    {
      key: 'discount_amount',
      label: 'Discount',
      render: (row) =>
        row.discount_amount === '0' ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span className="tabular-nums">−{formatCurrency(row.discount_amount, row.currency_code)}</span>
        ),
    },
    {
      key: 'total_amount',
      label: 'Total',
      render: (row) => (
        <span className="font-medium tabular-nums">{formatCurrency(row.total_amount, row.currency_code)}</span>
      ),
    },
  ];

  if (options?.optional) {
    columns.splice(1, 0, {
      key: 'is_optional',
      label: 'Included',
      render: (row) =>
        (row as { is_optional?: boolean }).is_optional ? (
          <Badge variant="outline">Optional</Badge>
        ) : (
          <span className="text-muted-foreground">Yes</span>
        ),
    });
  }

  if (options?.fulfillment) {
    columns.push({
      key: 'fulfillment_status',
      label: 'Fulfillment',
      render: (row) => {
        const line = row as unknown as { fulfillment_status: string; quantity_fulfilled: string };
        return (
          <div className="flex flex-col gap-1">
            <Badge variant={fulfillmentStatusTone(line.fulfillment_status)}>{formatLabel(line.fulfillment_status)}</Badge>
            <span className="text-muted-foreground text-xs tabular-nums">
              {line.quantity_fulfilled} of {row.quantity} sent
            </span>
          </div>
        );
      },
    });
  }

  return columns;
}

/** The money summary that sits under a quote's or an order's lines. */
export function DocumentTotals({
  currency,
  subtotal,
  discount,
  tax,
  total,
}: {
  currency: string;
  subtotal: string;
  discount: string;
  tax: string;
  total: string;
}) {
  const rows: [string, string, boolean][] = [
    ['Subtotal', subtotal, false],
    ['Discount', discount === '0' ? discount : `-${discount}`, false],
    ['Tax', tax, false],
    ['Total', total, true],
  ];

  return (
    <dl className="ml-auto w-full max-w-xs text-sm">
      {rows.map(([label, amount, strong]) => (
        <div key={label} className={`flex justify-between py-1 ${strong ? 'border-t pt-2 font-semibold' : ''}`}>
          <dt className={strong ? '' : 'text-muted-foreground'}>{label}</dt>
          <dd className="tabular-nums">{formatCurrency(amount, currency)}</dd>
        </div>
      ))}
    </dl>
  );
}
