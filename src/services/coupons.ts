import { AppError } from "../utils/errors";

export interface CouponTerms {
  discountType: "percentage" | "fixed";
  discountValue: number;
  minSubtotal: number;
  maxDiscount?: number | null;
  startsAt?: Date | null;
  expiresAt?: Date | null;
  usageLimit?: number | null;
  usedCount: number;
  active: boolean;
}

export function calculateCouponDiscount(coupon: CouponTerms, subtotal: number, now = new Date()): number {
  if (!coupon.active) throw new AppError(400, "COUPON_INVALID", "Coupon is not available");
  if (coupon.startsAt && coupon.startsAt > now) throw new AppError(400, "COUPON_NOT_STARTED", "Coupon is not available yet");
  if (coupon.expiresAt && coupon.expiresAt <= now) throw new AppError(400, "COUPON_EXPIRED", "Coupon has expired");
  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
    throw new AppError(400, "COUPON_EXHAUSTED", "Coupon usage limit has been reached");
  }
  if (subtotal < coupon.minSubtotal) throw new AppError(400, "COUPON_MINIMUM_NOT_MET", "Order subtotal does not meet the coupon minimum");
  if (coupon.discountValue <= 0 || (coupon.discountType === "percentage" && coupon.discountValue > 100)) {
    throw new AppError(400, "COUPON_INVALID", "Coupon terms are invalid");
  }
  if (coupon.maxDiscount != null && coupon.maxDiscount <= 0) {
    throw new AppError(400, "COUPON_INVALID", "Coupon terms are invalid");
  }
  let discount = coupon.discountType === "percentage"
    ? subtotal * coupon.discountValue / 100
    : coupon.discountValue;
  if (coupon.maxDiscount != null) discount = Math.min(discount, coupon.maxDiscount);
  return Math.min(subtotal, Math.round((discount + Number.EPSILON) * 100) / 100);
}
