import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { cardsTable, keywordsTable, reviewLogsTable } from "@workspace/db/schema";
import { eq, and, lte, count, gte } from "drizzle-orm";
import { LogReviewBody } from "@workspace/api-zod";

const router: IRouter = Router();

function sm2Algorithm(
  efactor: number,
  interval: number,
  repetition: number,
  grade: number
): { newEfactor: number; newInterval: number; newRepetition: number } {
  let newEfactor = efactor + (0.1 - (3 - grade) * (0.08 + (3 - grade) * 0.02));
  if (newEfactor < 1.3) newEfactor = 1.3;

  let newRepetition: number;
  let newInterval: number;

  if (grade < 2) {
    newRepetition = 0;
    newInterval = 1;
  } else {
    newRepetition = repetition + 1;
    if (repetition === 0) {
      newInterval = 1;
    } else if (repetition === 1) {
      newInterval = 6;
    } else {
      newInterval = Math.round(interval * newEfactor);
    }
  }

  return { newEfactor, newInterval, newRepetition };
}

router.get("/due", async (_req, res) => {
  const now = new Date();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const dueCards = await db.select().from(cardsTable).where(
    and(
      eq(cardsTable.status, "active"),
      lte(cardsTable.dueDate, now)
    )
  );

  const todayReviewed = await db.select({ count: count() }).from(reviewLogsTable).where(
    gte(reviewLogsTable.createdAt, todayStart)
  );

  const cardsWithKeywords = await Promise.all(
    dueCards.map(async (card) => {
      const kw = await db.select().from(keywordsTable).where(eq(keywordsTable.id, card.keywordId)).limit(1);
      return {
        id: card.id,
        frontContent: card.frontContent,
        backContent: card.backContent,
        status: card.status,
        keywordId: card.keywordId,
        keyword: kw[0]?.word ?? "",
        sm2Interval: card.sm2Interval,
        sm2Repetition: card.sm2Repetition,
        sm2Efactor: card.sm2Efactor,
        dueDate: card.dueDate.toISOString(),
      };
    })
  );

  res.json({
    cards: cardsWithKeywords,
    total: cardsWithKeywords.length,
    todayReviewed: todayReviewed[0]?.count ?? 0,
  });
});

router.post("/log", async (req, res) => {
  const body = LogReviewBody.parse(req.body);

  const [card] = await db.select().from(cardsTable).where(eq(cardsTable.id, body.cardId)).limit(1);
  if (!card) {
    return res.status(404).json({ error: "卡片未找到" });
  }

  const { newEfactor, newInterval, newRepetition } = sm2Algorithm(
    card.sm2Efactor,
    card.sm2Interval,
    card.sm2Repetition,
    body.grade
  );

  const nextDue = new Date();
  nextDue.setDate(nextDue.getDate() + newInterval);

  const [updatedCard] = await db.update(cardsTable).set({
    sm2Efactor: newEfactor,
    sm2Interval: newInterval,
    sm2Repetition: newRepetition,
    dueDate: nextDue,
  }).where(eq(cardsTable.id, body.cardId)).returning();

  await db.insert(reviewLogsTable).values({
    cardId: body.cardId,
    grade: body.grade,
  });

  const kw = await db.select().from(keywordsTable).where(eq(keywordsTable.id, updatedCard.keywordId)).limit(1);

  return res.json({
    card: {
      id: updatedCard.id,
      frontContent: updatedCard.frontContent,
      backContent: updatedCard.backContent,
      status: updatedCard.status,
      keywordId: updatedCard.keywordId,
      keyword: kw[0]?.word ?? "",
      sm2Interval: updatedCard.sm2Interval,
      sm2Repetition: updatedCard.sm2Repetition,
      sm2Efactor: updatedCard.sm2Efactor,
      dueDate: updatedCard.dueDate.toISOString(),
    },
    nextDueDate: nextDue.toISOString(),
    newInterval,
  });
});

export default router;
