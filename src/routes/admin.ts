import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { Category } from "../models/Category";
import { Order } from "../models/Order";
import { Product } from "../models/Product";
import { Coupon } from "../models/Coupon";
import { Review } from "../models/Review";
import { User } from "../models/User";
import { assertCancellableOrderStatus } from "../services/orders";
import { normalizeProductImages, slugifyProductName } from "../services/products";
import { AppError } from "../utils/errors";
import { sendSuccess } from "../utils/http";

const router = Router();
const categoryInput = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().min(2).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().trim().max(500).optional().default(""),
  imageUrl: z.string().trim().max(2000).optional().default("")
});
const productFields = z.object({
  name: z.string().trim().min(2).max(160),
  slug: z.string().trim().toLowerCase().min(2).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  description: z.string().trim().min(1).max(5000),
  price: z.number().finite().min(0),
  compareAtPrice: z.number().finite().min(0).nullable().optional(),
  stock: z.number().int().min(0).optional(),
  stockQuantity: z.number().int().min(0).optional(),
  category: z.string().regex(/^[a-f\d]{24}$/i),
  imageUrl: z.string().trim().max(2000).optional().default(""),
  images: z.array(z.string().trim().url().max(2000)).max(20).optional(),
  ageRecommendation: z.string().trim().max(100).optional().default(""),
  safetyInformation: z.string().trim().max(2000).optional().default(""),
  active: z.boolean().optional().default(true)
});
const productInput = productFields.extend({
  stock: z.number().int().min(0).optional(),
  stockQuantity: z.number().int().min(0).optional()
}).refine((value) => value.stock !== undefined || value.stockQuantity !== undefined, {
  message: "stock or stockQuantity is required",
  path: ["stock"]
}).refine((value) => value.stock === undefined || value.stockQuantity === undefined || value.stock === value.stockQuantity, {
  message: "stock and stockQuantity must match when both are supplied",
  path: ["stockQuantity"]
}).refine((value) => value.compareAtPrice == null || value.compareAtPrice >= value.price, {
  message: "compareAtPrice must be greater than or equal to price",
  path: ["compareAtPrice"]
}).transform((value) => {
  const stock = value.stock ?? value.stockQuantity!;
  return normalizeProductImages({
    ...value,
    slug: value.slug ?? slugifyProductName(value.name),
    stock,
    stockQuantity: stock,
    compareAtPrice: value.compareAtPrice ?? null
  });
});
const productPatchFields = productFields.partial();
const productPatch = productPatchFields.refine((value) => Object.keys(value).length > 0)
  .refine((value) => value.stock === undefined || value.stockQuantity === undefined || value.stock === value.stockQuantity, {
    message: "stock and stockQuantity must match when both are supplied",
    path: ["stockQuantity"]
  });
const categoryPatch = categoryInput.partial().refine((value) => Object.keys(value).length > 0);
const categoryCreate = categoryInput;
const categoryUpdate = categoryInput.partial().refine((value) => Object.keys(value).length > 0);
const statusInput = z.object({ status: z.enum(["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"]) });
const couponFields = z.object({
  code: z.string().trim().toUpperCase().min(3).max(40).regex(/^[A-Z0-9_-]+$/),
  discountType: z.enum(["percentage", "fixed"]),
  discountValue: z.number().finite().positive(),
  minSubtotal: z.number().finite().min(0).optional().default(0),
  maxDiscount: z.number().finite().positive().nullable().optional().default(null),
  startsAt: z.string().datetime().nullable().optional().transform((value) => value ? new Date(value) : null),
  expiresAt: z.string().datetime().nullable().optional().transform((value) => value ? new Date(value) : null),
  usageLimit: z.number().int().positive().nullable().optional().default(null),
  perUserLimit: z.number().int().positive().nullable().optional().default(null),
  active: z.boolean().optional().default(true)
});
const couponInput = couponFields.refine((value) => value.discountType !== "percentage" || value.discountValue <= 100, {
  message: "Percentage coupon value cannot exceed 100",
  path: ["discountValue"]
}).refine((value) => !value.startsAt || !value.expiresAt || value.expiresAt > value.startsAt, {
  message: "Coupon expiration must be later than its start",
  path: ["expiresAt"]
});
const couponPatch = couponFields.partial().refine((value) => Object.keys(value).length > 0);
const reviewStatusInput = z.object({ status: z.enum(["approved", "rejected"]) });
const reviewQuery = z.object({
  status: z.enum(["pending", "approved", "rejected"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});
const customerQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

router.use(requireAuth, requireRole("admin"));

router.get("/customers", validate(customerQuery, "query"), asyncHandler(async (req, res) => {
  const { page, limit } = (req as typeof req & { validated: z.infer<typeof customerQuery> }).validated;
  const [customers, total] = await Promise.all([
    User.find({ role: "customer" }).select("_id name email phone createdAt").sort({ createdAt: -1 })
      .skip((page - 1) * limit).limit(limit).lean(),
    User.countDocuments({ role: "customer" })
  ]);
  const customerIds = customers.map((customer) => customer._id);
  const orderCounts = customerIds.length
    ? await Order.aggregate([
      { $match: { user: { $in: customerIds } } },
      { $group: { _id: "$user", count: { $sum: 1 } } }
    ])
    : [];
  const countsByUser = new Map<string, number>(
    orderCounts.map((entry: { _id: mongoose.Types.ObjectId; count: number }) => [entry._id.toString(), entry.count])
  );
  const items = customers.map((customer) => ({
    id: customer._id.toString(),
    name: customer.name,
    email: customer.email,
    ...(customer.phone ? { phone: customer.phone } : {}),
    createdAt: customer.createdAt,
    orderCount: countsByUser.get(customer._id.toString()) ?? 0
  }));
  sendSuccess(res, { items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}));

router.get("/dashboard", asyncHandler(async (_req, res) => {
  const [products, categories, orders, customers, revenue] = await Promise.all([
    Product.countDocuments(), Category.countDocuments(), Order.countDocuments(),
    (await import("../models/User")).User.countDocuments({ role: "customer" }),
    Order.aggregate([{ $match: { status: { $ne: "cancelled" } } }, { $group: { _id: null, total: { $sum: "$total" } } }])
  ]);
  const recentOrders = await Order.find().populate("user", "name email phone")
    .sort({ createdAt: -1 }).limit(5).lean();
  const recentWithCustomer = recentOrders.map((order) => ({ ...order, customer: order.user }));
  sendSuccess(res, {
    counts: { products, categories, orders, customers },
    products, categories, orders, customers,
    revenue: revenue[0]?.total ?? 0,
    recentOrders: recentWithCustomer
  });
}));

router.get("/products", asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const [items, total] = await Promise.all([
    Product.find().populate("category", "name slug").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Product.countDocuments()
  ]);
  sendSuccess(res, { items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}));

router.post("/products", validate(productInput), asyncHandler(async (req, res) => {
  const product = await Product.create(req.body);
  sendSuccess(res, { product }, 201);
}));

router.patch("/products/:id", validate(productPatch), asyncHandler(async (req, res) => {
  const current = await Product.findById(req.params.id);
  if (!current) throw new AppError(404, "PRODUCT_NOT_FOUND", "Product not found");
  const update: Record<string, unknown> = { ...req.body };
  if (update.stock !== undefined || update.stockQuantity !== undefined) {
    const stock = update.stock ?? update.stockQuantity;
    update.stock = stock;
    update.stockQuantity = stock;
  }
  if (update.images !== undefined || update.imageUrl !== undefined) {
    Object.assign(update, normalizeProductImages(update));
  }
  const price = (update.price as number | undefined) ?? current.price;
  const compareAtPrice = update.compareAtPrice === undefined ? current.compareAtPrice : update.compareAtPrice;
  if (compareAtPrice != null && Number(compareAtPrice) < price) {
    throw new AppError(400, "VALIDATION_ERROR", "compareAtPrice must be greater than or equal to price");
  }
  const product = await Product.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
  if (!product) throw new AppError(404, "PRODUCT_NOT_FOUND", "Product not found");
  sendSuccess(res, { product });
}));

router.delete("/products/:id", asyncHandler(async (req, res) => {
  const product = await Product.findByIdAndUpdate(req.params.id, { active: false }, { new: true });
  if (!product) throw new AppError(404, "PRODUCT_NOT_FOUND", "Product not found");
  sendSuccess(res, { product });
}));

router.get("/categories", asyncHandler(async (_req, res) => {
  sendSuccess(res, { items: await Category.find().sort({ name: 1 }).lean() });
}));

router.post("/categories", validate(categoryCreate), asyncHandler(async (req, res) => {
  const category = await Category.create(req.body);
  sendSuccess(res, { category }, 201);
}));

router.patch("/categories/:id", validate(categoryUpdate), asyncHandler(async (req, res) => {
  const category = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!category) throw new AppError(404, "CATEGORY_NOT_FOUND", "Category not found");
  sendSuccess(res, { category });
}));

router.delete("/categories/:id", asyncHandler(async (req, res) => {
  const category = await Category.findByIdAndUpdate(req.params.id, { active: false }, { new: true });
  if (!category) throw new AppError(404, "CATEGORY_NOT_FOUND", "Category not found");
  sendSuccess(res, { category });
}));

router.get("/orders", asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const [items, total] = await Promise.all([
    Order.find().populate("user", "name email phone").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Order.countDocuments()
  ]);
  sendSuccess(res, { items: items.map((order) => ({ ...order, customer: order.user })), pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}));

router.patch("/orders/:id/status", validate(statusInput), asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  let result: unknown;
  try {
    await session.withTransaction(async () => {
      const order = await Order.findById(req.params.id).session(session);
      if (!order) throw new AppError(404, "ORDER_NOT_FOUND", "Order not found");
      const nextStatus = req.body.status as string;
      if (order.status === "cancelled") {
        if (nextStatus !== "cancelled") {
          throw new AppError(409, "ORDER_ALREADY_CANCELLED", "A cancelled order cannot be reopened");
        }
        result = order;
        return;
      }
      if (nextStatus === "cancelled") {
        assertCancellableOrderStatus(order.status);
        const updated = await Order.findOneAndUpdate(
          { _id: order._id, status: order.status },
          { status: "cancelled" },
          { new: true, runValidators: true, session }
        );
        if (!updated) throw new AppError(409, "ORDER_STATUS_CONFLICT", "Order status changed; reload and try again");
        for (const item of order.items) {
          await Product.updateOne(
            { _id: item.product },
            [{ $set: {
              stock: { $add: [{ $ifNull: ["$stock", 0] }, item.quantity] },
              stockQuantity: { $add: [{ $ifNull: ["$stock", 0] }, item.quantity] }
            } }],
            { session }
          );
        }
        if (order.coupon?.couponId) {
          await Coupon.updateOne(
            { _id: order.coupon.couponId, usedCount: { $gt: 0 } },
            { $inc: { usedCount: -1 } },
            { session }
          );
        }
        result = updated;
        return;
      }
      const updated = await Order.findOneAndUpdate(
        { _id: order._id, status: order.status },
        { status: nextStatus },
        { new: true, runValidators: true, session }
      );
      if (!updated) throw new AppError(409, "ORDER_STATUS_CONFLICT", "Order status changed; reload and try again");
      result = updated;
    });
  } finally {
    await session.endSession();
  }
  sendSuccess(res, { order: result });
}));

router.get("/coupons", asyncHandler(async (_req, res) => {
  sendSuccess(res, { items: await Coupon.find().sort({ createdAt: -1 }).lean() });
}));

router.post("/coupons", validate(couponInput), asyncHandler(async (req, res) => {
  const coupon = await Coupon.create(req.body);
  sendSuccess(res, { coupon }, 201);
}));

router.patch("/coupons/:id", validate(couponPatch), asyncHandler(async (req, res) => {
  const current = await Coupon.findById(req.params.id);
  if (!current) throw new AppError(404, "COUPON_NOT_FOUND", "Coupon not found");
  const merged = { ...current.toObject(), ...req.body };
  if (merged.discountType === "percentage" && merged.discountValue > 100) {
    throw new AppError(400, "VALIDATION_ERROR", "Percentage coupon value cannot exceed 100");
  }
  if (merged.startsAt && merged.expiresAt && merged.expiresAt <= merged.startsAt) {
    throw new AppError(400, "VALIDATION_ERROR", "Coupon expiration must be later than its start");
  }
  const coupon = await Coupon.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  sendSuccess(res, { coupon });
}));

router.delete("/coupons/:id", asyncHandler(async (req, res) => {
  const coupon = await Coupon.findByIdAndUpdate(req.params.id, { active: false }, { new: true });
  if (!coupon) throw new AppError(404, "COUPON_NOT_FOUND", "Coupon not found");
  sendSuccess(res, { coupon });
}));

router.get("/reviews", validate(reviewQuery, "query"), asyncHandler(async (req, res) => {
  const { status, page, limit } = (req as typeof req & { validated: z.infer<typeof reviewQuery> }).validated;
  const filter = status ? { status } : {};
  const [items, total] = await Promise.all([
    Review.find(filter).populate("user", "name email").populate("product", "name").sort({ createdAt: -1 })
      .skip((page - 1) * limit).limit(limit).lean(),
    Review.countDocuments(filter)
  ]);
  sendSuccess(res, { items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}));

router.patch("/reviews/:id/status", validate(reviewStatusInput), asyncHandler(async (req, res) => {
  const review = await Review.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true, runValidators: true });
  if (!review) throw new AppError(404, "REVIEW_NOT_FOUND", "Review not found");
  sendSuccess(res, { review });
}));

export default router;
