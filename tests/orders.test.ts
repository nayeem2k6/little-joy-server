import { describe, expect, it } from "vitest";
import { assertCancellableOrderStatus } from "../src/services/orders";

describe("order cancellation policy", () => {
  it.each(["pending", "confirmed", "processing"])("allows cancelling a %s order", (status) => {
    expect(() => assertCancellableOrderStatus(status)).not.toThrow();
  });

  it.each(["shipped", "delivered"])("prevents cancelling a %s order", (status) => {
    expect(() => assertCancellableOrderStatus(status)).toThrowError(/Only pending/);
  });
});
