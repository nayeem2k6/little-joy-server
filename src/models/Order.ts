import { Schema, model } from "mongoose";
import { randomUUID } from "node:crypto";

const orderSchema = new Schema({
  orderNumber: { type: String, required: true, unique: true, sparse: true, index: true, default: () => `LJ-${Date.now().toString(36).toUpperCase()}-${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}` },
  user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  items: [{
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    imageUrl: { type: String, default: "" }
  }],
  shippingAddress: {
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    addressLine1: { type: String, required: true },
    addressLine2: { type: String, default: "" },
    city: { type: String, required: true },
    postalCode: { type: String, required: true },
    country: { type: String, required: true }
  },
  subtotal: { type: Number, required: true, min: 0 },
  deliveryFee: { type: Number, required: true, min: 0, default: 0 },
  coupon: {
    couponId: { type: Schema.Types.ObjectId, ref: "Coupon" },
    code: { type: String },
    discount: { type: Number, min: 0, default: 0 }
  },
  customerPhone: { type: String, trim: true, default: "" },
  total: { type: Number, required: true, min: 0 },
  paymentMethod: { type: String, enum: ["COD"], default: "COD" },
  status: { type: String, enum: ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"], default: "pending", index: true }
}, { timestamps: true });

export const Order = model("Order", orderSchema);
