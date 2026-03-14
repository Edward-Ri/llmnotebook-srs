import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { COOKIE_NAME, requireAuth, signToken } from "../middlewares/auth";

const router: IRouter = Router();
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  maxAge: 30 * 24 * 60 * 60 * 1000,
  secure: process.env.NODE_ENV === "production",
};

router.post("/register", async (req, res) => {
  const { email, password } = req.body ?? {};

  if (!email || !password) {
    return res.status(400).json({ error: "邮箱和密码不能为空" });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "邮箱格式不正确" });
  }
  if ((password as string).length < 6) {
    return res.status(400).json({ error: "密码至少需要 6 位" });
  }

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existing.length > 0) {
    return res.status(409).json({ error: "该邮箱已被注册" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db.insert(usersTable).values({ email, passwordHash }).returning();

  const token = signToken({ id: user.id, email: user.email });
  res.cookie(COOKIE_NAME, token, COOKIE_OPTS);

  return res.json({ user: { id: user.id, email: user.email } });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    return res.status(400).json({ error: "邮箱和密码不能为空" });
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (!user) return res.status(401).json({ error: "邮箱或密码错误" });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "邮箱或密码错误" });

  const token = signToken({ id: user.id, email: user.email });
  res.cookie(COOKIE_NAME, token, COOKIE_OPTS);
  return res.json({ user: { id: user.id, email: user.email } });
});

router.post("/guest", async (_req, res) => {
  const guestId = randomUUID();
  const email = `guest_${guestId}@temp.local`;
  const passwordHash = await bcrypt.hash(randomUUID(), 10);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const [user] = await db
    .insert(usersTable)
    .values({ email, passwordHash, isGuest: true, expiresAt })
    .returning();
  const token = signToken({ id: user.id, email: user.email });
  return res.json({ token, user: { id: user.id, email: user.email } });
});

router.get("/me", requireAuth, (req, res) => {
  const user = (req as typeof req & { user: { id: string; email: string } }).user;
  return res.json({ user: { id: user.id, email: user.email } });
});

router.post("/logout", async (req, res) => {
  const user = (req as typeof req & { user?: { id: string } }).user;
  if (user?.id) {
    const rows = await db
      .select({ id: usersTable.id, isGuest: usersTable.isGuest })
      .from(usersTable)
      .where(eq(usersTable.id, user.id))
      .limit(1);
    if (rows.length > 0 && rows[0].isGuest) {
      await db.delete(usersTable).where(eq(usersTable.id, user.id));
    }
  }
  res.clearCookie(COOKIE_NAME);
  return res.json({ ok: true });
});

export default router;
