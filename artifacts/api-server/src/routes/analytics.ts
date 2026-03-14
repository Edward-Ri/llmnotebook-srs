import { Router, type IRouter, type Request } from "express";
import { db } from "@workspace/db";
import { reviewLogsTable } from "@workspace/db/schema";
import { and, eq, gte, sql } from "drizzle-orm";
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

export default router;
