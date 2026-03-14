import { Router, type IRouter, type Request } from "express";
import { db } from "@workspace/db";
import { decksTable } from "@workspace/db/schema";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();
const getUserId = (req: Request) => (req as Request & { user: { userId: string } }).user.userId;

router.post("/", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  const { name, parentId } = req.body ?? {};

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return res.status(400).json({ error: "卡片组名称不能为空" });
  }

  if (parentId) {
    const parent = await db
      .select({ id: decksTable.id })
      .from(decksTable)
      .where(and(eq(decksTable.id, parentId), eq(decksTable.userId, userId)))
      .limit(1);
    if (parent.length === 0) {
      return res.status(400).json({ error: "父级卡片组不存在" });
    }
  }

  const [deck] = await db
    .insert(decksTable)
    .values({
      name: name.trim(),
      parentId: parentId ?? null,
      userId,
    })
    .returning();

  return res.json({
    deck: {
      id: deck.id,
      name: deck.name,
      parentId: deck.parentId,
    },
  });
});

router.get("/", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  const rows = await db
    .select()
    .from(decksTable)
    .where(eq(decksTable.userId, userId));

  const nodes = new Map<string, { id: string; name: string; parentId: string | null; children: any[] }>();
  const roots: { id: string; name: string; parentId: string | null; children: any[] }[] = [];

  rows.forEach((row) => {
    nodes.set(row.id, {
      id: row.id,
      name: row.name,
      parentId: row.parentId ?? null,
      children: [],
    });
  });

  nodes.forEach((node) => {
    if (node.parentId && nodes.has(node.parentId)) {
      nodes.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  return res.json({ decks: roots });
});

export default router;
