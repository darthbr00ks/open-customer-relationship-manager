/**
 * Scaffold route files for a new API resource.
 *
 * Usage:
 *   npm run scaffold -- <resource-name> [--no-archive]
 *
 * Examples:
 *   npm run scaffold -- contacts
 *   npm run scaffold -- notes --no-archive
 *
 * After running this script:
 *   1. Add your Zod schemas to src/lib/schemas/resources.ts
 *      (e.g. noteCreateSchema, noteUpdateSchema)
 *   2. Register the resource in src/lib/api/resources.ts
 *      (add an entry to the `resources` map)
 */

import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const resourceName = args.find((a) => !a.startsWith('--'));
const noArchive = args.includes('--no-archive');

if (!resourceName) {
  console.error('Usage: npm run scaffold -- <resource-name> [--no-archive]');
  process.exit(1);
}

if (!/^[a-z][a-z0-9-]*$/.test(resourceName)) {
  console.error('Resource name must be lowercase kebab-case (e.g. "feature-requests").');
  process.exit(1);
}

const BASE = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'src', 'app', 'api', 'v1', resourceName);
const ID_DIR = join(BASE, '[id]');
const ARCHIVE_DIR = join(ID_DIR, 'archive');

function write(path: string, content: string) {
  if (existsSync(path)) {
    console.warn(`  SKIP  ${path} (already exists)`);
    return;
  }
  writeFileSync(path, content, 'utf8');
  console.log(`  CREATE ${path}`);
}

mkdirSync(ID_DIR, { recursive: true });
if (!noArchive) {
  mkdirSync(ARCHIVE_DIR, { recursive: true });
}

/* collection route (/api/v1/<resource>) */
write(
  join(BASE, 'route.ts'),
  `import { collectionHandlers } from '@/lib/api/resource';
import { resources } from '@/lib/api/resources';

export const dynamic = 'force-dynamic';

export const { GET, POST } = collectionHandlers(resources['${resourceName}']);
`,
);

/* item route (/api/v1/<resource>/[id]) */
write(
  join(ID_DIR, 'route.ts'),
  `import { itemHandlers } from '@/lib/api/resource';
import { resources } from '@/lib/api/resources';

export const dynamic = 'force-dynamic';

export const { GET, PATCH, PUT, DELETE } = itemHandlers(resources['${resourceName}']);
`,
);

/* archive sub-route (/api/v1/<resource>/[id]/archive) */
if (!noArchive) {
  write(
    join(ARCHIVE_DIR, 'route.ts'),
    `import { archiveHandler } from '@/lib/api/resource';
import { resources } from '@/lib/api/resources';

export const dynamic = 'force-dynamic';

export const { POST } = archiveHandler(resources['${resourceName}']);
`,
  );
}

console.log(`
Done! Next steps:
  1. Add ${resourceName}CreateSchema and ${resourceName}UpdateSchema to:
       src/lib/schemas/resources.ts
  2. Register '${resourceName}' in:
       src/lib/api/resources.ts
`);
