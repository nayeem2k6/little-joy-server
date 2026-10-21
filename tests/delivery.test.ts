import { describe, expect, it } from "vitest";
import { calculateDeliveryFee } from "../src/services/delivery";

describe("COD delivery fee", () => {
  it("uses the configured flat fee until the free-delivery threshold", () => {
    expect(calculateDeliveryFee(49, 5, 50)).toBe(5);
    expect(calculateDeliveryFee(50, 5, 50)).toBe(0);
  });

  it("does not apply a client-controlled or implicit fee", () => {
    expect(calculateDeliveryFee(30, 0, undefined)).toBe(0);
  });
});
