import { describe, expect, it } from "vitest";
import { assertProductionSecrets, parseEnvironment } from "../src/config/env";

describe("environment configuration", () => {
  it("uses secure cookie defaults in production", () => {
    const configuration = parseEnvironment({
      NODE_ENV: "production",
      MONGODB_URI: "mongodb://localhost/littlejoy",
      JWT_SECRET: "x".repeat(32),
      GOOGLE_CLIENT_ID: "google-client-id",
      CORS_ORIGINS: "https://little-joy-seven.vercel.app"
    });

    expect(configuration.COOKIE_SECURE).toBe(true);
    expect(configuration.COOKIE_SAME_SITE).toBe("lax");
    expect(() => assertProductionSecrets(configuration)).not.toThrow();
  });

  it("requires deployment credentials and CORS origins explicitly", () => {
    const configuration = parseEnvironment({ NODE_ENV: "production" });

    expect(configuration.MONGODB_URI).toBeUndefined();
    expect(configuration.JWT_SECRET).toBeUndefined();
    expect(() => assertProductionSecrets(configuration)).toThrow("MONGODB_URI must be explicitly configured");
  });

  it("rejects insecure cookies when production cookies are required", () => {
    const configuration = parseEnvironment({
      NODE_ENV: "production",
      MONGODB_URI: "mongodb://localhost/littlejoy",
      JWT_SECRET: "x".repeat(32),
      GOOGLE_CLIENT_ID: "google-client-id",
      CORS_ORIGINS: "https://little-joy-seven.vercel.app",
      COOKIE_SECURE: "false",
      COOKIE_SAME_SITE: "lax"
    });

    expect(() => assertProductionSecrets(configuration)).toThrow("COOKIE_SECURE must be true in production");
  });

  it("treats missing CORS configuration as unset rather than crashing", () => {
    const configuration = parseEnvironment({
      NODE_ENV: "production",
      MONGODB_URI: "mongodb://localhost/littlejoy",
      JWT_SECRET: "x".repeat(32),
      GOOGLE_CLIENT_ID: "google-client-id",
      CORS_ORIGINS: undefined
    });

    expect(configuration.CORS_ORIGINS).toBe("");
    expect(() => assertProductionSecrets(configuration)).toThrow("CORS_ORIGINS must be explicitly configured in production");
  });

  it("uses local cookie and CORS defaults outside production", () => {
    const configuration = parseEnvironment({ NODE_ENV: "development" });

    expect(configuration.COOKIE_SECURE).toBe(false);
    expect(configuration.COOKIE_SAME_SITE).toBe("lax");
    expect(configuration.CORS_ORIGINS).toBe("http://localhost:3000");
  });
});
