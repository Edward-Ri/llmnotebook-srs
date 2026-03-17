import { Router, type IRouter, type Request } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import {
  cardCandidatesTable,
  decksTable,
  documentsTable,
  flashcardsTable,
  keywordsTable,
  referencesTable,
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

const BatchDeleteCardsRequest = z.object({
  deckId: z.string().uuid(),
  ids: z.array(z.string().uuid()).min(1),
});

const UpdateCardRequest = z.object({
  frontContent: z.string().min(1),
  backContent: z.string().min(1),
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

const MIN_FRONT_LENGTH = 6;
const MIN_BACK_LENGTH = 8;
const MAX_FRONT_LENGTH = 200;
const MAX_BACK_LENGTH = 600;
const MAX_CARD_COUNT = 4;
const NEIGHBOR_WINDOW = 1;

function normalizeForCompare(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]/gu, "")
    .trim();
}

function isTooSimilar(front: string, back: string): boolean {
  const a = normalizeForCompare(front);
  const b = normalizeForCompare(back);
  if (!a || !b) return true;
  if (a.includes(b) || b.includes(a)) {
    const lenRatio = Math.max(a.length, b.length) / Math.min(a.length, b.length);
    if (lenRatio < 1.4) return true;
  }
  const setA = new Set(a.split(""));
  const setB = new Set(b.split(""));
  const minSize = Math.min(setA.size, setB.size);
  if (minSize === 0) return true;
  let intersection = 0;
  for (const ch of setA) {
    if (setB.has(ch)) intersection += 1;
  }
  return intersection / minSize >= 0.85;
}

function filterCards(cards: LlmCard[]): LlmCard[] {
  const seen = new Set<string>();
  const result: LlmCard[] = [];
  for (const card of cards) {
    const front = card.front.trim();
    const back = card.back.trim();
    if (
      front.length < MIN_FRONT_LENGTH ||
      back.length < MIN_BACK_LENGTH ||
      front.length > MAX_FRONT_LENGTH ||
      back.length > MAX_BACK_LENGTH
    ) {
      continue;
    }
    if (isTooSimilar(front, back)) continue;
    const key = `${normalizeForCompare(front)}||${normalizeForCompare(back)}`;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push({ front, back });
    if (result.length >= MAX_CARD_COUNT) break;
  }
  return result;
}

function findKeywordCenterIndex(
  blocks: { positionIndex: number; content: string }[],
  keyword: string,
): number | null {
  const kw = keyword.trim();
  if (!kw) return null;
  const lower = kw.toLowerCase();
  for (let i = 0; i < blocks.length; i += 1) {
    if (blocks[i].content.toLowerCase().includes(lower)) return i;
  }
  return null;
}

function buildNeighborhoodBlocks(
  blocks: { positionIndex: number; content: string }[],
  keyword: string,
  sectionStart: number,
  sectionEnd: number,
) {
  const center = findKeywordCenterIndex(blocks, keyword);
  if (center !== null) {
    const start = Math.max(0, center - NEIGHBOR_WINDOW);
    const end = Math.min(blocks.length - 1, center + NEIGHBOR_WINDOW);
    return blocks.slice(start, end + 1);
  }
  const safeStart = Math.max(0, Math.min(sectionStart, blocks.length - 1));
  const safeEnd = Math.max(safeStart, Math.min(sectionEnd, blocks.length - 1));
  const fallbackEnd = Math.min(safeStart + 2, safeEnd);
  return blocks.slice(safeStart, fallbackEnd + 1);
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
        referenceId: sectionsTable.referenceId,
        startBlockIndex: sectionsTable.startBlockIndex,
        endBlockIndex: sectionsTable.endBlockIndex,
      })
      .from(keywordsTable)
      .leftJoin(sectionsTable, eq(keywordsTable.sectionId, sectionsTable.id))
      .leftJoin(referencesTable, eq(sectionsTable.referenceId, referencesTable.id))
      .leftJoin(documentsTable, eq(referencesTable.documentId, documentsTable.id))
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

    const referenceIds = Array.from(new Set(
      keywords
        .map((keyword) => keyword.referenceId)
        .filter((referenceId): referenceId is string => Boolean(referenceId)),
    ));
    const blocks = referenceIds.length > 0
      ? await db
        .select({
          referenceId: textBlocksTable.referenceId,
          positionIndex: textBlocksTable.positionIndex,
          content: textBlocksTable.content,
        })
        .from(textBlocksTable)
        .where(inArray(textBlocksTable.referenceId, referenceIds))
        .orderBy(asc(textBlocksTable.referenceId), asc(textBlocksTable.positionIndex))
      : [];

    const blocksByReferenceId = new Map<string, { positionIndex: number; content: string }[]>();
    for (const block of blocks) {
      const list = blocksByReferenceId.get(block.referenceId) ?? [];
      list.push({
        positionIndex: block.positionIndex,
        content: block.content,
      });
      blocksByReferenceId.set(block.referenceId, list);
    }

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
      if (!kw.referenceId) continue;
      const blockContents = blocksByReferenceId.get(kw.referenceId) ?? [];
      if (blockContents.length === 0) continue;
      const start = Number(kw.startBlockIndex ?? 0);
      const end = Number(kw.endBlockIndex ?? blockContents.length - 1);
      const neighborhood = buildNeighborhoodBlocks(blockContents, kw.word, start, end);
      const contextRaw = neighborhood.map((b) => b.content).join("\n\n");
      const context = contextRaw.length > 2000 ? contextRaw.slice(0, 2000) : contextRaw;
      const contextBlocks = neighborhood.map((b) => ({
        index: b.positionIndex,
        text: b.content,
      }));

      const messages: ChatMessage[] = [
        {
          role: "system",
          content:
            "你是学习卡片生成助手。目标是生成“可复习、可编辑、单一概念”的高质量记忆卡片。" +
            "严格只输出 JSON 数组，每项必须包含：{\"front\":\"问题\",\"back\":\"答案\"}。" +
            "约束规则（必须遵守）：" +
            "1) 一张卡片只覆盖一个概念，禁止多个子问题/多点混杂。" +
            "2) 问题要具体明确，避免泛泛而谈。" +
            "3) 答案要简洁、确定，不要大段照抄上下文。" +
            "4) 若上下文不足以支撑事实，宁可不生成。" +
            "5) 生成 2-4 张卡片；若信息不足可少于 2 张。" +
            "6) 严禁输出除 JSON 以外的任何文本。",
        },
        {
          role: "user",
          content:
            "请根据以下数据生成学习卡片。只使用提供的上下文，不要引入外部知识。" +
            "输出必须是严格 JSON 数组。" +
            "数据：" +
            JSON.stringify({
              language: "zh",
              documentTitle: doc.title,
              keyword: kw.word,
              contextBlocks,
              cardCountHint: 3,
              context,
            }),
        },
      ];

      const raw = await deepseekChat(messages, { temperature: 0.2 });
      const parsed = filterCards(parseCardsJson(raw));
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
      keywordId: row.keywordId ?? null,
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
      keywordId: row.keywordId ?? null,
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

router.delete("/batch", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    const body = BatchDeleteCardsRequest.parse(req.body);

    const [deck] = await db
      .select({ id: decksTable.id })
      .from(decksTable)
      .where(and(eq(decksTable.id, body.deckId), eq(decksTable.userId, userId)))
      .limit(1);

    if (!deck) {
      return res.status(404).json({ error: "卡片组不存在" });
    }

    const result = await db
      .delete(flashcardsTable)
      .where(and(eq(flashcardsTable.deckId, body.deckId), inArray(flashcardsTable.id, body.ids)));

    return res.json({ deleted: result.rowCount ?? 0 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json(error.issues);
    }
    console.error("Batch delete cards failed", error);
    return res.status(500).json({ error: "批量删除卡片失败" });
  }
});

router.patch("/:cardId", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    const cardId = String(req.params.cardId);
    const body = UpdateCardRequest.parse(req.body);
    const frontContent = body.frontContent.trim();
    const backContent = body.backContent.trim();

    if (!frontContent || !backContent) {
      return res.status(400).json({ error: "卡片正反面内容不能为空" });
    }

    const [card] = await db
      .select({ id: flashcardsTable.id })
      .from(flashcardsTable)
      .leftJoin(decksTable, eq(flashcardsTable.deckId, decksTable.id))
      .where(and(eq(flashcardsTable.id, cardId), eq(decksTable.userId, userId)))
      .limit(1);

    if (!card) {
      return res.status(404).json({ error: "卡片不存在" });
    }

    const [updatedCard] = await db
      .update(flashcardsTable)
      .set({ frontContent, backContent })
      .where(eq(flashcardsTable.id, cardId))
      .returning({
        id: flashcardsTable.id,
        frontContent: flashcardsTable.frontContent,
        backContent: flashcardsTable.backContent,
      });

    return res.json(updatedCard);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json(error.issues);
    }
    console.error("Update card failed", error);
    return res.status(500).json({ error: "更新卡片失败" });
  }
});

router.delete("/:cardId", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    const cardId = String(req.params.cardId);

    const [card] = await db
      .select({ id: flashcardsTable.id })
      .from(flashcardsTable)
      .leftJoin(decksTable, eq(flashcardsTable.deckId, decksTable.id))
      .where(and(eq(flashcardsTable.id, cardId), eq(decksTable.userId, userId)))
      .limit(1);

    if (!card) {
      return res.status(404).json({ error: "卡片不存在" });
    }

    const result = await db.delete(flashcardsTable).where(eq(flashcardsTable.id, cardId));
    return res.json({ deleted: result.rowCount ?? 0 });
  } catch (error) {
    console.error("Delete card failed", error);
    return res.status(500).json({ error: "删除卡片失败" });
  }
});

export default router;
