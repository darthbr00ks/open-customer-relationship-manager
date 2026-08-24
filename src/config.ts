import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  databaseUrl: required('DATABASE_URL'),
  host: process.env.HOST ?? '0.0.0.0',
  port: Number(process.env.PORT ?? 8000),
  debug: process.env.DEBUG === 'true',
};
