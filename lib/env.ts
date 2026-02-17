import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().optional(),
  NEXTAUTH_URL: z.string().optional(),
  NEXTAUTH_SECRET: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  ALLOWED_GOOGLE_DOMAINS: z.string().default("graphiclux.com"),
  REDIS_URL: z.string().default("redis://127.0.0.1:6379"),
  MASTER_KEY: z.string().optional(),
  APP_ENCRYPTION_AAD: z.string().default("client-ops-hub"),
  TRELLO_CLIENT_ID: z.string().optional(),
  TRELLO_CLIENT_SECRET: z.string().optional(),
  TRELLO_REDIRECT_URI: z.string().optional(),
  TRELLO_API_KEY: z.string().optional(),
  XERO_CLIENT_ID: z.string().optional(),
  XERO_CLIENT_SECRET: z.string().optional(),
  XERO_REDIRECT_URI: z.string().optional(),
  MANAGER_RESTRICT_TO_ASSIGNED_CLIENTS: z
    .string()
    .optional()
    .transform((value) => value === "1" || value?.toLowerCase() === "true"),
  TWO_FACTOR_REMEMBER_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  FILE_STORAGE_PATH: z.string().default("/data/uploads")
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(parsed.error.flatten().fieldErrors);
  throw new Error("Unable to parse environment variables");
}

export const env = parsed.data;

export function requireEnv<K extends keyof typeof env>(key: K): Exclude<(typeof env)[K], undefined> {
  const value = env[key];
  if (!value || (typeof value === "string" && value.trim().length === 0)) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value as Exclude<(typeof env)[K], undefined>;
}

export const allowedGoogleDomains = env.ALLOWED_GOOGLE_DOMAINS.split(",")
  .map((item) => item.trim().toLowerCase())
  .filter(Boolean);
