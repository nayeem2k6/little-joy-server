import bcrypt from "bcryptjs";
import { HydratedDocument, Model, Schema, model } from "mongoose";

export type UserRole = "customer" | "admin";
export interface UserFields {
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  googleId?: string;
  phone?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
export interface UserMethods {
  comparePassword(candidate: string): Promise<boolean>;
}
type UserModel = Model<UserFields, object, UserMethods>;

const userSchema = new Schema<UserFields, UserModel, UserMethods>({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  password: { type: String, select: false },
  role: { type: String, enum: ["customer", "admin"], default: "customer", required: true },
  googleId: { type: String, unique: true, sparse: true, select: false },
  phone: { type: String, trim: true, maxlength: 30 }
}, { timestamps: true });

userSchema.pre("save", async function () {
  if (this.isModified("password") && this.password) this.password = await bcrypt.hash(this.password, 12);
});
userSchema.method("comparePassword", async function (candidate: string) {
  const password = this.password;
  return password ? bcrypt.compare(candidate, password) : false;
});

export type UserDocument = HydratedDocument<UserFields, UserMethods>;
export const User = model<UserFields, UserModel>("User", userSchema);
