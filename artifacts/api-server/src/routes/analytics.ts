import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { reviewLogsTable } from "@workspace/db/schema";
import { gte } from "drizzle-orm";

const router: IRouter = Router();

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
