import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-me";
export const COOKIE_NAME = "srs_token";

export interface AuthPayload {
  userId: string;
  email: string;
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });
}

export function verifyToken(token: string): AuthPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthPayload;
  } catch {
    return null;
  }
}

export function attachUser(req: Request, _res: Response, next: NextFunction) {
  const cookieToken = req.cookies?.[COOKIE_NAME];
  if (cookieToken) {
    const payload = verifyToken(cookieToken);
    if (payload) (req as Request & { user?: AuthPayload }).user = payload;
  } else {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const bearerToken = authHeader.slice("Bearer ".length).trim();
      const payload = verifyToken(bearerToken);
      if (payload) (req as Request & { user?: AuthPayload }).user = payload;
    }
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!(req as Request & { user?: AuthPayload }).user) {
    return res.status(401).json({ error: "请先登录" });
  }
  return next();
}
