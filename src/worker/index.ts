import 'dotenv/config';

import { Worker, type Job } from 'bullmq';

import { QUEUE_NAME, queueConnection, type JobPayloads } from '@/lib/queue';

import { deliverChatCode } from './jobs/deliver-chat-code';
import { importEntities } from './jobs/import-entities';
import { buildPipelineReport } from './jobs/pipeline-report';

/**
 * Background worker.
 *
 * Bulk import and reporting are the CPU- and memory-heavy parts of the product,
 * so they run here rather than in a request handler.
 */
export function createWorker(): Worker {
  const worker = new Worker(
    QUEUE_NAME,
    async (job: Job) => {
      switch (job.name) {
        case 'import-entities':
          return importEntities(job.data as JobPayloads['import-entities'], (percent) =>
            job.updateProgress(percent),
          );
        case 'pipeline-report':
          return buildPipelineReport(job.data as JobPayloads['pipeline-report']);
        case 'chat-auth-code':
          return deliverChatCode(job.data as JobPayloads['chat-auth-code']);
        default:
          throw new Error(`Unknown job: ${job.name}`);
      }
    },
    { connection: queueConnection, concurrency: 4 },
  );

  worker.on('failed', (job, error) => {
    console.error(`[worker] job ${job?.id} (${job?.name}) failed:`, error.message);
  });

  return worker;
}

// Start only when run as a process, not when imported by tests.
if (process.argv[1] && process.argv[1].includes('worker')) {
  const worker = createWorker();
  console.log(`[worker] listening on queue "${QUEUE_NAME}"`);

  const shutdown = async () => {
    await worker.close();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
