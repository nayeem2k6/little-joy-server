import mongoose from "mongoose";
import { env } from "./env";

export async function connectDatabase(uri = env.MONGODB_URI): Promise<void> {
  await mongoose.connect(uri);
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
