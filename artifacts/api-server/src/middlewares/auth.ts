import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-me";
export const COOKIE_NAME = "srs_token";

export interface AuthPayload {
  id: string;
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

export async function attachUser(req: Request, res: Response, next: NextFunction) {
  const cookieToken = req.cookies?.[COOKIE_NAME];
  if (cookieToken) {
    const payload = verifyToken(cookieToken);
    if (payload) {
      const user = await db
        .select({
          id: usersTable.id,
          email: usersTable.email,
          isGuest: usersTable.isGuest,
          expiresAt: usersTable.expiresAt,
        })
        .from(usersTable)
        .where(eq(usersTable.id, payload.id))
        .limit(1);
      if (user.length > 0) {
        const record = user[0];
        if (record.isGuest && record.expiresAt && record.expiresAt <= new Date()) {
          await db.delete(usersTable).where(eq(usersTable.id, record.id));
          res.clearCookie(COOKIE_NAME);
        } else {
          (req as Request & { user?: AuthPayload }).user = {
            id: record.id,
            email: record.email,
          };
        }
      }
    }
  } else {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const bearerToken = authHeader.slice("Bearer ".length).trim();
      const payload = verifyToken(bearerToken);
      if (payload) {
        const user = await db
          .select({
            id: usersTable.id,
            email: usersTable.email,
            isGuest: usersTable.isGuest,
            expiresAt: usersTable.expiresAt,
          })
          .from(usersTable)
          .where(eq(usersTable.id, payload.id))
          .limit(1);
        if (user.length > 0) {
          const record = user[0];
          if (record.isGuest && record.expiresAt && record.expiresAt <= new Date()) {
            await db.delete(usersTable).where(eq(usersTable.id, record.id));
          } else {
            (req as Request & { user?: AuthPayload }).user = {
              id: record.id,
              email: record.email,
            };
          }
        }
      }
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
