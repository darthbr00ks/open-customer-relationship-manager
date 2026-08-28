import {
  Building2,
  FileText,
  LayoutGrid,
  LifeBuoy,
  Lightbulb,
  MessagesSquare,
  Package,
  Repeat,
  ShoppingCart,
  Siren,
  Tags,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

import type { ResourceName } from '@/lib/api/resources';

import { CASE_FIELDS, CASE_LAYOUT, CASE_LIST_COLUMNS, CASE_SEARCH_FIELDS } from './schema/case';
import {
  CHAT_CHANNEL_FIELDS,
  CHAT_CHANNEL_LAYOUT,
  CHAT_CHANNEL_LIST_COLUMNS,
  CHAT_CHANNEL_SEARCH_FIELDS,
} from './schema/chat-channel';
import { DEAL_FIELDS, DEAL_LAYOUT, DEAL_LIST_COLUMNS, DEAL_SEARCH_FIELDS } from './schema/deal';
import {
  OFFERING_FIELDS,
  OFFERING_LAYOUT,
  OFFERING_LIST_COLUMNS,
  OFFERING_SEARCH_FIELDS,
} from './schema/offering';
import { ORDER_FIELDS, ORDER_LAYOUT, ORDER_LIST_COLUMNS, ORDER_SEARCH_FIELDS } from './schema/order';
import {
  PRODUCT_FIELDS,
  PRODUCT_LAYOUT,
  PRODUCT_LIST_COLUMNS,
  PRODUCT_SEARCH_FIELDS,
} from './schema/product';
import { QUOTE_FIELDS, QUOTE_LAYOUT, QUOTE_LIST_COLUMNS, QUOTE_SEARCH_FIELDS } from './schema/quote';
import {
  SERVICE_DELIVERY_FIELDS,
  SERVICE_DELIVERY_LAYOUT,
  SERVICE_DELIVERY_LIST_COLUMNS,
  SERVICE_DELIVERY_SEARCH_FIELDS,
} from './schema/service-delivery';
import {
  SUBSCRIPTION_FIELDS,
  SUBSCRIPTION_LAYOUT,
  SUBSCRIPTION_LIST_COLUMNS,
  SUBSCRIPTION_SEARCH_FIELDS,
} from './schema/subscription';
import { ENTITY_FIELDS, ENTITY_LAYOUT, ENTITY_LIST_COLUMNS, ENTITY_SEARCH_FIELDS } from './schema/entity';
import {
  INCIDENT_FIELDS,
  INCIDENT_LAYOUT,
  INCIDENT_LIST_COLUMNS,
  INCIDENT_SEARCH_FIELDS,
} from './schema/incident';
import { PERSON_FIELDS, PERSON_LAYOUT, PERSON_LIST_COLUMNS, PERSON_SEARCH_FIELDS } from './schema/person';
import {
  REQUEST_FIELDS,
  REQUEST_LAYOUT,
  REQUEST_LIST_COLUMNS,
  REQUEST_SEARCH_FIELDS,
} from './schema/request';
import type { FieldDef, ObjectLayout } from './schema/types';

export type ObjectKey =
  | 'entities'
  | 'persons'
  | 'deals'
  | 'cases'
  | 'incidents'
  | 'requests'
  | 'chat_channels'
  | 'products'
  | 'offerings'
  | 'quotes'
  | 'orders'
  | 'subscriptions'
  | 'service_deliveries';

export type NoteParentType =
  | 'entity'
  | 'person'
  | 'deal'
  | 'case'
  | 'incident'
  | 'request'
  | 'chat_channel'
  | 'chat_conversation'
  | 'product'
  | 'offering'
  | 'quote'
  | 'order'
  | 'subscription'
  | 'service_delivery';

export type ObjectConfig = {
  key: ObjectKey;
  resource: ResourceName;
  /** Value stored in `note.parent_type` for this object's Activity/Notes tabs. */
  noteParentType: NoteParentType;
  singular: string;
  plural: string;
  routeBase: string;
  icon: LucideIcon;
  /** What the record header shows: e.g. Entity → `name`, Case → `subject`. */
  titleField: string;
  /** Short line under the title, e.g. "Customer · Technology" for an Entity. */
  subtitleFields?: string[];
  fields: Record<string, FieldDef>;
  layout: ObjectLayout;
  listColumns: FieldDef[];
  searchFields: string[];
  /** Fields the create form pre-fills with sensible defaults. */
  defaults?: Record<string, unknown>;
};

export const OBJECTS: Record<ObjectKey, ObjectConfig> = {
  entities: {
    key: 'entities',
    noteParentType: 'entity',
    resource: 'entities',
    singular: 'Entity',
    plural: 'Entities',
    routeBase: '/entities',
    icon: Building2,
    titleField: 'name',
    subtitleFields: ['entity_type', 'relationship_stage'],
    fields: ENTITY_FIELDS,
    layout: ENTITY_LAYOUT,
    listColumns: ENTITY_LIST_COLUMNS,
    searchFields: ENTITY_SEARCH_FIELDS,
    defaults: { entity_type: 'company', relationship_stage: 'prospect' },
  },
  persons: {
    key: 'persons',
    noteParentType: 'person',
    resource: 'persons',
    singular: 'Person',
    plural: 'People',
    routeBase: '/people',
    icon: Users,
    titleField: 'first_name',
    fields: PERSON_FIELDS,
    layout: PERSON_LAYOUT,
    listColumns: PERSON_LIST_COLUMNS,
    searchFields: PERSON_SEARCH_FIELDS,
  },
  deals: {
    key: 'deals',
    noteParentType: 'deal',
    resource: 'deals',
    singular: 'Deal',
    plural: 'Deals',
    routeBase: '/deals',
    icon: LayoutGrid,
    titleField: 'name',
    subtitleFields: ['stage'],
    fields: DEAL_FIELDS,
    layout: DEAL_LAYOUT,
    listColumns: DEAL_LIST_COLUMNS,
    searchFields: DEAL_SEARCH_FIELDS,
    defaults: { stage: 'qualification', currency_code: 'USD' },
  },
  cases: {
    key: 'cases',
    noteParentType: 'case',
    resource: 'cases',
    singular: 'Case',
    plural: 'Cases',
    routeBase: '/cases',
    icon: LifeBuoy,
    titleField: 'subject',
    subtitleFields: ['case_number', 'status'],
    fields: CASE_FIELDS,
    layout: CASE_LAYOUT,
    listColumns: CASE_LIST_COLUMNS,
    searchFields: CASE_SEARCH_FIELDS,
    defaults: { status: 'new', priority: 'medium' },
  },
  incidents: {
    key: 'incidents',
    noteParentType: 'incident',
    resource: 'incidents',
    singular: 'Incident',
    plural: 'Incidents',
    routeBase: '/incidents',
    icon: Siren,
    titleField: 'title',
    subtitleFields: ['incident_number', 'status'],
    fields: INCIDENT_FIELDS,
    layout: INCIDENT_LAYOUT,
    listColumns: INCIDENT_LIST_COLUMNS,
    searchFields: INCIDENT_SEARCH_FIELDS,
    defaults: { status: 'investigating' },
  },
  chat_channels: {
    key: 'chat_channels',
    noteParentType: 'chat_channel',
    resource: 'chat-channels',
    singular: 'Chat channel',
    plural: 'Chat channels',
    routeBase: '/chat/channels',
    icon: MessagesSquare,
    titleField: 'name',
    subtitleFields: ['intake_mode', 'auth_mode'],
    fields: CHAT_CHANNEL_FIELDS,
    layout: CHAT_CHANNEL_LAYOUT,
    listColumns: CHAT_CHANNEL_LIST_COLUMNS,
    searchFields: CHAT_CHANNEL_SEARCH_FIELDS,
    defaults: {
      intake_mode: 'case',
      auth_mode: 'none',
      is_enabled: true,
      collect_name: true,
      collect_email: true,
      auto_create_entity: true,
      deal_stage: 'qualification',
      deal_currency_code: 'USD',
      case_priority: 'medium',
      session_ttl_hours: 720,
    },
  },
  products: {
    key: 'products',
    noteParentType: 'product',
    resource: 'products',
    singular: 'Product',
    plural: 'Products',
    routeBase: '/products',
    icon: Package,
    titleField: 'name',
    subtitleFields: ['category', 'status'],
    fields: PRODUCT_FIELDS,
    layout: PRODUCT_LAYOUT,
    listColumns: PRODUCT_LIST_COLUMNS,
    searchFields: PRODUCT_SEARCH_FIELDS,
    defaults: { status: 'draft' },
  },
  offerings: {
    key: 'offerings',
    noteParentType: 'offering',
    resource: 'offerings',
    singular: 'Offering',
    plural: 'Offerings',
    routeBase: '/offerings',
    icon: Tags,
    titleField: 'name',
    subtitleFields: ['sku', 'offering_type'],
    fields: OFFERING_FIELDS,
    layout: OFFERING_LAYOUT,
    listColumns: OFFERING_LIST_COLUMNS,
    searchFields: OFFERING_SEARCH_FIELDS,
    defaults: { offering_type: 'good', unit_of_measure: 'each', fulfillment_policy: 'none' },
  },
  quotes: {
    key: 'quotes',
    noteParentType: 'quote',
    resource: 'quotes',
    singular: 'Quote',
    plural: 'Quotes',
    routeBase: '/quotes',
    icon: FileText,
    titleField: 'name',
    subtitleFields: ['quote_number', 'status'],
    fields: QUOTE_FIELDS,
    layout: QUOTE_LAYOUT,
    listColumns: QUOTE_LIST_COLUMNS,
    searchFields: QUOTE_SEARCH_FIELDS,
    defaults: { status: 'draft', currency_code: 'USD' },
  },
  orders: {
    key: 'orders',
    noteParentType: 'order',
    resource: 'orders',
    singular: 'Order',
    plural: 'Orders',
    routeBase: '/orders',
    icon: ShoppingCart,
    titleField: 'order_number',
    subtitleFields: ['status', 'fulfillment_status'],
    fields: ORDER_FIELDS,
    layout: ORDER_LAYOUT,
    listColumns: ORDER_LIST_COLUMNS,
    searchFields: ORDER_SEARCH_FIELDS,
    defaults: { status: 'draft', fulfillment_status: 'not_started', billing_status: 'not_invoiced', currency_code: 'USD' },
  },
  subscriptions: {
    key: 'subscriptions',
    noteParentType: 'subscription',
    resource: 'subscriptions',
    singular: 'Subscription',
    plural: 'Subscriptions',
    routeBase: '/subscriptions',
    icon: Repeat,
    titleField: 'name',
    subtitleFields: ['subscription_number', 'status'],
    fields: SUBSCRIPTION_FIELDS,
    layout: SUBSCRIPTION_LAYOUT,
    listColumns: SUBSCRIPTION_LIST_COLUMNS,
    searchFields: SUBSCRIPTION_SEARCH_FIELDS,
    defaults: { status: 'active', billing_period: 'month', billing_interval_count: 1, currency_code: 'USD', auto_renew: true },
  },
  service_deliveries: {
    key: 'service_deliveries',
    noteParentType: 'service_delivery',
    resource: 'service-deliveries',
    singular: 'Service delivery',
    plural: 'Service deliveries',
    routeBase: '/service-deliveries',
    icon: Wrench,
    titleField: 'name',
    subtitleFields: ['delivery_number', 'status'],
    fields: SERVICE_DELIVERY_FIELDS,
    layout: SERVICE_DELIVERY_LAYOUT,
    listColumns: SERVICE_DELIVERY_LIST_COLUMNS,
    searchFields: SERVICE_DELIVERY_SEARCH_FIELDS,
    defaults: { status: 'not_started' },
  },
  requests: {
    key: 'requests',
    noteParentType: 'request',
    resource: 'requests',
    singular: 'Request',
    plural: 'Requests',
    routeBase: '/requests',
    icon: Lightbulb,
    titleField: 'title',
    subtitleFields: ['request_number', 'status'],
    fields: REQUEST_FIELDS,
    layout: REQUEST_LAYOUT,
    listColumns: REQUEST_LIST_COLUMNS,
    searchFields: REQUEST_SEARCH_FIELDS,
    defaults: { status: 'submitted', priority: 'medium' },
  },
};

export const OBJECT_LIST = Object.values(OBJECTS);

/**
 * Objects displayed in the primary navigation, in display order.
 *
 * Two kinds of object stay out of it. Chat channels are configuration rather
 * than a record type people browse, so they are reached from the chat inbox.
 * Offerings and service deliveries are reached from the record they belong to —
 * an offering from its product, a delivery from its order — because that is how
 * anyone actually looks for them.
 */
export const NAV_OBJECT_ORDER: ObjectKey[] = [
  'entities',
  'persons',
  'deals',
  'quotes',
  'orders',
  'subscriptions',
  'products',
  'cases',
  'incidents',
  'requests',
];

/** Reverse lookup so a lookup field's target resource can be rendered as a link to its record page. */
export function objectKeyForResource(resource: ResourceName): ObjectKey | undefined {
  return OBJECT_LIST.find((object) => object.resource === resource)?.key;
}

/** The record's display title — Person is the one object without a single "name" field. */
export function titleOf(object: ObjectConfig, row: Record<string, unknown>): string {
  if (object.key === 'persons') {
    return [row.first_name, row.last_name].filter(Boolean).join(' ') || 'Unnamed person';
  }
  return String(row[object.titleField] ?? 'Untitled');
}

/** Every field defined anywhere in an object's layout, deduped by key — the full catalog for column/filter pickers. */
export function objectAllFields(objectKey: ObjectKey): FieldDef[] {
  const seen = new Map<string, FieldDef>();
  for (const section of OBJECTS[objectKey].layout.sections) {
    for (const field of section.fields) if (!seen.has(field.key)) seen.set(field.key, field);
  }
  return [...seen.values()];
}
