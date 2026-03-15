import { Router, type IRouter, type Request } from "express";
import { db } from "@workspace/db";
import { decksTable, flashcardsTable, reviewLogsTable } from "@workspace/db/schema";
import { and, count, eq, gte, gt, lt, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { getLocalDayBounds, resolveTzOffsetMinutes, toLocalDateKey } from "../utils/timezone";

const router: IRouter = Router();

const getUserId = (req: Request) => (req as Request & { user: { id: string } }).user.id;
const DAY_MS = 24 * 60 * 60 * 1000;

const previousDateKey = (dateKey: string) => {
  const d = new Date(`${dateKey}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

router.get("/heatmap", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    const tzOffsetMinutes = resolveTzOffsetMinutes(req);
    const { dayStartUtc, nextDayStartUtc } = getLocalDayBounds(new Date(), tzOffsetMinutes);
    const start = new Date(dayStartUtc.getTime() - 364 * DAY_MS);

    const rows = await db
      .select({
        createdAt: reviewLogsTable.createdAt,
      })
      .from(reviewLogsTable)
      .where(
        and(
          eq(reviewLogsTable.userId, userId),
          gte(reviewLogsTable.createdAt, start),
          lt(reviewLogsTable.createdAt, nextDayStartUtc),
        ),
      );

    const grouped = new Map<string, number>();
    rows.forEach((row) => {
      const key = toLocalDateKey(row.createdAt, tzOffsetMinutes);
      grouped.set(key, (grouped.get(key) ?? 0) + 1);
    });

    const data = Array.from(grouped.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => ({ date, count: value }));

    return res.json({ data });
  } catch (error) {
    console.error("Get heatmap failed", error);
    return res.status(500).json({ error: "获取热力图数据失败" });
  }
});

router.get("/summary", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    const tzOffsetMinutes = resolveTzOffsetMinutes(req);
    const { dayStartUtc, nextDayStartUtc } = getLocalDayBounds(new Date(), tzOffsetMinutes);

    const [{ totalCards = 0 }] = await db
      .select({
        totalCards: count(flashcardsTable.id),
      })
      .from(flashcardsTable)
      .leftJoin(decksTable, eq(flashcardsTable.deckId, decksTable.id))
      .where(eq(decksTable.userId, userId));

    const [{ totalReviews = 0, avgGrade, successReviews = 0 }] = await db
      .select({
        totalReviews: count(reviewLogsTable.id),
        avgGrade: sql<number>`avg(${reviewLogsTable.grade})`,
        successReviews: sql<number>`sum(case when ${reviewLogsTable.grade} >= 3 then 1 else 0 end)`,
      })
      .from(reviewLogsTable)
      .where(eq(reviewLogsTable.userId, userId));

    const [{ todayReviews = 0 }] = await db
      .select({
        todayReviews: count(reviewLogsTable.id),
      })
      .from(reviewLogsTable)
      .where(
        and(
          eq(reviewLogsTable.userId, userId),
          gte(reviewLogsTable.createdAt, dayStartUtc),
          lt(reviewLogsTable.createdAt, nextDayStartUtc),
        ),
      );

    const [{ dueToday = 0 }] = await db
      .select({
        dueToday: count(flashcardsTable.id),
      })
      .from(flashcardsTable)
      .leftJoin(decksTable, eq(flashcardsTable.deckId, decksTable.id))
      .where(
        and(
          eq(decksTable.userId, userId),
          gt(flashcardsTable.interval, 0),
          lt(flashcardsTable.nextReviewDate, nextDayStartUtc),
        ),
      );

    const dayRows = await db
      .select({
        createdAt: reviewLogsTable.createdAt,
      })
      .from(reviewLogsTable)
      .where(eq(reviewLogsTable.userId, userId))
      .orderBy(reviewLogsTable.createdAt);

    const daySet = new Set(dayRows.map((row) => toLocalDateKey(row.createdAt, tzOffsetMinutes)));
    const todayStr = toLocalDateKey(new Date(), tzOffsetMinutes);
    let streak = 0;
    let cursor = todayStr;
    while (daySet.has(cursor)) {
      streak += 1;
      cursor = previousDateKey(cursor);
    }

    const totalReviewsNum = Number(totalReviews ?? 0);
    const successReviewsNum = Number(successReviews ?? 0);
    const retentionRate =
      totalReviewsNum > 0 ? successReviewsNum / totalReviewsNum : 0;
    const averageGrade =
      avgGrade === null || avgGrade === undefined ? 0 : Number(avgGrade);

    return res.json({
      totalCards: Number(totalCards ?? 0),
      retentionRate,
      activeCards: Number(totalCards ?? 0),
      totalReviews: totalReviewsNum,
      todayReviews: Number(todayReviews ?? 0),
      streak,
      dueToday: Number(dueToday ?? 0),
      averageGrade,
    });
  } catch (error) {
    console.error("Get summary failed", error);
    return res.status(500).json({ error: "获取统计摘要失败" });
  }
});

export default router;
