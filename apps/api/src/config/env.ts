import { z } from 'zod';

/**
 * Configuration is validated once at boot. A missing or blank secret must stop the
 * process, never silently start a degraded server.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().url(),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  /** Comma-separated browser origins allowed to send credentialed requests. */
  WEB_ORIGIN: z.string().default('http://localhost:3000'),
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),

  /** EasyOrders. Absent means the integration is simply unavailable, not broken. */
  EASY_ORDER_KEY: z.string().min(1).optional(),
  EASY_ORDER_BASE_URL: z
    .string()
    .url()
    .default('https://api.easy-orders.net/api/v1/external-apps'),
  /** Shared secret EasyOrders sends in the `secret` header on every webhook. */
  EASY_ORDER_WEBHOOK_SECRET: z.string().min(1).optional(),
});

export type Env = Omit<z.infer<typeof envSchema>, 'WEB_ORIGIN'> & {
  WEB_ORIGIN: string[];
};

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((i) => `  ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }
  return {
    ...parsed.data,
    WEB_ORIGIN: parsed.data.WEB_ORIGIN.split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  };
}

export const ENV = Symbol('ENV');
