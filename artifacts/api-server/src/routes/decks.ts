import { Router, type IRouter, type Request } from "express";
import { db } from "@workspace/db";
import { decksTable, documentsTable, flashcardsTable, keywordsTable, sectionsTable } from "@workspace/db/schema";
import { and, asc, count, eq, inArray, max, min } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();
const getUserId = (req: Request) => (req as Request & { user: { id: string } }).user.id;

router.post("/", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    const { name, parentId, parent_id } = req.body ?? {};
    const resolvedParentId = parentId ?? parent_id ?? null;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return res.status(400).json({ error: "卡片组名称不能为空" });
    }

    const trimmedName = name.trim();
    if (trimmedName.length > 100) {
      return res.status(400).json({ error: "卡片组名称不能超过 100 个字符" });
    }

    if (resolvedParentId) {
      const parent = await db
        .select({ id: decksTable.id })
        .from(decksTable)
        .where(and(eq(decksTable.id, resolvedParentId), eq(decksTable.userId, userId)))
        .limit(1);
      if (parent.length === 0) {
        return res.status(400).json({ error: "父级卡片组不存在" });
      }
    }

    const [deck] = await db
      .insert(decksTable)
      .values({
        name: trimmedName,
        parentId: resolvedParentId,
        userId,
      })
      .returning();

    if (!deck) {
      return res.status(500).json({ error: "创建卡片组失败" });
    }

    const now = new Date().toISOString();
    return res.json({
      id: deck.id,
      name: deck.name,
      parentId: deck.parentId,
      totalCards: 0,
      dueCards: 0,
      createdAt: now,
      updatedAt: now,
    });
  } catch (error) {
    console.error("Create deck failed", error);
    return res.status(500).json({ error: "创建卡片组失败" });
  }
});

router.get("/", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  const rows = await db
    .select()
    .from(decksTable)
    .where(eq(decksTable.userId, userId));

  if (rows.length === 0) {
    return res.json({ decks: [] });
  }

  const deckIds = rows.map((row) => row.id);
  const cardStats = await db
    .select({
      deckId: flashcardsTable.deckId,
      totalCards: count(flashcardsTable.id),
      firstCreatedAt: min(flashcardsTable.createdAt),
      lastCreatedAt: max(flashcardsTable.createdAt),
    })
    .from(flashcardsTable)
    .where(inArray(flashcardsTable.deckId, deckIds))
    .groupBy(flashcardsTable.deckId);

  const statsByDeckId = new Map<
    string,
    {
      totalCards: number;
      createdAt: string;
      updatedAt: string;
    }
  >();

  cardStats.forEach((row) => {
    const createdAt = row.firstCreatedAt
      ? row.firstCreatedAt.toISOString()
      : new Date().toISOString();
    const updatedAt = row.lastCreatedAt
      ? row.lastCreatedAt.toISOString()
      : createdAt;
    statsByDeckId.set(row.deckId, {
      totalCards: Number(row.totalCards ?? 0),
      createdAt,
      updatedAt,
    });
  });

  const nodes = new Map<
    string,
    {
      id: string;
      name: string;
      parentId: string | null;
      children: any[];
      totalCards: number;
      dueCards: number;
      createdAt: string;
      updatedAt: string;
    }
  >();
  const roots: {
    id: string;
    name: string;
    parentId: string | null;
    children: any[];
    totalCards: number;
    dueCards: number;
    createdAt: string;
    updatedAt: string;
  }[] = [];

  rows.forEach((row) => {
    const stats = statsByDeckId.get(row.id);
    const createdAt = stats?.createdAt ?? new Date().toISOString();
    const updatedAt = stats?.updatedAt ?? createdAt;
    nodes.set(row.id, {
      id: row.id,
      name: row.name,
      parentId: row.parentId ?? null,
      children: [],
      totalCards: stats?.totalCards ?? 0,
      dueCards: 0,
      createdAt,
      updatedAt,
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

router.get("/:deckId", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    const deckId = req.params.deckId;

    const [deck] = await db
      .select({ id: decksTable.id, name: decksTable.name })
      .from(decksTable)
      .where(and(eq(decksTable.id, deckId), eq(decksTable.userId, userId)))
      .limit(1);

    if (!deck) {
      return res.status(404).json({ error: "卡片组不存在" });
    }

    const cardRows = await db
      .select({
        id: flashcardsTable.id,
        frontContent: flashcardsTable.frontContent,
        backContent: flashcardsTable.backContent,
        nextReviewDate: flashcardsTable.nextReviewDate,
        keywordId: flashcardsTable.sourceKeywordId,
        keyword: keywordsTable.word,
        documentId: documentsTable.id,
        documentTitle: documentsTable.title,
        createdAt: flashcardsTable.createdAt,
      })
      .from(flashcardsTable)
      .leftJoin(keywordsTable, eq(flashcardsTable.sourceKeywordId, keywordsTable.id))
      .leftJoin(sectionsTable, eq(keywordsTable.sectionId, sectionsTable.id))
      .leftJoin(documentsTable, eq(sectionsTable.documentId, documentsTable.id))
      .where(eq(flashcardsTable.deckId, deckId))
      .orderBy(asc(flashcardsTable.createdAt));

    const totalCards = cardRows.length;
    const dueCards = cardRows.filter(
      (row) => row.nextReviewDate && row.nextReviewDate <= new Date(),
    ).length;
    const createdAt = cardRows[0]?.createdAt?.toISOString() ?? new Date().toISOString();
    const updatedAt = cardRows[cardRows.length - 1]?.createdAt?.toISOString() ?? createdAt;

    return res.json({
      id: deck.id,
      name: deck.name,
      createdAt,
      updatedAt,
      totalCards,
      dueCards,
      cards: cardRows.map((row) => ({
        id: row.id,
        frontContent: row.frontContent,
        backContent: row.backContent,
        status: "active",
        keywordId: row.keywordId ?? null,
        keyword: row.keyword ?? undefined,
        dueDate: row.nextReviewDate?.toISOString(),
        documentId: row.documentId ?? undefined,
        documentTitle: row.documentTitle ?? undefined,
      })),
    });
  } catch (error) {
    console.error("Get deck failed", error);
    return res.status(500).json({ error: "获取卡片组失败" });
  }
});

router.delete("/:deckId", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    const deckId = req.params.deckId;

    const [deck] = await db
      .select({ id: decksTable.id })
      .from(decksTable)
      .where(and(eq(decksTable.id, deckId), eq(decksTable.userId, userId)))
      .limit(1);

    if (!deck) {
      return res.status(404).json({ error: "卡片组不存在" });
    }

    const childCount = await db
      .select({ count: count() })
      .from(decksTable)
      .where(and(eq(decksTable.parentId, deckId), eq(decksTable.userId, userId)));
    if ((childCount[0]?.count ?? 0) > 0) {
      return res.status(400).json({ error: "请先删除子卡片组" });
    }

    const cardCount = await db
      .select({ count: count() })
      .from(flashcardsTable)
      .where(eq(flashcardsTable.deckId, deckId));
    if ((cardCount[0]?.count ?? 0) > 0) {
      return res.status(400).json({ error: "请先移除卡片组内卡片" });
    }

    await db.delete(decksTable).where(eq(decksTable.id, deckId));
    return res.json({ ok: true });
  } catch (error) {
    console.error("Delete deck failed", error);
    return res.status(500).json({ error: "删除卡片组失败" });
  }
});

export default router;
