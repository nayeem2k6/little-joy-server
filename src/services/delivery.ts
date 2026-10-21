import { env } from "../config/env";

export function calculateDeliveryFee(
  subtotal: number,
  fee = env.DELIVERY_FEE,
  freeThreshold = env.FREE_DELIVERY_THRESHOLD
): number {
  if (freeThreshold !== undefined && subtotal >= freeThreshold) return 0;
  return Math.round((fee + Number.EPSILON) * 100) / 100;
}
