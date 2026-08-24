/** Shape of the JSON the REST API returns. Field names match the database columns. */

export type SharedFields = {
  id: string;
  workspace_id: string;
  owner_user_id: string | null;
  created_by_user_id: string | null;
  updated_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type Entity = SharedFields & {
  name: string;
  legal_name: string | null;
  entity_type: string;
  relationship_stage: string;
  description: string | null;
  website_url: string | null;
  primary_domain: string | null;
  primary_email: string | null;
  primary_phone: string | null;
  city: string | null;
  region: string | null;
  country_code: string | null;
  notes: string | null;
};

export type Person = SharedFields & {
  first_name: string;
  last_name: string | null;
  primary_email: string | null;
  primary_phone: string | null;
};

export type Deal = SharedFields & {
  name: string;
  entity_id: string;
  stage: string;
  amount: string | null;
  currency_code: string;
  expected_close_date: string | null;
};

export type SupportCase = SharedFields & {
  case_number: string;
  subject: string;
  description: string;
  entity_id: string | null;
  status: string;
  priority: string;
  category: string | null;
};

export type PipelineReport = {
  workspace_id: string;
  generated_at: string;
  total_open_value: string;
  by_stage: { stage: string; count: number; value: string }[];
};

export const ENTITY_TYPES = [
  'company',
  'nonprofit',
  'government',
  'education',
  'association',
  'household',
  'other',
] as const;

export const RELATIONSHIP_STAGES = [
  'prospect',
  'customer',
  'partner',
  'former_customer',
  'inactive',
] as const;

export const CASE_STATUSES = ['new', 'open', 'pending', 'resolved', 'closed'] as const;
export const CASE_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
