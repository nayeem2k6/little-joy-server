import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const optionalValue = z.preprocess((value) => value === "" ? undefined : value, z.string().min(1).optional());
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: optionalValue,
  JWT_SECRET: z.preprocess((value) => value === "" ? undefined : value, z.string().min(32).optional()),
  GOOGLE_CLIENT_ID: optionalValue,
  JWT_EXPIRES_IN: z.string().default("7d"),
  COOKIE_NAME: z.string().default("littlejoy_token"),
  COOKIE_SECURE: z.enum(["true", "false"]).optional().transform((value) => value === undefined ? undefined : value === "true"),
  COOKIE_SAME_SITE: z.enum(["lax", "strict", "none"]).optional(),
  CORS_ORIGINS: z.string().optional(),
  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().positive().default(900000),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
  DELIVERY_FEE: z.coerce.number().finite().min(0).default(0),
  FREE_DELIVERY_THRESHOLD: z.coerce.number().finite().min(0).optional()
});

export function parseEnvironment(source: NodeJS.ProcessEnv = process.env) {
  const parsed = schema.parse(source);
  return {
    ...parsed,
    COOKIE_SECURE: parsed.COOKIE_SECURE ?? parsed.NODE_ENV === "production",
    COOKIE_SAME_SITE: parsed.COOKIE_SAME_SITE ?? "lax",
    CORS_ORIGINS: parsed.CORS_ORIGINS ?? (parsed.NODE_ENV === "production" ? "" : "http://localhost:3000")
  };
}

export const env = parseEnvironment();
export const corsOrigins = env.CORS_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean);

export function assertProductionSecrets(configuration = env): void {
  if (configuration.NODE_ENV === "production") {
    if (!configuration.MONGODB_URI) throw new Error("MONGODB_URI must be explicitly configured in production");
    if (!configuration.JWT_SECRET) throw new Error("JWT_SECRET must be explicitly configured in production");
    if (!configuration.GOOGLE_CLIENT_ID) throw new Error("GOOGLE_CLIENT_ID must be explicitly configured in production");
    if (!configuration.CORS_ORIGINS.trim()) throw new Error("CORS_ORIGINS must be explicitly configured in production");
    if (!configuration.COOKIE_SECURE) throw new Error("COOKIE_SECURE must be true in production");
  }
  if (configuration.COOKIE_SAME_SITE === "none" && !configuration.COOKIE_SECURE) {
    throw new Error("COOKIE_SECURE must be true when COOKIE_SAME_SITE=none");
  }
}

export function getJwtSecret(): string {
  if (!env.JWT_SECRET) throw new Error("JWT_SECRET must be configured before using authentication");
  return env.JWT_SECRET;
}
