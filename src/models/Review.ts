import { Schema, model } from "mongoose";

const reviewSchema = new Schema({
  product: { type: Schema.Types.ObjectId, ref: "Product", required: true, index: true },
  user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  rating: { type: Number, required: true, min: 1, max: 5, validate: Number.isInteger },
  comment: { type: String, required: true, trim: true, minlength: 3, maxlength: 2000 },
  status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending", index: true }
}, { timestamps: true });

reviewSchema.index({ product: 1, user: 1 }, { unique: true });
export const Review = model("Review", reviewSchema);
