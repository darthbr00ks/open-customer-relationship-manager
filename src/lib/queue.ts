import { Queue, type ConnectionOptions } from 'bullmq';

import { REDIS_URL } from './env';

/** BullMQ requires `maxRetriesPerRequest: null` on its connections. */
export const queueConnection: ConnectionOptions = {
  url: REDIS_URL,
  maxRetriesPerRequest: null,
};

export const QUEUE_NAME = 'open-rm-jobs';

/** Payloads accepted by the worker, keyed by job name. */
export type JobPayloads = {
  'import-entities': {
    workspace_id: string;
    /** Raw CSV text: a header row plus one entity per line. */
    csv: string;
    created_by_user_id?: string | null;
  };
  'pipeline-report': {
    workspace_id: string;
  };
};

export type JobName = keyof JobPayloads;

const globalForQueue = globalThis as unknown as { jobQueue?: Queue };

/** Returns the shared queue without connecting during module initialization. */
export function getJobQueue(): Queue {
  if (!globalForQueue.jobQueue) {
    globalForQueue.jobQueue = new Queue(QUEUE_NAME, {
      connection: queueConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { age: 3600, count: 500 },
        removeOnFail: { age: 86400 },
      },
    });
  }
  return globalForQueue.jobQueue;
}

/** Enqueue a job with a payload checked against `JobPayloads`. */
export async function enqueue<N extends JobName>(name: N, payload: JobPayloads[N]) {
  return getJobQueue().add(name, payload);
}
