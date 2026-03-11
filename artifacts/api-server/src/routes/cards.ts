import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { cardsTable, keywordsTable } from "@workspace/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import {
  GenerateCardsBody,
  ValidateCardsBatchBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

function generateCardContent(keyword: string): { front: string; back: string } {
  const templates = [
    {
      front: `请解释"${keyword}"的含义`,
      back: `"${keyword}"是指在相关领域中的一个重要概念。它描述了特定的性质、功能或关系，在理解该领域知识时起到关键作用。`,
    },
    {
      front: `"${keyword}"在实际应用中有什么作用？`,
      back: `"${keyword}"在实际应用中用于描述、解释或操作特定对象或过程。理解它有助于掌握该领域的核心原理和方法。`,
    },
    {
      front: `用简单的语言描述"${keyword}"`,
      back: `"${keyword}"可以理解为：一种特定的概念或工具，用来处理或描述某类问题。它的核心特征是其在相关情境中的独特作用。`,
    },
  ];

  const t = templates[Math.floor(Math.random() * templates.length)];
  return { front: t.front, back: t.back };
}

router.post("/generate", async (req, res) => {
  const body = GenerateCardsBody.parse(req.body);

  const keywords = await db.select().from(keywordsTable).where(
    and(
      eq(keywordsTable.documentId, body.documentId),
      inArray(keywordsTable.id, body.keywordIds)
    )
  );

  const now = new Date();
  const cardValues = keywords.map((kw) => {
    const { front, back } = generateCardContent(kw.word);
    return {
      keywordId: kw.id,
      frontContent: front,
      backContent: back,
      status: "pending_validation" as const,
      sm2Interval: 1,
      sm2Repetition: 0,
      sm2Efactor: 2.5,
      dueDate: now,
    };
  });

  const cards = await db.insert(cardsTable).values(cardValues).returning();

  const cardsWithKeywords = await Promise.all(
    cards.map(async (card) => {
      const kw = keywords.find((k) => k.id === card.keywordId);
      return {
        id: card.id,
        frontContent: card.frontContent,
        backContent: card.backContent,
        status: card.status,
        keywordId: card.keywordId,
        keyword: kw?.word ?? "",
        sm2Interval: card.sm2Interval,
        sm2Repetition: card.sm2Repetition,
        sm2Efactor: card.sm2Efactor,
        dueDate: card.dueDate.toISOString(),
      };
    })
  );

  res.json({ cards: cardsWithKeywords, total: cardsWithKeywords.length });
});

router.get("/pending", async (req, res) => {
  const documentId = req.query.documentId ? parseInt(req.query.documentId as string) : undefined;

  let cardsQuery;
  if (documentId) {
    const docKeywords = await db.select({ id: keywordsTable.id }).from(keywordsTable).where(eq(keywordsTable.documentId, documentId));
    const kwIds = docKeywords.map((k) => k.id);
    if (kwIds.length === 0) {
      return res.json({ cards: [], total: 0 });
    }
    cardsQuery = await db.select().from(cardsTable).where(
      and(
        eq(cardsTable.status, "pending_validation"),
        inArray(cardsTable.keywordId, kwIds)
      )
    );
  } else {
    cardsQuery = await db.select().from(cardsTable).where(eq(cardsTable.status, "pending_validation"));
  }

  const cardsWithKeywords = await Promise.all(
    cardsQuery.map(async (card) => {
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

  return res.json({ cards: cardsWithKeywords, total: cardsWithKeywords.length });
});

router.put("/validate/batch", async (req, res) => {
  const body = ValidateCardsBatchBody.parse(req.body);

  let kept = 0;
  let discarded = 0;

  for (const validation of body.validations) {
    if (validation.action === "discard") {
      await db.update(cardsTable).set({ status: "discarded" }).where(eq(cardsTable.id, validation.id));
      discarded++;
    } else {
      const updateData: Record<string, unknown> = { status: "active" };
      if (validation.frontContent) updateData.frontContent = validation.frontContent;
      if (validation.backContent) updateData.backContent = validation.backContent;
      await db.update(cardsTable).set(updateData).where(eq(cardsTable.id, validation.id));
      kept++;
    }
  }

  res.json({
    processed: body.validations.length,
    kept,
    discarded,
  });
});

export default router;
