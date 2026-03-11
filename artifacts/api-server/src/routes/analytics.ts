import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { cardsTable, reviewLogsTable } from "@workspace/db/schema";
import { eq, count, gte, lte, and } from "drizzle-orm";

const router: IRouter = Router();

router.get("/summary", async (_req, res) => {
  const now = new Date();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [totalCards] = await db.select({ count: count() }).from(cardsTable);
  const [activeCards] = await db.select({ count: count() }).from(cardsTable).where(eq(cardsTable.status, "active"));
  const [totalReviews] = await db.select({ count: count() }).from(reviewLogsTable);
  const [todayReviews] = await db.select({ count: count() }).from(reviewLogsTable).where(
    gte(reviewLogsTable.createdAt, todayStart)
  );

  const dueCards = await db.select({ count: count() }).from(cardsTable).where(
    and(
      eq(cardsTable.status, "active"),
      lte(cardsTable.dueDate, now)
    )
  );

  const allReviews = await db.select().from(reviewLogsTable);
  const retentionRate = allReviews.length > 0
    ? allReviews.filter(r => r.grade >= 2).length / allReviews.length
    : 0;

  const streakDays = await calculateStreak();

  res.json({
    totalCards: totalCards.count,
    activeCards: activeCards.count,
    totalReviews: totalReviews.count,
    todayReviews: todayReviews.count,
    retentionRate: Math.round(retentionRate * 100),
    streak: streakDays,
    dueToday: dueCards[0]?.count ?? 0,
  });
});

async function calculateStreak(): Promise<number> {
  const logs = await db.select({ createdAt: reviewLogsTable.createdAt }).from(reviewLogsTable).orderBy(reviewLogsTable.createdAt);
  
  if (logs.length === 0) return 0;

  const dates = new Set(logs.map(l => {
    const d = new Date(l.createdAt);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }));

  let streak = 0;
  const today = new Date();
  
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (dates.has(key)) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

router.get("/heatmap", async (_req, res) => {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const logs = await db.select({ createdAt: reviewLogsTable.createdAt }).from(reviewLogsTable).where(
    gte(reviewLogsTable.createdAt, sixMonthsAgo)
  );

  const countByDate: Map<string, number> = new Map();
  for (const log of logs) {
    const d = new Date(log.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    countByDate.set(key, (countByDate.get(key) || 0) + 1);
  }

  const data = Array.from(countByDate.entries()).map(([date, count]) => ({ date, count }));
  data.sort((a, b) => a.date.localeCompare(b.date));

  res.json({ data });
});

export default router;
