import { ErrorRequestHandler, RequestHandler } from "express";
import mongoose from "mongoose";
import { AppError } from "../utils/errors";

export const notFound: RequestHandler = (_req, _res, next) => {
  next(new AppError(404, "NOT_FOUND", "Route not found"));
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof SyntaxError && "body" in error) {
    res.status(400).json({ success: false, error: { code: "INVALID_JSON", message: "Request body contains invalid JSON" } });
    return;
  }
  if (error instanceof AppError) {
    res.status(error.statusCode).json({ success: false, error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) } });
    return;
  }
  if (error instanceof mongoose.Error.ValidationError) {
    res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "Request validation failed", details: error.message } });
    return;
  }
  if (error instanceof mongoose.Error.CastError) {
    res.status(400).json({ success: false, error: { code: "INVALID_ID", message: "Invalid resource identifier" } });
    return;
  }
  if (error?.code === 11000) {
    res.status(409).json({ success: false, error: { code: "DUPLICATE_RESOURCE", message: "A resource with that value already exists" } });
    return;
  }
  console.error(error);
  res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } });
};
