import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../middleware/asyncHandler";
import { validate } from "../middleware/validate";
import { Category } from "../models/Category";
import { Product } from "../models/Product";
import { Review } from "../models/Review";
import { Order } from "../models/Order";
import mongoose from "mongoose";
import { AppError } from "../utils/errors";
import { sendSuccess } from "../utils/http";
import { requireAuth, requireRole } from "../middleware/auth";
import { productIdentifierFilter } from "../services/products";

const router = Router();
const productQuery = z.object({
  search: z.string().trim().max(100).optional(),
  category: z.string().optional(),
  minPrice: z.coerce.number().finite().min(0).optional(),
  maxPrice: z.coerce.number().finite().min(0).optional(),
  sort: z.enum(["newest", "price-asc", "price-desc", "popular"]).default("newest"),
  availability: z.preprocess((value) => {
    if (value === "true") return "in-stock";
    if (value === "false") return "out-of-stock";
    return value;
  }, z.enum(["all", "in-stock", "out-of-stock"]).default("all")),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
}).refine((value) => value.minPrice === undefined || value.maxPrice === undefined || value.minPrice <= value.maxPrice, {
  message: "minPrice must not exceed maxPrice",
  path: ["maxPrice"]
});
const reviewInput = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().min(3).max(2000)
});

router.get("/products/:id/reviews", asyncHandler(async (req, res) => {
  const product = await Product.findOne({ ...productIdentifierFilter(String(req.params.id)), active: true }).select("_id").lean();
  if (!product) throw new AppError(404, "PRODUCT_NOT_FOUND", "Product not found");
  const reviews = await Review.find({ product: product._id, status: "approved" })
    .populate("user", "name").sort({ createdAt: -1 }).lean();
  sendSuccess(res, { items: reviews });
}));

router.post("/products/:id/reviews", requireAuth, requireRole("customer"), validate(reviewInput), asyncHandler(async (req, res) => {
  const product = await Product.findOne(productIdentifierFilter(String(req.params.id))).select("_id").lean();
  if (!product) throw new AppError(404, "PRODUCT_NOT_FOUND", "Product not found");
  const purchased = await Order.exists({
    user: req.user!.id,
    status: "delivered",
    "items.product": product._id
  });
  if (!purchased) throw new AppError(403, "VERIFIED_PURCHASE_REQUIRED", "A delivered purchase is required to review this product");
  const review = await Review.create({
    product: product._id,
    user: req.user!.id,
    rating: req.body.rating,
    comment: req.body.comment
  });
  sendSuccess(res, { review }, 201);
}));

router.get("/products", validate(productQuery, "query"), asyncHandler(async (req, res) => {
  const { search, category, minPrice, maxPrice, sort, availability, page, limit } =
    (req as typeof req & { validated: z.infer<typeof productQuery> }).validated;
  const filter: Record<string, unknown> = { active: true };
  if (search) filter.$text = { $search: search };
  if (minPrice !== undefined || maxPrice !== undefined) {
    filter.price = {
      ...(minPrice !== undefined ? { $gte: minPrice } : {}),
      ...(maxPrice !== undefined ? { $lte: maxPrice } : {})
    };
  }
  if (availability === "in-stock") filter.stock = { $gt: 0 };
  if (availability === "out-of-stock") filter.stock = { $lte: 0 };
  if (category) {
    const categoryFilter = category.match(/^[a-f\d]{24}$/i) ? { _id: category } : { slug: category };
    const foundCategory = await Category.findOne(categoryFilter).select("_id").lean();
    if (!foundCategory) return sendSuccess(res, { items: [], pagination: { page, limit, total: 0, pages: 0 } });
    filter.category = foundCategory._id;
  }
  const total = await Product.countDocuments(filter);
  let items;
  if (sort === "popular") {
    const [matches, sales] = await Promise.all([
      Product.find(filter).select("_id createdAt").lean(),
      Order.aggregate([
        { $match: { status: { $ne: "cancelled" } } },
        { $unwind: "$items" },
        { $group: { _id: "$items.product", quantity: { $sum: "$items.quantity" } } }
      ])
    ]);
    const popularity = new Map<string, number>(sales.map((row: { _id: mongoose.Types.ObjectId; quantity: number }) => [row._id.toString(), row.quantity]));
    const orderedIds = matches.sort((a, b) =>
      (popularity.get(b._id.toString()) ?? 0) - (popularity.get(a._id.toString()) ?? 0)
      || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ).slice((page - 1) * limit, page * limit).map((item) => item._id);
    const fetched = await Product.find({ _id: { $in: orderedIds } }).populate("category", "name slug").lean();
    const byId = new Map(fetched.map((item) => [item._id.toString(), item]));
    items = orderedIds.map((id) => byId.get(id.toString())).filter(Boolean);
  } else {
    const sortOrder: Record<string, 1 | -1> = sort === "price-asc" ? { price: 1, _id: 1 }
      : sort === "price-desc" ? { price: -1, _id: 1 }
        : { createdAt: -1, _id: -1 };
    items = await Product.find(filter).populate("category", "name slug").sort(sortOrder)
      .skip((page - 1) * limit).limit(limit).lean();
  }
  sendSuccess(res, { items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}));

router.get("/products/:id", asyncHandler(async (req, res) => {
  const product = await Product.findOne({ ...productIdentifierFilter(String(req.params.id)), active: true }).populate("category", "name slug").lean();
  if (!product) throw new AppError(404, "PRODUCT_NOT_FOUND", "Product not found");
  sendSuccess(res, { product });
}));

router.get("/categories", asyncHandler(async (_req, res) => {
  const categories = await Category.find({ active: true }).sort({ name: 1 }).lean();
  sendSuccess(res, { items: categories });
}));

export default router;
