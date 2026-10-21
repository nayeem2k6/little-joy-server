import { Schema, model } from "mongoose";

const productSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 160 },
  slug: { type: String, required: true, trim: true, lowercase: true, unique: true, sparse: true, index: true },
  description: { type: String, required: true, trim: true, maxlength: 5000 },
  price: { type: Number, required: true, min: 0 },
  compareAtPrice: { type: Number, min: 0, default: null },
  stock: { type: Number, required: true, min: 0, validate: Number.isInteger },
  stockQuantity: { type: Number, required: true, min: 0, validate: Number.isInteger },
  category: { type: Schema.Types.ObjectId, ref: "Category", required: true, index: true },
  imageUrl: { type: String, trim: true, default: "" },
  images: { type: [String], default: [] },
  ageRecommendation: { type: String, trim: true, maxlength: 100, default: "" },
  safetyInformation: { type: String, trim: true, maxlength: 2000, default: "" },
  active: { type: Boolean, default: true, index: true }
}, { timestamps: true });

productSchema.pre("validate", function () {
  if (this.isModified("stockQuantity") && !this.isModified("stock")) this.stock = this.stockQuantity;
  else this.stockQuantity = this.stock;
  if (this.images.length && !this.imageUrl) this.imageUrl = this.images[0];
  else if (this.imageUrl && !this.images.length) this.images = [this.imageUrl];
});

productSchema.index({ name: "text", description: "text" });
export const Product = model("Product", productSchema);
