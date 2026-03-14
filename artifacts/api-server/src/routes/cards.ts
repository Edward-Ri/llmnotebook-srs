import { Router, type IRouter, type Request } from "express";
import { randomUUID } from "crypto";
import { z } from "zod";
import { db } from "@workspace/db";
import {
  cardCandidatesTable,
  decksTable,
  documentsTable,
  flashcardsTable,
  keywordsTable,
  sectionsTable,
  textBlocksTable,
} from "@workspace/db/schema";
import { and, asc, eq, inArray } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { deepseekChat, type ChatMessage } from "../services/llm";

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

const GenerateCardsRequest = z.object({
  documentId: z.string().uuid(),
  keywordIds: z.array(z.string().uuid()).min(1),
});

const GetPendingCardsQuery = z.object({
  documentId: z.string().uuid().optional(),
});

const ValidateCardsBatchRequest = z.object({
  validations: z.array(z.object({
    id: z.string().uuid(),
    action: z.enum(["keep", "edit", "discard"]),
    frontContent: z.string().optional(),
    backContent: z.string().optional(),
  })).min(1),
});

const BatchAssignDeckRequest = z.object({
  assignments: z.array(z.object({
    id: z.string().uuid(),
    deckId: z.string().uuid().nullable().optional(),
  })).min(1),
});

type LlmCard = { front: string; back: string };

function parseCardsJson(raw: string): LlmCard[] {
  const trimmed = raw.trim();
  const start = trimmed.indexOf("[");
  const end = trimmed.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return [];
  try {
    const json = JSON.parse(trimmed.slice(start, end + 1));
    if (!Array.isArray(json)) return [];
    return json
      .map((item) => ({
        front: typeof item?.front === "string" ? item.front.trim() : "",
        back: typeof item?.back === "string" ? item.back.trim() : "",
      }))
      .filter((item) => item.front && item.back);
  } catch {
    return [];
  }
}

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

router.post("/generate", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    const body = GenerateCardsRequest.parse(req.body);

    const [doc] = await db
      .select({ id: documentsTable.id, title: documentsTable.title })
      .from(documentsTable)
      .where(and(eq(documentsTable.id, body.documentId), eq(documentsTable.userId, userId)))
      .limit(1);

    if (!doc) {
      return res.status(404).json({ error: "阅读材料不存在" });
    }

    const keywords = await db
      .select({
        id: keywordsTable.id,
        word: keywordsTable.word,
        sectionId: keywordsTable.sectionId,
        startBlockIndex: sectionsTable.startBlockIndex,
        endBlockIndex: sectionsTable.endBlockIndex,
      })
      .from(keywordsTable)
      .leftJoin(sectionsTable, eq(keywordsTable.sectionId, sectionsTable.id))
      .leftJoin(documentsTable, eq(sectionsTable.documentId, documentsTable.id))
      .where(
        and(
          eq(documentsTable.id, body.documentId),
          eq(documentsTable.userId, userId),
          inArray(keywordsTable.id, body.keywordIds),
        ),
      );

    if (keywords.length === 0) {
      return res.status(400).json({ error: "未找到可用关键词" });
    }

    const blocks = await db
      .select({
        positionIndex: textBlocksTable.positionIndex,
        content: textBlocksTable.content,
      })
      .from(textBlocksTable)
      .where(eq(textBlocksTable.documentId, body.documentId))
      .orderBy(asc(textBlocksTable.positionIndex));

    const blockContents = blocks.map((b) => b.content);

    const pendingRows: {
      userId: string;
      documentId: string;
      keywordId: string | null;
      frontContent: string;
      backContent: string;
      status: "pending_validation";
    }[] = [];
    const keywordByIndex: string[] = [];

    for (const kw of keywords) {
      const start = Number(kw.startBlockIndex ?? 0);
      const end = Number(kw.endBlockIndex ?? blockContents.length - 1);
      const contextBlocks = blockContents.slice(start, end + 1);
      const contextRaw = contextBlocks.join("\n\n");
      const context = contextRaw.length > 4000 ? contextRaw.slice(0, 4000) : contextRaw;

      const messages: ChatMessage[] = [
        {
          role: "system",
          content:
            "你是知识卡片生成助手。根据给定关键词与上下文，生成 2-4 张高质量记忆卡片。" +
            "仅输出严格 JSON 数组，每项包含 {\"front\":\"问题\",\"back\":\"答案\"}，不要输出其他文本。",
        },
        {
          role: "user",
          content: JSON.stringify({
            documentTitle: doc.title,
            keyword: kw.word,
            context,
          }),
        },
      ];

      const raw = await deepseekChat(messages, { temperature: 0.2 });
      const parsed = parseCardsJson(raw);
      for (const item of parsed) {
        pendingRows.push({
          userId,
          documentId: body.documentId,
          keywordId: kw.id,
          frontContent: item.front,
          backContent: item.back,
          status: "pending_validation",
        });
        keywordByIndex.push(kw.word);
      }
    }

    if (pendingRows.length === 0) {
      return res.json({ cards: [], total: 0 });
    }

    const inserted = await db
      .insert(cardCandidatesTable)
      .values(pendingRows)
      .returning({
        id: cardCandidatesTable.id,
        frontContent: cardCandidatesTable.frontContent,
        backContent: cardCandidatesTable.backContent,
        keywordId: cardCandidatesTable.keywordId,
      });

    const cards = inserted.map((row, index) => ({
      id: row.id,
      frontContent: row.frontContent,
      backContent: row.backContent,
      status: "pending_validation",
      keywordId: row.keywordId ?? "",
      keyword: keywordByIndex[index],
    }));

    return res.json({
      cards,
      total: cards.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json(error.issues);
    }
    console.error("Generate cards failed", error);
    return res.status(500).json({ error: "生成卡片失败" });
  }
});

router.get("/pending", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    const parsed = GetPendingCardsQuery.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json(parsed.error.issues);
    }
    const documentId = parsed.data.documentId;

    const conditions = [
      eq(cardCandidatesTable.userId, userId),
      eq(cardCandidatesTable.status, "pending_validation"),
    ];
    if (documentId) conditions.push(eq(cardCandidatesTable.documentId, documentId));

    const rows = await db
      .select({
        id: cardCandidatesTable.id,
        frontContent: cardCandidatesTable.frontContent,
        backContent: cardCandidatesTable.backContent,
        keywordId: cardCandidatesTable.keywordId,
        keyword: keywordsTable.word,
      })
      .from(cardCandidatesTable)
      .leftJoin(keywordsTable, eq(cardCandidatesTable.keywordId, keywordsTable.id))
      .where(and(...conditions))
      .orderBy(asc(cardCandidatesTable.createdAt));

    const cards = rows.map((row) => ({
      id: row.id,
      frontContent: row.frontContent,
      backContent: row.backContent,
      status: "pending_validation",
      keywordId: row.keywordId ?? "",
      keyword: row.keyword ?? undefined,
    }));

    return res.json({ cards, total: cards.length });
  } catch (error) {
    console.error("Get pending cards failed", error);
    return res.status(500).json({ error: "获取待校验卡片失败" });
  }
});

router.put("/validate/batch", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    const body = ValidateCardsBatchRequest.parse(req.body);

    let kept = 0;
    let discarded = 0;

    await db.transaction(async (tx) => {
      for (const item of body.validations) {
        if (item.action === "discard") {
          const result = await tx
            .update(cardCandidatesTable)
            .set({ status: "discarded" })
            .where(and(eq(cardCandidatesTable.id, item.id), eq(cardCandidatesTable.userId, userId)));
          discarded += result.rowCount ?? 0;
          continue;
        }

        const updateValues: { status: string; frontContent?: string; backContent?: string } = {
          status: "active",
        };
        if (item.action === "edit") {
          if (item.frontContent) updateValues.frontContent = item.frontContent;
          if (item.backContent) updateValues.backContent = item.backContent;
        }

        const result = await tx
          .update(cardCandidatesTable)
          .set(updateValues)
          .where(and(eq(cardCandidatesTable.id, item.id), eq(cardCandidatesTable.userId, userId)));
        kept += result.rowCount ?? 0;
      }
    });

    return res.json({
      processed: body.validations.length,
      kept,
      discarded,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json(error.issues);
    }
    console.error("Validate cards batch failed", error);
    return res.status(500).json({ error: "批量校验卡片失败" });
  }
});

router.patch("/batch-assign-deck", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    const body = BatchAssignDeckRequest.parse(req.body);

    const assignments = body.assignments.filter((item) => !!item.deckId);
    if (assignments.length === 0) {
      return res.json({ updated: 0 });
    }

    const deckIds = Array.from(new Set(assignments.map((item) => item.deckId as string)));
    const decks = await db
      .select({ id: decksTable.id })
      .from(decksTable)
      .where(and(eq(decksTable.userId, userId), inArray(decksTable.id, deckIds)));
    if (decks.length !== deckIds.length) {
      return res.status(400).json({ error: "存在无效卡片组" });
    }

    const candidateIds = assignments.map((item) => item.id);
    const candidates = await db
      .select({
        id: cardCandidatesTable.id,
        frontContent: cardCandidatesTable.frontContent,
        backContent: cardCandidatesTable.backContent,
        keywordId: cardCandidatesTable.keywordId,
        status: cardCandidatesTable.status,
      })
      .from(cardCandidatesTable)
      .where(and(eq(cardCandidatesTable.userId, userId), inArray(cardCandidatesTable.id, candidateIds)));

    const candidateById = new Map(candidates.map((c) => [c.id, c]));

    let insertedCount = 0;
    await db.transaction(async (tx) => {
      for (const assignment of assignments) {
        const candidate = candidateById.get(assignment.id);
        if (!candidate || candidate.status !== "active") continue;

        await tx.insert(flashcardsTable).values({
          deckId: assignment.deckId as string,
          frontContent: candidate.frontContent,
          backContent: candidate.backContent,
          sourceKeywordId: candidate.keywordId ?? null,
          sourceTextBlockId: null,
        });
        insertedCount += 1;

        await tx.delete(cardCandidatesTable).where(eq(cardCandidatesTable.id, candidate.id));
      }
    });

    return res.json({ updated: insertedCount });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json(error.issues);
    }
    console.error("Batch assign deck failed", error);
    return res.status(500).json({ error: "批量分配卡片组失败" });
  }
});

export default router;
