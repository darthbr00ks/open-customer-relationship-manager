/** Reads an environment variable that the process cannot run without. */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const REDIS_URL = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';
