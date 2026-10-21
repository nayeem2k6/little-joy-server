import { Schema, model } from "mongoose";

const couponSchema = new Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true, minlength: 3, maxlength: 40 },
  discountType: { type: String, enum: ["percentage", "fixed"], required: true },
  discountValue: { type: Number, required: true, min: 0 },
  minSubtotal: { type: Number, min: 0, default: 0 },
  maxDiscount: { type: Number, min: 0, default: null },
  startsAt: { type: Date, default: null },
  expiresAt: { type: Date, default: null },
  usageLimit: { type: Number, min: 1, default: null },
  perUserLimit: { type: Number, min: 1, default: null },
  usedCount: { type: Number, min: 0, default: 0 },
  active: { type: Boolean, default: true }
}, { timestamps: true });

export const Coupon = model("Coupon", couponSchema);
