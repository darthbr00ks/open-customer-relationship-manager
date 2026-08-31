import { toneMap } from './helpers';
import type { FieldDef, ObjectLayout } from './types';

export const EXCEPTION_LEVELS = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'] as const;

export const exceptionLevelTone = toneMap({
  DEBUG: 'outline',
  INFO: 'secondary',
  WARN: 'default',
  ERROR: 'destructive',
  FATAL: 'destructive',
});

const field = (key: string, label: string, type: FieldDef['type'], extra: Partial<FieldDef> = {}) =>
  ({ key, label, type, ...extra }) as FieldDef;

const FIELDS = {
  timestamp: field('timestamp', 'Timestamp', 'datetime', { required: true }),
  level: field('level', 'Level', 'select', { required: true, options: EXCEPTION_LEVELS, badgeTone: exceptionLevelTone }),
  error_code: field('error_code', 'Error code', 'text', { required: true, placeholder: 'DEAL_CREATE_FAILED' }),
  exception_type: field('exception_type', 'Exception type', 'text'),
  message: field('message', 'Message', 'longtext', { required: true }),
  correlation_id: field('correlation_id', 'Correlation ID', 'text'),
  request_id: field('request_id', 'Request ID', 'text'),
  user_id: field('user_id', 'User ID', 'text'),
  tenant_id: field('tenant_id', 'Tenant ID', 'text'),
  entity_id: field('entity_id', 'Entity ID', 'text'),
  operation: field('operation', 'Operation', 'text'),
  service: field('service', 'Service', 'text'),
  environment: field('environment', 'Environment', 'text'),
  version: field('version', 'Version', 'text'),
  dependency: field('dependency', 'Dependency', 'text'),
  retry_count: field('retry_count', 'Retry count', 'number'),
  retryable: field('retryable', 'Retryable', 'boolean'),
  duration_ms: field('duration_ms', 'Duration (ms)', 'number'),
  cause: field('cause', 'Cause', 'longtext'),
  stack_trace: field('stack_trace', 'Stack trace', 'longtext'),
  data: field('data', 'Captured data', 'longtext', {
    helpText: 'Request payload, serialized state, or other long-form data that caused the issue.',
  }),
  created_at: field('created_at', 'Created', 'datetime', { readOnly: true }),
  created_by_user_id: field('created_by_user_id', 'Created by', 'user', { readOnly: true }),
  updated_at: field('updated_at', 'Last modified', 'datetime', { readOnly: true }),
};

export const EXCEPTION_LOG_FIELDS = FIELDS;
export const EXCEPTION_LOG_LAYOUT: ObjectLayout = {
  sections: [
    { title: 'Error', fields: [FIELDS.timestamp, FIELDS.level, FIELDS.error_code, FIELDS.exception_type, FIELDS.message] },
    { title: 'Trace context', fields: [FIELDS.correlation_id, FIELDS.request_id, FIELDS.user_id, FIELDS.tenant_id, FIELDS.entity_id] },
    { title: 'Runtime', fields: [FIELDS.operation, FIELDS.service, FIELDS.environment, FIELDS.version, FIELDS.dependency] },
    { title: 'Execution', fields: [FIELDS.retry_count, FIELDS.retryable, FIELDS.duration_ms] },
    { title: 'Diagnostics', fields: [FIELDS.cause, FIELDS.stack_trace, FIELDS.data] },
    { title: 'System Information', fields: [FIELDS.created_at, FIELDS.created_by_user_id, FIELDS.updated_at] },
  ],
};
export const EXCEPTION_LOG_LIST_COLUMNS = [
  FIELDS.timestamp,
  FIELDS.level,
  FIELDS.error_code,
  FIELDS.message,
  FIELDS.service,
  FIELDS.environment,
  FIELDS.duration_ms,
];
export const EXCEPTION_LOG_SEARCH_FIELDS = [
  'error_code', 'exception_type', 'message', 'correlation_id', 'request_id', 'operation', 'service', 'dependency', 'cause',
];

