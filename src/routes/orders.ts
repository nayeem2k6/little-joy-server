import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { Order } from "../models/Order";
import { Product } from "../models/Product";
import { Coupon } from "../models/Coupon";
import { calculateCouponDiscount } from "../services/coupons";
import { calculateDeliveryFee } from "../services/delivery";
import { AppError } from "../utils/errors";
import { sendSuccess } from "../utils/http";

const router = Router();
const checkoutSchema = z.object({
  items: z.array(z.object({
    productId: z.string().regex(/^[a-f\d]{24}$/i),
    quantity: z.number().int().min(1).max(99)
  })).min(1).max(50),
  couponCode: z.string().trim().min(3).max(40).transform((value) => value.toUpperCase()).optional(),
  shippingAddress: z.object({
    fullName: z.string().trim().min(2).max(100),
    phone: z.string().trim().min(5).max(30),
    addressLine1: z.string().trim().min(3).max(200),
    addressLine2: z.string().trim().max(200).optional().default(""),
    city: z.string().trim().min(2).max(100),
    postalCode: z.string().trim().min(2).max(20),
    country: z.string().trim().min(2).max(100)
  })
});

router.post("/", requireAuth, validate(checkoutSchema), asyncHandler(async (req, res) => {
  const { items, shippingAddress, couponCode } = req.body as z.infer<typeof checkoutSchema>;
  const quantities = new Map<string, number>();
  for (const item of items) quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
  const session = await mongoose.startSession();
  let createdOrder: unknown;
  try {
    await session.withTransaction(async () => {
      const orderItems: Array<{ product: mongoose.Types.ObjectId; name: string; quantity: number; unitPrice: number; imageUrl: string }> = [];
      let subtotal = 0;
      for (const [productId, quantity] of quantities) {
        const product = await Product.findOne({ _id: productId, active: true }).session(session);
        if (!product) throw new AppError(404, "PRODUCT_NOT_FOUND", "One or more products are unavailable");
        const stockResult = await Product.updateOne(
          { _id: product._id, active: true, stock: { $gte: quantity } },
          [{ $set: { stock: { $subtract: ["$stock", quantity] }, stockQuantity: { $subtract: ["$stock", quantity] } } }],
          { session }
        );
        if (stockResult.modifiedCount !== 1) throw new AppError(409, "INSUFFICIENT_STOCK", `Insufficient stock for ${product.name}`);
        subtotal += product.price * quantity;
        orderItems.push({ product: product._id, name: product.name, quantity, unitPrice: product.price, imageUrl: product.images[0] ?? product.imageUrl });
      }
      subtotal = Math.round((subtotal + Number.EPSILON) * 100) / 100;
      const deliveryFee = calculateDeliveryFee(subtotal);
      let discount = 0;
      let couponSnapshot: { couponId: mongoose.Types.ObjectId; code: string; discount: number } | undefined;
      if (couponCode) {
        const coupon = await Coupon.findOne({ code: couponCode }).session(session);
        if (!coupon) throw new AppError(400, "COUPON_INVALID", "Coupon is not available");
        const now = new Date();
        discount = calculateCouponDiscount(coupon, subtotal, now);
        if (coupon.perUserLimit != null) {
          const priorUses = await Order.countDocuments({
            user: req.user!.id,
            "coupon.couponId": coupon._id,
            status: { $ne: "cancelled" }
          }).session(session);
          if (priorUses >= coupon.perUserLimit) {
            throw new AppError(400, "COUPON_USER_LIMIT_REACHED", "You have already used this coupon the maximum number of times");
          }
        }
        const couponFilter: Record<string, unknown> = {
          _id: coupon._id,
          active: true,
          $or: [{ startsAt: null }, { startsAt: { $exists: false } }, { startsAt: { $lte: now } }]
        };
        if (coupon.expiresAt) couponFilter.expiresAt = { $gt: now };
        if (coupon.usageLimit != null) couponFilter.usedCount = { $lt: coupon.usageLimit };
        const couponUpdate = await Coupon.updateOne(couponFilter, { $inc: { usedCount: 1 } }, { session });
        if (couponUpdate.modifiedCount !== 1) {
          throw new AppError(409, "COUPON_UNAVAILABLE", "Coupon is no longer available");
        }
        couponSnapshot = { couponId: coupon._id, code: coupon.code, discount };
      }
      const [order] = await Order.create([{
        user: req.user!.id,
        items: orderItems,
        shippingAddress,
        customerPhone: req.user!.phone ?? shippingAddress.phone,
        subtotal,
        deliveryFee,
        ...(couponSnapshot ? { coupon: couponSnapshot } : {}),
        total: Math.max(0, Math.round((subtotal - discount + deliveryFee + Number.EPSILON) * 100) / 100),
        paymentMethod: "COD"
      }], { session });
      createdOrder = order;
    });
  } finally {
    await session.endSession();
  }
  sendSuccess(res, { order: createdOrder }, 201);
}));

router.get("/my-orders", requireAuth, asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.user!.id }).sort({ createdAt: -1 }).lean();
  sendSuccess(res, { items: orders });
}));

router.get("/:id", requireAuth, asyncHandler(async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, user: req.user!.id }).lean();
  if (!order) throw new AppError(404, "ORDER_NOT_FOUND", "Order not found");
  sendSuccess(res, { order });
}));

export default router;
