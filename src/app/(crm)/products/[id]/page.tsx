'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Archive, ArchiveRestore, Pencil, Tags } from 'lucide-react';
import { useState } from 'react';

import { NoWorkspace } from '@/components/empty-state';
import { RecordFormDialog } from '@/components/record-form-dialog';
import { RecordHeader, type RecordAction } from '@/components/record-header';
import { RecordOverview } from '@/components/record-overview';
import { RecordTabs } from '@/components/record-tabs';
import { RelatedList } from '@/components/related-list';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api-client';
import { invalidateList, useCachedList } from '@/lib/data-cache';
import { formatLabel } from '@/lib/format';
import { OBJECTS } from '@/lib/objects';
import { offeringTypeTone } from '@/lib/schema/offering';
import { productStatusTone } from '@/lib/schema/product';
import type { Offering, Product } from '@/lib/types';
import { useWorkspaceStore } from '@/stores/workspace';

const object = OBJECTS.products;

/**
 * A Product page is mostly a way into its Offerings: the product says what the
 * company sells, and each offering says one exact thing a customer can buy.
 */
export default function ProductRecordPage() {
  const { id } = useParams<{ id: string }>();
  const workspaceId = useWorkspaceStore((state) => state.workspaceId);

  const { rows: products, loading } = useCachedList<Product>('products', workspaceId, { includeArchived: true });
  const { rows: offerings } = useCachedList<Offering>('offerings', workspaceId, { includeArchived: true });

  const [editing, setEditing] = useState(false);
  const [addingOffering, setAddingOffering] = useState(false);

  if (!workspaceId) return <NoWorkspace />;
  const product = products.find((row) => row.id === id);
  if (!product) {
    return <p className="text-muted-foreground text-sm">{loading ? 'Loading…' : 'Product not found in this workspace.'}</p>;
  }

  const productOfferings = offerings.filter((offering) => offering.product_id === product.id);

  const toggleArchive = async () => {
    if (product.archived_at) await api.update('products', product.id, workspaceId, { archived_at: null });
    else await api.archive('products', product.id, workspaceId);
    invalidateList('products', workspaceId);
  };

  const actions: RecordAction[] = [
    { key: 'edit', label: 'Edit', icon: Pencil, onClick: () => setEditing(true), primary: true },
    { key: 'add-offering', label: 'Add Offering', icon: Tags, onClick: () => setAddingOffering(true), primary: true },
    product.archived_at
      ? { key: 'unarchive', label: 'Unarchive', icon: ArchiveRestore, onClick: () => void toggleArchive() }
      : { key: 'archive', label: 'Archive', icon: Archive, onClick: () => void toggleArchive(), variant: 'destructive' },
  ];

  return (
    <div>
      <RecordHeader
        title={product.name}
        archived={Boolean(product.archived_at)}
        actions={actions}
        badges={
          <>
            <Badge variant={productStatusTone(product.status)}>{formatLabel(product.status)}</Badge>
            {product.category ? (
              <>
                <span>·</span>
                <span>{formatLabel(product.category)}</span>
              </>
            ) : null}
            <span>·</span>
            <span>
              {productOfferings.length} offering{productOfferings.length === 1 ? '' : 's'}
            </span>
          </>
        }
      />

      <RecordTabs
        noteParentType="product"
        recordId={product.id}
        workspaceId={workspaceId}
        overview={
          <RecordOverview
            layout={object.layout}
            row={product}
            workspaceId={workspaceId}
            resource={object.resource}
            recordId={product.id}
          />
        }
        related={
          <RelatedList
            title="Offerings"
            icon={Tags}
            rows={productOfferings}
            onAdd={() => setAddingOffering(true)}
            addLabel="Add offering"
            emptyLabel="Nothing is sellable yet — an offering is the exact thing a customer buys."
            href={(row) => `/offerings/${row.id}`}
            columns={[
              {
                key: 'sku',
                label: 'SKU',
                render: (row) => <span className="font-mono text-xs">{row.sku}</span>,
              },
              {
                key: 'name',
                label: 'Name',
                render: (row) => (
                  <Link href={`/offerings/${row.id}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
                    {row.name}
                  </Link>
                ),
              },
              {
                key: 'offering_type',
                label: 'Type',
                render: (row) => <Badge variant={offeringTypeTone(row.offering_type)}>{formatLabel(row.offering_type)}</Badge>,
              },
              { key: 'unit_of_measure', label: 'Unit', render: (row) => row.unit_of_measure },
              {
                key: 'fulfillment_policy',
                label: 'Fulfillment',
                render: (row) => formatLabel(row.fulfillment_policy),
              },
              {
                key: 'archived_at',
                label: 'State',
                render: (row) => (row.archived_at ? <Badge variant="secondary">Archived</Badge> : 'Active'),
              },
            ]}
          />
        }
      />

      {editing ? (
        <RecordFormDialog
          open
          onOpenChange={setEditing}
          objectKey="products"
          mode="edit"
          workspaceId={workspaceId}
          recordId={product.id}
          initialValues={product}
        />
      ) : null}
      {addingOffering ? (
        <RecordFormDialog
          open
          onOpenChange={setAddingOffering}
          objectKey="offerings"
          mode="create"
          workspaceId={workspaceId}
          initialValues={{ product_id: product.id }}
          lockedFields={['product_id']}
        />
      ) : null}
    </div>
  );
}
