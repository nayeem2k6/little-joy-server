import { describe, expect, it } from "vitest";
import { Order } from "../src/models/Order";
import { Product } from "../src/models/Product";
import { User } from "../src/models/User";

describe("storefront model contract", () => {
  it("generates unique order numbers with a storefront prefix", () => {
    const generate = Order.schema.path("orderNumber").options.default as () => string;
    const first = generate();
    const second = generate();
    expect(first).toMatch(/^LJ-[A-Z0-9]+-[A-F0-9]{8}$/);
    expect(second).not.toBe(first);
  });

  it("requires a unique product slug and exposes storefront fields", () => {
    expect(Product.schema.path("slug").options.unique).toBe(true);
    for (const field of ["compareAtPrice", "stock", "stockQuantity", "images", "featured", "ageRecommendation", "safetyInformation"]) {
      expect(Product.schema.path(field)).toBeTruthy();
    }
    expect(new Product().featured).toBe(false);
  });

  it("supports Google-only users without a local password", async () => {
    const user = new User({ name: "Google User", email: "google@example.com", googleId: "google-subject", role: "customer" });

    expect(User.schema.path("googleId").options.unique).toBe(true);
    expect(User.schema.path("googleId").options.sparse).toBe(true);
    expect(await user.comparePassword("not-a-password")).toBe(false);
  });
});
