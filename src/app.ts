import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import { corsOrigins } from "./config/env";
import { errorHandler, notFound } from "./middleware/errorHandler";
import authRoutes from "./routes/auth";
import catalogRoutes from "./routes/catalog";
import orderRoutes from "./routes/orders";
import adminRoutes from "./routes/admin";
import { sendSuccess } from "./utils/http";
import { AppError } from "./utils/errors";

export const app = express();
app.disable("x-powered-by");
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || corsOrigins.includes(origin)) callback(null, true);
    else callback(new AppError(403, "CORS_ORIGIN_DENIED", "Origin is not allowed by CORS"));
  },
  credentials: true
}));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.get("/health", (_req, res) => sendSuccess(res, { status: "ok" }));
app.use("/api/auth", authRoutes);
app.use("/api", catalogRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/admin", adminRoutes);
app.use(notFound);
app.use(errorHandler);
