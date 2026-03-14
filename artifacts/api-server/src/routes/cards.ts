import { Router, type IRouter, type Request } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { decksTable, flashcardsTable } from "@workspace/db/schema";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

const getUserId = (req: Request) => (req as Request & { user: { id: string } }).user.id;

const BatchCreateCardsRequest = z.object({
  deckId: z.string().uuid(),
  cards: z.array(z.object({
    front: z.string().min(1),
    back: z.string().min(1),
    sourceKeywordId: z.string().uuid().optional(),
    sourceTextBlockId: z.string().uuid().optional(),
  })).min(1),
});

router.post("/batch", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    const body = BatchCreateCardsRequest.parse(req.body);

    const [deck] = await db
      .select({ id: decksTable.id })
      .from(decksTable)
      .where(and(eq(decksTable.id, body.deckId), eq(decksTable.userId, userId)))
      .limit(1);

    if (!deck) {
      return res.status(404).json({ error: "卡片组不存在" });
    }

    const inserted = await db
      .insert(flashcardsTable)
      .values(
        body.cards.map((card) => ({
          deckId: body.deckId,
          frontContent: card.front,
          backContent: card.back,
          sourceKeywordId: card.sourceKeywordId ?? null,
          sourceTextBlockId: card.sourceTextBlockId ?? null,
        })),
      )
      .returning({ id: flashcardsTable.id });

    return res.status(201).json({ inserted: inserted.length });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json(error.issues);
    }
    console.error("Batch create cards failed", error);
    return res.status(500).json({ error: "批量保存卡片失败" });
  }
});

router.all(["/generate", "/pending", "/validate/batch", "/batch-assign-deck"], (_req, res) => {
  res.status(501).json({
    error: "NOT_IMPLEMENTED",
    message: "Cards endpoints are deprecated in the SQL-new schema. Use flashcards instead.",
  });
});

export default router;
