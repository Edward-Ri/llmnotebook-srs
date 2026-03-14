import { Router, type IRouter, type Request } from "express";
import { db } from "@workspace/db";
import { decksTable, flashcardsTable, keywordsTable, reviewLogsTable } from "@workspace/db/schema";
import { and, asc, count, eq, gte, lte } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { z } from "zod";
import { calculateSM2 } from "../utils/sm2";

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

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayReviewed = await db
      .select({ count: count() })
      .from(reviewLogsTable)
      .leftJoin(flashcardsTable, eq(reviewLogsTable.cardId, flashcardsTable.id))
      .leftJoin(decksTable, eq(flashcardsTable.deckId, decksTable.id))
      .where(
        and(
          eq(decksTable.userId, userId),
          gte(reviewLogsTable.createdAt, todayStart),
          ...(deckId ? [eq(flashcardsTable.deckId, deckId)] : []),
        ),
      );

    const cards = rows.map((row) => ({
      id: row.id,
      frontContent: row.frontContent,
      backContent: row.backContent,
      status: "active",
      keywordId: row.keywordId ?? null,
      keyword: row.keyword ?? undefined,
      sm2Interval: row.interval,
      sm2Repetition: row.repetition,
      sm2Efactor: row.easeFactor,
      dueDate: row.nextReviewDate?.toISOString(),
    }));

    return res.json({
      cards,
      total: cards.length,
      todayReviewed: Number(todayReviewed[0]?.count ?? 0),
    });
  } catch (error) {
    console.error("Get due cards failed", error);
    return res.status(500).json({ error: "获取待复习卡片失败" });
  }
});

const LogReviewRequest = z.object({
  cardId: z.string().uuid(),
  grade: z.number().int().min(0).max(5),
});

router.post("/log", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    const body = LogReviewRequest.parse(req.body);

    const [card] = await db
      .select({
        id: flashcardsTable.id,
        deckId: flashcardsTable.deckId,
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
      .where(and(eq(flashcardsTable.id, body.cardId), eq(decksTable.userId, userId)))
      .limit(1);

    if (!card) {
      return res.status(404).json({ error: "卡片不存在" });
    }

    const sm2 = calculateSM2(
      body.grade,
      card.repetition ?? 0,
      card.interval ?? 0,
      card.easeFactor ?? 2.5,
    );

    await db.transaction(async (tx) => {
      await tx
        .update(flashcardsTable)
        .set({
          repetition: sm2.repetition,
          interval: sm2.interval,
          easeFactor: sm2.easeFactor,
          nextReviewDate: sm2.nextReviewDate,
        })
        .where(eq(flashcardsTable.id, card.id));

      await tx.insert(reviewLogsTable).values({
        cardId: card.id,
        grade: body.grade,
      });
    });

    return res.json({
      card: {
        id: card.id,
        frontContent: card.frontContent,
        backContent: card.backContent,
        status: "active",
        keywordId: card.keywordId ?? null,
        keyword: card.keyword ?? undefined,
        sm2Interval: sm2.interval,
        sm2Repetition: sm2.repetition,
        sm2Efactor: sm2.easeFactor,
        dueDate: sm2.nextReviewDate.toISOString(),
      },
      nextDueDate: sm2.nextReviewDate.toISOString(),
      newInterval: sm2.interval,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json(error.issues);
    }
    console.error("Log review failed", error);
    return res.status(500).json({ error: "记录复习失败" });
  }
});

export default router;
