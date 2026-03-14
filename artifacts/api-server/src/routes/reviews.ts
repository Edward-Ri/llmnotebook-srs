import { Router, type IRouter, type Request } from "express";
import { db } from "@workspace/db";
import { decksTable, flashcardsTable, keywordsTable } from "@workspace/db/schema";
import { and, asc, eq, lte } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

const getUserId = (req: Request) => (req as Request & { user: { id: string } }).user.id;

router.get("/due", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    const deckId = typeof req.query.deckId === "string" ? req.query.deckId : undefined;

    if (deckId) {
      const [deck] = await db
        .select({ id: decksTable.id })
        .from(decksTable)
        .where(and(eq(decksTable.id, deckId), eq(decksTable.userId, userId)))
        .limit(1);
      if (!deck) {
        return res.status(404).json({ error: "卡片组不存在" });
      }
    }

    const conditions = [
      eq(decksTable.userId, userId),
      lte(flashcardsTable.nextReviewDate, new Date()),
    ];
    if (deckId) conditions.push(eq(flashcardsTable.deckId, deckId));

    const rows = await db
      .select({
        id: flashcardsTable.id,
        frontContent: flashcardsTable.frontContent,
        backContent: flashcardsTable.backContent,
        repetition: flashcardsTable.repetition,
        interval: flashcardsTable.interval,
        easeFactor: flashcardsTable.easeFactor,
        nextReviewDate: flashcardsTable.nextReviewDate,
        keywordId: flashcardsTable.sourceKeywordId,
        keyword: keywordsTable.word,
      })
      .from(flashcardsTable)
      .leftJoin(decksTable, eq(flashcardsTable.deckId, decksTable.id))
      .leftJoin(keywordsTable, eq(flashcardsTable.sourceKeywordId, keywordsTable.id))
      .where(and(...conditions))
      .orderBy(asc(flashcardsTable.nextReviewDate), asc(flashcardsTable.createdAt));

    const cards = rows.map((row) => ({
      id: row.id,
      frontContent: row.frontContent,
      backContent: row.backContent,
      status: "active",
      keywordId: row.keywordId ?? "",
      keyword: row.keyword ?? undefined,
      sm2Interval: row.interval,
      sm2Repetition: row.repetition,
      sm2Efactor: row.easeFactor,
      dueDate: row.nextReviewDate?.toISOString(),
    }));

    return res.json({
      cards,
      total: cards.length,
      todayReviewed: 0,
    });
  } catch (error) {
    console.error("Get due cards failed", error);
    return res.status(500).json({ error: "获取待复习卡片失败" });
  }
});

router.post("/log", requireAuth, (_req, res) => {
  res.status(501).json({
    error: "NOT_IMPLEMENTED",
    message: "Review log endpoint is not implemented yet.",
  });
});

export default router;
