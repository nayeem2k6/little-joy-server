import { describe, expect, it } from "vitest";
import { calculateCouponDiscount } from "../src/services/coupons";

const coupon = {
  active: true,
  discountType: "percentage" as const,
  discountValue: 15,
  minSubtotal: 20,
  maxDiscount: 10,
  startsAt: null,
  expiresAt: null,
  usageLimit: 4,
  usedCount: 1
};

describe("coupon discount calculation", () => {
  it("calculates from server subtotal and applies the maximum discount", () => {
    expect(calculateCouponDiscount(coupon, 100)).toBe(10);
  });

  it("does not discount more than the order subtotal", () => {
    expect(calculateCouponDiscount({ ...coupon, discountType: "fixed", discountValue: 50, maxDiscount: null }, 25)).toBe(25);
  });

  it("rejects a subtotal below the minimum", () => {
    expect(() => calculateCouponDiscount(coupon, 19.99)).toThrowError(/subtotal/i);
  });

  it("rejects expired or exhausted coupons", () => {
    expect(() => calculateCouponDiscount({ ...coupon, expiresAt: new Date("2025-01-01T00:00:00Z") }, 100))
      .toThrowError(/expired/i);
    expect(() => calculateCouponDiscount({ ...coupon, usageLimit: 1 }, 100))
      .toThrowError(/usage limit/i);
  });

  it("rejects invalid percentage discounts", () => {
    expect(() => calculateCouponDiscount({ ...coupon, discountValue: 101 }, 100))
      .toThrowError(/terms are invalid/i);
  });

  it("rejects negative maximum discount caps", () => {
    expect(() => calculateCouponDiscount({ ...coupon, maxDiscount: -5 }, 100))
      .toThrowError(/terms are invalid/i);
  });
});
