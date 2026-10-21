import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { User, UserRole } from "../models/User";
import { AppError } from "../utils/errors";

export interface AuthUser {
  id: string;
  role: UserRole;
  name: string;
  email: string;
  phone?: string;
}
declare global {
  namespace Express {
    interface Request { user?: AuthUser }
  }
}

export function issueToken(user: AuthUser): string {
  return jwt.sign({ sub: user.id, role: user.role }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"] });
}

export function setAuthCookie(res: Response, token: string): void {
  res.cookie(env.COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.COOKIE_SECURE || env.NODE_ENV === "production",
    sameSite: env.COOKIE_SAME_SITE,
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(env.COOKIE_NAME, {
    httpOnly: true,
    secure: env.COOKIE_SECURE || env.NODE_ENV === "production",
    sameSite: env.COOKIE_SAME_SITE,
    path: "/"
  });
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = req.cookies?.[env.COOKIE_NAME];
    if (!token) throw new AppError(401, "UNAUTHENTICATED", "Authentication required");
    const payload = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
    const userId = payload.sub;
    if (typeof userId !== "string") throw new AppError(401, "INVALID_TOKEN", "Invalid authentication token");
    const user = await User.findById(userId).select("name email phone role").lean();
    if (!user) throw new AppError(401, "UNAUTHENTICATED", "Authentication required");
    req.user = { id: user._id.toString(), name: user.name, email: user.email, phone: user.phone, role: user.role };
    next();
  } catch (error) {
    next(error instanceof AppError ? error : new AppError(401, "INVALID_TOKEN", "Invalid or expired authentication token"));
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      next(new AppError(403, "FORBIDDEN", "You do not have permission to perform this action"));
      return;
    }
    next();
  };
}
