import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../src/app";

describe("LittleJoy API", () => {
  it("returns a consistent health response", async () => {
    const response = await request(app).get("/health").expect(200);
    expect(response.body).toEqual({ success: true, data: { status: "ok" } });
  });

  it("validates public registration input before accessing the database", async () => {
    const response = await request(app).post("/api/auth/register").send({
      name: "X", email: "not-an-email", password: "short"
    }).expect(400);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Request validation failed" }
    });
  });

  it("protects customer and admin endpoints when no auth cookie is present", async () => {
    const customer = await request(app).get("/api/auth/me").expect(401);
    const orders = await request(app).get("/api/orders/my-orders").expect(401);
    const admin = await request(app).get("/api/admin/dashboard").expect(401);
    const customers = await request(app).get("/api/admin/customers").expect(401);
    const couponAdmin = await request(app).get("/api/admin/coupons").expect(401);
    const reviewAdmin = await request(app).get("/api/admin/reviews").expect(401);
    expect(customer.body.error.code).toBe("UNAUTHENTICATED");
    expect(orders.body.error.code).toBe("UNAUTHENTICATED");
    expect(admin.body.error.code).toBe("UNAUTHENTICATED");
    expect(customers.body.error.code).toBe("UNAUTHENTICATED");
    expect(couponAdmin.body.error.code).toBe("UNAUTHENTICATED");
    expect(reviewAdmin.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("requires authentication to submit verified-purchase reviews", async () => {
    const response = await request(app)
      .post("/api/products/0123456789abcdef01234567/reviews")
      .send({ rating: 5, comment: "Wonderful toy!" })
      .expect(401);
    expect(response.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("returns a consistent JSON error for unknown routes", async () => {
    const response = await request(app).get("/api/not-a-route").expect(404);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: "NOT_FOUND", message: "Route not found" }
    });
  });

  it("validates catalog price range filters", async () => {
    const response = await request(app).get("/api/products?minPrice=50&maxPrice=10").expect(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns a consistent client error for malformed JSON", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send("{invalid")
      .expect(400);
    expect(response.body.error.code).toBe("INVALID_JSON");
  });

  it("rejects origins outside the configured CORS allowlist", async () => {
    const response = await request(app)
      .get("/health")
      .set("Origin", "https://untrusted.example")
      .expect(403);
    expect(response.body.error.code).toBe("CORS_ORIGIN_DENIED");
  });
});
