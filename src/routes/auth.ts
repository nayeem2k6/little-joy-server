import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { env } from "../config/env";
import { asyncHandler } from "../middleware/asyncHandler";
import { clearAuthCookie, issueToken, requireAuth, setAuthCookie } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { User } from "../models/User";
import { sendSuccess } from "../utils/http";
import { AppError } from "../utils/errors";

const router = Router();
const authLimiter = rateLimit({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  limit: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { success: false, error: { code: "RATE_LIMITED", message: "Too many authentication attempts; try again later" } }
});
const credentials = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(128)
});
const registerSchema = credentials.extend({
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(5).max(30).optional()
});

router.post("/register", authLimiter, validate(registerSchema), asyncHandler(async (req, res) => {
  const { name, email, password, phone } = req.body as z.infer<typeof registerSchema>;
  const user = await User.create({ name, email, password, phone, role: "customer" });
  const safeUser = { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role };
  setAuthCookie(res, issueToken(safeUser));
  sendSuccess(res, { user: safeUser }, 201);
}));

router.post("/login", authLimiter, validate(credentials), asyncHandler(async (req, res) => {
  const { email, password } = req.body as z.infer<typeof credentials>;
  const user = await User.findOne({ email }).select("+password");
  if (!user || !(await user.comparePassword(password))) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Email or password is incorrect");
  }
  const safeUser = { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role };
  setAuthCookie(res, issueToken(safeUser));
  sendSuccess(res, { user: safeUser });
}));

router.post("/logout", (_req, res) => {
  clearAuthCookie(res);
  sendSuccess(res, { message: "Logged out" });
});

router.get("/me", requireAuth, (req, res) => sendSuccess(res, { user: req.user }));

export default router;
