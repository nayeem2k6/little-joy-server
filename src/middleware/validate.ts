import { NextFunction, Request, Response } from "express";
import { ZodType } from "zod";
import { AppError } from "../utils/errors";

export function validate(schema: ZodType, source: "body" | "query" | "params" = "body") {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      next(new AppError(400, "VALIDATION_ERROR", "Request validation failed", result.error.flatten()));
      return;
    }
    (req as Request & { validated?: Record<string, unknown> }).validated = result.data as Record<string, unknown>;
    if (source === "body") req.body = result.data;
    next();
  };
}
