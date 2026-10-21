import { Schema, model } from "mongoose";

const categorySchema = new Schema({
  name: { type: String, required: true, trim: true, unique: true, maxlength: 80 },
  slug: { type: String, required: true, trim: true, unique: true, lowercase: true },
  description: { type: String, trim: true, maxlength: 500, default: "" },
  imageUrl: { type: String, trim: true, default: "" },
  active: { type: Boolean, default: true }
}, { timestamps: true });

export const Category = model("Category", categorySchema);
