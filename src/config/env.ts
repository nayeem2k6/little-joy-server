import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string().min(1).default("mongodb+srv://toy:CpL4f33RbMiuOg7c@cluster0.7cujx3q.mongodb.net/toy?retryWrites=true&w=majority"),
  JWT_SECRET: z.string().min(32).default("development-only-secret-change-this-before-deployment"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  COOKIE_NAME: z.string().default("littlejoy_token"),
  COOKIE_SECURE: z.string().default("false").transform((value) => value === "true"),
  COOKIE_SAME_SITE: z.enum(["lax", "strict", "none"]).default("lax"),
  CORS_ORIGINS: z.string().default("https://little-joy-seven.vercel.app,https://little-joy-server.onrender.com"),
  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().positive().default(900000),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
  DELIVERY_FEE: z.coerce.number().finite().min(0).default(0),
  FREE_DELIVERY_THRESHOLD: z.coerce.number().finite().min(0).optional()
});

export const env = schema.parse(process.env);
export const corsOrigins = env.CORS_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean);

export function assertProductionSecrets(): void {
  if (env.COOKIE_SAME_SITE === "none" && !env.COOKIE_SECURE) {
    throw new Error("COOKIE_SECURE must be true when COOKIE_SAME_SITE=none");
  }
  if (env.NODE_ENV === "production" && env.JWT_SECRET === "development-only-secret-change-this-before-deployment") {
    throw new Error("JWT_SECRET must be explicitly configured in production");
  }
}
