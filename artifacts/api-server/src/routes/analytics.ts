import { Router, type IRouter, type Request } from "express";
import { db } from "@workspace/db";
import { decksTable, flashcardsTable, reviewLogsTable } from "@workspace/db/schema";
import { and, count, desc, eq, gte, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

const getUserId = (req: Request) => (req as Request & { user: { id: string } }).user.id;

router.get("/heatmap", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - 364);
    start.setHours(0, 0, 0, 0);

    const rows = await db
      .select({
        day: sql<string>`date(${reviewLogsTable.createdAt})`,
        count: sql<number>`count(*)`,
      })
      .from(reviewLogsTable)
      .where(and(eq(reviewLogsTable.userId, userId), gte(reviewLogsTable.createdAt, start)))
      .groupBy(sql`date(${reviewLogsTable.createdAt})`)
      .orderBy(sql`date(${reviewLogsTable.createdAt})`);

    const data = rows.map((row) => ({
      date: row.day,
      count: Number(row.count ?? 0),
    }));

    return res.json({ data });
  } catch (error) {
    console.error("Get heatmap failed", error);
    return res.status(500).json({ error: "获取热力图数据失败" });
  }
});

router.get("/summary", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);

    const [{ totalCards }] = await db
      .select({
        totalCards: count(flashcardsTable.id),
      })
      .from(flashcardsTable)
      .leftJoin(decksTable, eq(flashcardsTable.deckId, decksTable.id))
      .where(eq(decksTable.userId, userId));

    const [{ totalReviews, avgGrade, successReviews }] = await db
      .select({
        totalReviews: count(reviewLogsTable.id),
        avgGrade: sql<number>`avg(${reviewLogsTable.grade})`,
        successReviews: sql<number>`sum(case when ${reviewLogsTable.grade} >= 3 then 1 else 0 end)`,
      })
      .from(reviewLogsTable)
      .where(eq(reviewLogsTable.userId, userId));

    const dayRows = await db
      .select({
        day: sql<string>`date(${reviewLogsTable.createdAt})`,
      })
      .from(reviewLogsTable)
      .where(eq(reviewLogsTable.userId, userId))
      .groupBy(sql`date(${reviewLogsTable.createdAt})`)
      .orderBy(desc(sql`date(${reviewLogsTable.createdAt})`));

    const daySet = new Set(dayRows.map((row) => row.day));
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    let streak = 0;
    if (daySet.has(todayStr)) {
      streak = 1;
      const cursor = new Date(today);
      while (true) {
        cursor.setDate(cursor.getDate() - 1);
        const dayStr = cursor.toISOString().slice(0, 10);
        if (!daySet.has(dayStr)) break;
        streak += 1;
      }
    }

    const totalReviewsNum = Number(totalReviews ?? 0);
    const successReviewsNum = Number(successReviews ?? 0);
    const retentionRate =
      totalReviewsNum > 0 ? successReviewsNum / totalReviewsNum : 0;
    const averageGrade =
      avgGrade === null || avgGrade === undefined ? 0 : Number(avgGrade);

    return res.json({
      retentionRate,
      activeCards: Number(totalCards ?? 0),
      totalReviews: totalReviewsNum,
      streak,
      averageGrade,
    });
  } catch (error) {
    console.error("Get summary failed", error);
    return res.status(500).json({ error: "获取统计摘要失败" });
  }
});

export default router;
