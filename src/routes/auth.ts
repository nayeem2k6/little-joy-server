import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { OAuth2Client } from "google-auth-library";
import { z } from "zod";
import { env } from "../config/env";
import { asyncHandler } from "../middleware/asyncHandler";
import { clearAuthCookie, issueToken, requireAuth, setAuthCookie } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { User, UserRole } from "../models/User";
import { sendSuccess } from "../utils/http";
import { AppError } from "../utils/errors";

const router = Router();
const googleClient = new OAuth2Client();
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
const googleCredentialSchema = z.object({ credential: z.string().min(1).max(8192) });
const profileSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  phone: z.string().trim().max(30).refine((value) => value.length === 0 || value.length >= 5).optional()
}).refine((value) => Object.keys(value).length > 0, {
  message: "At least one profile field must be provided"
});

interface GoogleUser {
  _id: { toString(): string };
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  googleId?: string;
  save(): Promise<unknown>;
}

function createSession(user: { _id: { toString(): string }; name: string; email: string; phone?: string; role: "customer" | "admin" }, res: Parameters<typeof setAuthCookie>[0]) {
  const safeUser = { id: user._id.toString(), name: user.name, email: user.email, phone: user.phone, role: user.role };
  setAuthCookie(res, issueToken(safeUser));
  return safeUser;
}

router.post("/register", authLimiter, validate(registerSchema), asyncHandler(async (req, res) => {
  const { name, email, password, phone } = req.body as z.infer<typeof registerSchema>;
  const user = await User.create({ name, email, password, phone, role: "customer" });
  sendSuccess(res, { user: createSession(user, res) }, 201);
}));

router.post("/login", authLimiter, validate(credentials), asyncHandler(async (req, res) => {
  const { email, password } = req.body as z.infer<typeof credentials>;
  const user = await User.findOne({ email }).select("+password");
  if (!user || !(await user.comparePassword(password))) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Email or password is incorrect");
  }
  sendSuccess(res, { user: createSession(user, res) });
}));

router.post("/google", authLimiter, validate(googleCredentialSchema), asyncHandler(async (req, res) => {
  if (!env.GOOGLE_CLIENT_ID) {
    throw new AppError(503, "GOOGLE_AUTH_NOT_CONFIGURED", "Google sign-in is not configured");
  }

  const { credential } = req.body as z.infer<typeof googleCredentialSchema>;
  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: env.GOOGLE_CLIENT_ID });
    payload = ticket.getPayload();
  } catch {
    throw new AppError(401, "INVALID_GOOGLE_CREDENTIAL", "Google sign-in could not be verified");
  }

  if (!payload?.sub || !payload.email || payload.email_verified !== true) {
    throw new AppError(401, "INVALID_GOOGLE_CREDENTIAL", "Google must provide a verified email address");
  }

  const email = payload.email.toLowerCase();
  let user: GoogleUser | null = await User.findOne({ googleId: payload.sub }).select("+googleId");
  if (!user) {
    user = await User.findOne({ email }).select("+googleId");
    if (user) {
      user.googleId = payload.sub;
      await user.save();
    } else {
      const createdUser = await User.create({
        name: payload.name?.trim() || email,
        email,
        googleId: payload.sub,
        role: "customer"
      });
      user = await User.findById(createdUser._id).select("+googleId");
    }
  }
  if (!user) throw new AppError(500, "GOOGLE_USER_UNAVAILABLE", "Unable to create or retrieve the Google account");

  sendSuccess(res, { user: createSession(user, res) });
}));

router.post("/logout", (_req, res) => {
  clearAuthCookie(res);
  sendSuccess(res, { message: "Logged out" });
});

router.get("/me", requireAuth, (req, res) => sendSuccess(res, { user: req.user }));

router.patch("/profile", requireAuth, validate(profileSchema), asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.user!.id,
    { $set: req.body },
    { new: true, runValidators: true }
  ).select("name email phone role").lean();
  if (!user) throw new AppError(404, "USER_NOT_FOUND", "Account no longer exists");
  sendSuccess(res, { user: { id: user._id.toString(), name: user.name, email: user.email, phone: user.phone, role: user.role } });
}));

export default router;
