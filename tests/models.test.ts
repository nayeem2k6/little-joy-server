import { describe, expect, it } from "vitest";
import { Order } from "../src/models/Order";
import { Product } from "../src/models/Product";

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
    for (const field of ["compareAtPrice", "stock", "stockQuantity", "images", "ageRecommendation", "safetyInformation"]) {
      expect(Product.schema.path(field)).toBeTruthy();
    }
  });
});
