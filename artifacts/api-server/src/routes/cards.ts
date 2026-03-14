import { Router, type IRouter, type Request } from "express";
import { randomUUID } from "crypto";
import { z } from "zod";
import { db } from "@workspace/db";
import {
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

    const cards: {
      id: string;
      frontContent: string;
      backContent: string;
      status: "pending_validation";
      keywordId: string;
      keyword: string;
    }[] = [];

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
        cards.push({
          id: randomUUID(),
          frontContent: item.front,
          backContent: item.back,
          status: "pending_validation",
          keywordId: kw.id,
          keyword: kw.word,
        });
      }
    }

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

router.all(["/generate", "/pending", "/validate/batch", "/batch-assign-deck"], (_req, res) => {
  res.status(501).json({
    error: "NOT_IMPLEMENTED",
    message: "Cards endpoints are deprecated in the SQL-new schema. Use flashcards instead.",
  });
});

export default router;
