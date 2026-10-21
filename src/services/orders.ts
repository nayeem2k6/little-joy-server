import { AppError } from "../utils/errors";

export function assertCancellableOrderStatus(status: string): void {
  if (!["pending", "confirmed", "processing"].includes(status)) {
    throw new AppError(409, "ORDER_NOT_CANCELLABLE", "Only pending, confirmed, or processing orders can be cancelled");
  }
}
