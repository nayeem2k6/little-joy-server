import { describe, expect, it } from "vitest";
import { normalizeProductImages, productIdentifierFilter, slugifyProductName } from "../src/services/products";

describe("product storefront compatibility helpers", () => {
  it("uses ObjectIds and slugs as product identifiers", () => {
    expect(productIdentifierFilter("0123456789abcdef01234567")).toEqual({ _id: "0123456789abcdef01234567" });
    expect(productIdentifierFilter("Rainbow-Stacker")).toEqual({ slug: "rainbow-stacker" });
  });

  it("generates slugs and keeps legacy imageUrl aligned with images", () => {
    expect(slugifyProductName("  Rainbow Stacker! ")).toBe("rainbow-stacker");
    expect(normalizeProductImages({ images: ["https://example.test/toy.webp"] }))
      .toEqual({ images: ["https://example.test/toy.webp"], imageUrl: "https://example.test/toy.webp" });
    expect(normalizeProductImages({ imageUrl: "https://example.test/legacy.webp" }))
      .toEqual({ imageUrl: "https://example.test/legacy.webp", images: ["https://example.test/legacy.webp"] });
  });
});
