import { Router, type IRouter, type Request } from "express";
import { db } from "@workspace/db";
import {
  decksTable,
  documentsTable,
  flashcardsTable,
  keywordsTable,
  reviewLogsTable,
  sectionsTable,
} from "@workspace/db/schema";
import { and, asc, count, eq, gte, inArray, lt } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { getLocalDayBounds, resolveTzOffsetMinutes } from "../utils/timezone";

const router: IRouter = Router();
const getUserId = (req: Request) => (req as Request & { user: { id: string } }).user.id;

type DeckTreeNode = {
  id: string;
  name: string;
  parentId: string | null;
  children: DeckTreeNode[];
  totalCards: number;
  dueCards: number;
  newCards: number;
  reviewedToday: number;
  createdAt: string;
  updatedAt: string;
};

function validateDeckName(name: unknown) {
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return { error: "卡片组名称不能为空" } as const;
  }

  const trimmedName = name.trim();
  if (trimmedName.length > 100) {
    return { error: "卡片组名称不能超过 100 个字符" } as const;
  }

  return { value: trimmedName } as const;
}

function sortDeckTree(nodes: DeckTreeNode[]) {
  nodes.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  nodes.forEach((node) => sortDeckTree(node.children));
}

router.post("/", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    const { name, parentId, parent_id } = req.body ?? {};
    const resolvedParentId = parentId ?? parent_id ?? null;
    const validatedName = validateDeckName(name);
    if ("error" in validatedName) {
      return res.status(400).json({ error: validatedName.error });
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
        name: validatedName.value,
        parentId: resolvedParentId,
        userId,
      })
      .returning();

    if (!deck) {
      return res.status(500).json({ error: "创建卡片组失败" });
    }

    const now = new Date().toISOString();
    return res.status(201).json({
      id: deck.id,
      name: deck.name,
      parentId: deck.parentId,
      children: [],
      totalCards: 0,
      dueCards: 0,
      newCards: 0,
      reviewedToday: 0,
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
  const tzOffsetMinutes = resolveTzOffsetMinutes(req);
  const { dayStartUtc, nextDayStartUtc } = getLocalDayBounds(new Date(), tzOffsetMinutes);
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
      interval: flashcardsTable.interval,
      nextReviewDate: flashcardsTable.nextReviewDate,
      createdAt: flashcardsTable.createdAt,
    })
    .from(flashcardsTable)
    .where(inArray(flashcardsTable.deckId, deckIds))
    .orderBy(asc(flashcardsTable.createdAt));

  const statsByDeckId = new Map<
    string,
    {
      totalCards: number;
      dueCards: number;
      newCards: number;
      reviewedToday: number;
      createdAt: string;
      updatedAt: string;
    }
  >();

  cardStats.forEach((row) => {
    const createdAt = row.createdAt?.toISOString() ?? new Date().toISOString();
    const prev = statsByDeckId.get(row.deckId);
    const dueCards =
      row.interval > 0 && row.nextReviewDate < nextDayStartUtc ? 1 : 0;
    const newCards = row.interval === 0 ? 1 : 0;
    if (!prev) {
      statsByDeckId.set(row.deckId, {
        totalCards: 1,
        dueCards,
        newCards,
        reviewedToday: 0,
        createdAt,
        updatedAt: createdAt,
      });
      return;
    }
    prev.totalCards += 1;
    prev.dueCards += dueCards;
    prev.newCards += newCards;
    prev.updatedAt = createdAt;
  });

  const reviewedStats = await db
    .select({
      deckId: flashcardsTable.deckId,
      reviewed: count(reviewLogsTable.id),
    })
    .from(reviewLogsTable)
    .leftJoin(flashcardsTable, eq(reviewLogsTable.cardId, flashcardsTable.id))
    .leftJoin(decksTable, eq(flashcardsTable.deckId, decksTable.id))
    .where(
      and(
        eq(decksTable.userId, userId),
        gte(reviewLogsTable.createdAt, dayStartUtc),
        lt(reviewLogsTable.createdAt, nextDayStartUtc),
      ),
    )
    .groupBy(flashcardsTable.deckId);

  reviewedStats.forEach((row) => {
    if (!row.deckId) return;
    const prev = statsByDeckId.get(row.deckId);
    if (!prev) return;
    prev.reviewedToday = Number(row.reviewed ?? 0);
  });

  const nodes = new Map<string, DeckTreeNode>();
  const roots: DeckTreeNode[] = [];

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
      dueCards: stats?.dueCards ?? 0,
      newCards: stats?.newCards ?? 0,
      reviewedToday: stats?.reviewedToday ?? 0,
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

  sortDeckTree(roots);
  return res.json({ decks: roots });
});

router.patch("/:deckId", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    const deckId = String(req.params.deckId);
    const { name, parentId, parent_id } = req.body ?? {};
    const nextParentId = parentId === undefined ? parent_id : parentId;

    if (name === undefined && nextParentId === undefined) {
      return res.status(400).json({ error: "缺少可更新字段" });
    }

    const rows = await db
      .select({ id: decksTable.id, name: decksTable.name, parentId: decksTable.parentId })
      .from(decksTable)
      .where(eq(decksTable.userId, userId));

    const decksById = new Map(rows.map((row) => [row.id, row]));
    const deck = decksById.get(deckId);
    if (!deck) {
      return res.status(404).json({ error: "卡片组不存在" });
    }

    const updateValues: { name?: string; parentId?: string | null } = {};

    if (name !== undefined) {
      const validatedName = validateDeckName(name);
      if ("error" in validatedName) {
        return res.status(400).json({ error: validatedName.error });
      }
      updateValues.name = validatedName.value;
    }

    if (nextParentId !== undefined) {
      const resolvedParentId = nextParentId ?? null;
      if (resolvedParentId) {
        if (resolvedParentId === deckId) {
          return res.status(400).json({ error: "不能将卡片组移动到自身下" });
        }

        const parent = decksById.get(resolvedParentId);
        if (!parent) {
          return res.status(400).json({ error: "父级卡片组不存在" });
        }

        let cursor = parent.parentId ?? null;
        while (cursor) {
          if (cursor === deckId) {
            return res.status(400).json({ error: "不能将卡片组移动到其子组下" });
          }
          cursor = decksById.get(cursor)?.parentId ?? null;
        }
      }

      updateValues.parentId = resolvedParentId;
    }

    const [updatedDeck] = await db
      .update(decksTable)
      .set(updateValues)
      .where(and(eq(decksTable.id, deckId), eq(decksTable.userId, userId)))
      .returning();

    if (!updatedDeck) {
      return res.status(500).json({ error: "更新卡片组失败" });
    }

    const now = new Date().toISOString();
    return res.json({
      id: updatedDeck.id,
      name: updatedDeck.name,
      parentId: updatedDeck.parentId,
      children: [],
      totalCards: 0,
      dueCards: 0,
      newCards: 0,
      reviewedToday: 0,
      createdAt: now,
      updatedAt: now,
    });
  } catch (error) {
    console.error("Update deck failed", error);
    return res.status(500).json({ error: "更新卡片组失败" });
  }
});

router.get("/:deckId", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    const deckId = String(req.params.deckId);
    const tzOffsetMinutes = resolveTzOffsetMinutes(req);
    const { dayStartUtc, nextDayStartUtc } = getLocalDayBounds(new Date(), tzOffsetMinutes);

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
        interval: flashcardsTable.interval,
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
      (row) => row.interval > 0 && row.nextReviewDate < nextDayStartUtc,
    ).length;
    const newCards = cardRows.filter((row) => row.interval === 0).length;
    const [{ reviewedToday }] = await db
      .select({ reviewedToday: count(reviewLogsTable.id) })
      .from(reviewLogsTable)
      .leftJoin(flashcardsTable, eq(reviewLogsTable.cardId, flashcardsTable.id))
      .leftJoin(decksTable, eq(flashcardsTable.deckId, decksTable.id))
      .where(
        and(
          eq(decksTable.userId, userId),
          eq(flashcardsTable.deckId, deckId),
          gte(reviewLogsTable.createdAt, dayStartUtc),
          lt(reviewLogsTable.createdAt, nextDayStartUtc),
        ),
      );
    const createdAt = cardRows[0]?.createdAt?.toISOString() ?? new Date().toISOString();
    const updatedAt = cardRows[cardRows.length - 1]?.createdAt?.toISOString() ?? createdAt;

    return res.json({
      id: deck.id,
      name: deck.name,
      createdAt,
      updatedAt,
      totalCards,
      dueCards,
      newCards,
      reviewedToday: Number(reviewedToday ?? 0),
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
    const deckId = String(req.params.deckId);
    const rows = await db
      .select({ id: decksTable.id, parentId: decksTable.parentId })
      .from(decksTable)
      .where(eq(decksTable.userId, userId));
    const decksById = new Map(rows.map((row) => [row.id, row]));
    if (!decksById.has(deckId)) {
      return res.status(404).json({ error: "卡片组不存在" });
    }

    const childrenByParentId = new Map<string, string[]>();
    rows.forEach((row) => {
      if (!row.parentId) return;
      const siblings = childrenByParentId.get(row.parentId) ?? [];
      siblings.push(row.id);
      childrenByParentId.set(row.parentId, siblings);
    });

    const subtreeIds: string[] = [];
    const queue = [deckId];
    while (queue.length > 0) {
      const currentId = queue.shift();
      if (!currentId) continue;
      subtreeIds.push(currentId);
      const children = childrenByParentId.get(currentId) ?? [];
      queue.push(...children);
    }

    const cardCount = await db
      .select({ count: count() })
      .from(flashcardsTable)
      .where(inArray(flashcardsTable.deckId, subtreeIds));
    if ((cardCount[0]?.count ?? 0) > 0) {
      return res.status(400).json({ error: "请先移除该卡片组及其子组内的卡片" });
    }

    const depthById = new Map<string, number>();
    const depthQueue: Array<{ id: string; depth: number }> = [{ id: deckId, depth: 0 }];
    while (depthQueue.length > 0) {
      const current = depthQueue.shift();
      if (!current) continue;
      depthById.set(current.id, current.depth);
      const children = childrenByParentId.get(current.id) ?? [];
      children.forEach((childId) => {
        depthQueue.push({ id: childId, depth: current.depth + 1 });
      });
    }

    const deleteOrder = [...subtreeIds].sort(
      (a, b) => (depthById.get(b) ?? 0) - (depthById.get(a) ?? 0),
    );

    await db.transaction(async (tx) => {
      for (const id of deleteOrder) {
        await tx.delete(decksTable).where(eq(decksTable.id, id));
      }
    });

    return res.json({ ok: true });
  } catch (error) {
    console.error("Delete deck failed", error);
    return res.status(500).json({ error: "删除卡片组失败" });
  }
});

export default router;
