import 'dotenv/config';

import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  // `prisma migrate` connects directly; the app connects through the driver
  // adapter configured in src/lib/prisma.ts.
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
});
