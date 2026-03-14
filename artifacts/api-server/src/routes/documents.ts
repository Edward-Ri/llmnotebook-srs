import { Router, type IRouter, type Request } from "express";
import { db } from "@workspace/db";
import {
  documentsTable,
  keywordsTable,
  textBlocksTable,
  sectionsTable,
  flashcardsTable,
} from "@workspace/db/schema";
import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import {
  UpdateKeywordSelectionsBody,
} from "@workspace/api-zod";
import {
  buildTocTree,
  physicalChunk,
  segmentSections,
} from "../utils/physicalChunking";
import { deepseekChat, type ChatMessage } from "../services/llm";
import { requireAuth } from "../middlewares/auth";
import { z } from "zod";

const router: IRouter = Router();
const getUserId = (req: Request) => (req as Request & { user: { id: string } }).user.id;

const AnalyzeDocumentRequest = z.object({
  documentId: z.string().uuid(),
  text: z.string(),
});

type LlmKeyword = { word: string; reason?: string; score?: number };

function parseKeywordJson(raw: string): LlmKeyword[] {
  const trimmed = raw.trim();
  const start = trimmed.indexOf("[");
  const end = trimmed.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return [];
  try {
    const json = JSON.parse(trimmed.slice(start, end + 1));
    return Array.isArray(json) ? json : [];
  } catch {
    return [];
  }
}

router.post("/", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  const { title } = req.body ?? {};
  const [doc] = await db.insert(documentsTable).values({
    title: typeof title === "string" && title.trim().length > 0
      ? title.trim()
      : `文档 ${new Date().toLocaleDateString("zh-CN")}`,
    userId,
  }).returning();

  return res.json({
    document: {
      id: doc.id,
      title: doc.title,
      createdAt: doc.createdAt.toISOString(),
    },
  });
});

router.post("/analyze", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    const body = AnalyzeDocumentRequest.parse(req.body);

    const [doc] = await db
      .select({ id: documentsTable.id, title: documentsTable.title })
      .from(documentsTable)
      .where(and(eq(documentsTable.id, body.documentId), eq(documentsTable.userId, userId)))
      .limit(1);

    if (!doc) {
      return res.status(404).json({ error: "DOCUMENT_NOT_FOUND" });
    }

    const paragraphs = physicalChunk(body.text);
    const sections = segmentSections(paragraphs);

    if (paragraphs.length === 0 || sections.length === 0) {
      return res.status(400).json({ error: "EMPTY_DOCUMENT" });
    }

    const tocTree = buildTocTree(sections, paragraphs);

    if (paragraphs.length > 0) {
      await db.insert(textBlocksTable).values(
        paragraphs.map((block) => ({
          documentId: doc.id,
          content: block.content,
          positionIndex: block.index,
        })),
      );
    }

    const savedSections = sections.length > 0
      ? await db.insert(sectionsTable).values(
      sections.map((section) => ({
        documentId: doc.id,
        parentSectionId: null,
        heading: null,
        startBlockIndex: section.startIndex,
        endBlockIndex: section.endIndex,
        level: 1,
      })),
    ).returning({
      id: sectionsTable.id,
      startBlockIndex: sectionsTable.startBlockIndex,
      endBlockIndex: sectionsTable.endBlockIndex,
    })
      : [];

    const sectionIdByRange = new Map<string, string>();
    for (const saved of savedSections) {
      sectionIdByRange.set(`${saved.startBlockIndex}-${saved.endBlockIndex}`, saved.id);
    }

    const sectionKeywords: { sectionIndex: number; sectionId: string; word: string }[] = [];

    for (const section of sections) {
      const sectionBlocks = paragraphs
        .slice(section.startIndex, section.endIndex + 1)
        .map((block) => block.content);

      const sectionId = sectionIdByRange.get(
        `${section.startIndex}-${section.endIndex}`,
      );
      if (!sectionId) continue;

      const messages: ChatMessage[] = [
        {
          role: "system",
          content:
            "你是知识提取专家。请根据给定标题与文本块，输出严格的 JSON 数组，" +
            "每项包含 {\"word\":\"词汇\",\"reason\":\"提取理由\",\"score\":1-5}。" +
            "仅输出 JSON，不要多余文本。",
        },
        {
          role: "user",
          content: JSON.stringify({
            title: doc.title,
            blocks: sectionBlocks,
          }),
        },
      ];

      let raw: string;
      try {
        raw = await deepseekChat(messages, { temperature: 0.2 });
      } catch (err: any) {
        throw new Error(
          `LLM_ERROR: ${err?.message ?? "DeepSeek request failed"}`,
        );
      }

      const parsed = parseKeywordJson(raw)
        .filter((item) => Number(item.score ?? 0) >= 3)
        .map((item) => item.word)
        .filter((word) => typeof word === "string" && word.trim().length > 0);

      for (const word of parsed) {
        sectionKeywords.push({
          sectionIndex: section.id,
          sectionId,
          word: word.trim(),
        });
      }
    }

    const keywordRows = sectionKeywords.length > 0
      ? await db.insert(keywordsTable).values(
      sectionKeywords.map((kw) => ({
        sectionId: kw.sectionId,
        textBlockId: null,
        word: kw.word,
        status: "PENDING",
      })),
    ).returning()
      : [];

    const keywordsBySection = new Map<number, { id: string; word: string }[]>();
    sectionKeywords.forEach((kw, index) => {
      const row = keywordRows[index];
      if (!row) return;
      const list = keywordsBySection.get(kw.sectionIndex) ?? [];
      list.push({ id: row.id, word: row.word });
      keywordsBySection.set(kw.sectionIndex, list);
    });

    const tocWithKeywordRefs = tocTree.map((node) => ({
      ...node,
      keywords: keywordsBySection.get(Number(node.id)) ?? [],
    }));

    res.json({
      documentId: doc.id,
      title: doc.title,
      keywords: keywordRows.map((k) => ({
        id: k.id,
        word: k.word,
        isSelected: k.status === "SELECTED",
        documentId: doc.id,
      })),
      toc: tocWithKeywordRefs,
    });
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error("Analyze failed:", err);
    const message = err?.message ?? "Unknown error";
    if (typeof message === "string" && message.startsWith("LLM_ERROR:")) {
      res.status(502).json({
        error: "LLM_ERROR",
        message: message.replace("LLM_ERROR:", "").trim(),
      });
      return;
    }
    res.status(500).json({
      error: "ANALYZE_ERROR",
      message,
    });
  }
});

router.get("/", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  const docs = await db
    .select()
    .from(documentsTable)
    .where(eq(documentsTable.userId, userId))
    .orderBy(desc(documentsTable.createdAt));

  const docIds = docs.map((doc) => doc.id);
  const blocks = docIds.length > 0
    ? await db
      .select({
        documentId: textBlocksTable.documentId,
        content: textBlocksTable.content,
        positionIndex: textBlocksTable.positionIndex,
      })
      .from(textBlocksTable)
      .where(inArray(textBlocksTable.documentId, docIds))
      .orderBy(asc(textBlocksTable.documentId), asc(textBlocksTable.positionIndex))
    : [];

  const contentByDoc = new Map<string, string>();
  for (const block of blocks) {
    const prev = contentByDoc.get(block.documentId) ?? "";
    const next = prev.length > 0 ? `${prev}\n\n${block.content}` : block.content;
    contentByDoc.set(block.documentId, next);
  }

  const result = await Promise.all(docs.map(async (doc) => {
    const kwCount = await db
      .select({ count: count() })
      .from(keywordsTable)
      .leftJoin(sectionsTable, eq(keywordsTable.sectionId, sectionsTable.id))
      .where(eq(sectionsTable.documentId, doc.id));
    const cardCount = await db
      .select({ count: count() })
      .from(flashcardsTable)
      .leftJoin(keywordsTable, eq(flashcardsTable.sourceKeywordId, keywordsTable.id))
      .leftJoin(sectionsTable, eq(keywordsTable.sectionId, sectionsTable.id))
      .where(eq(sectionsTable.documentId, doc.id));
    return {
      id: doc.id,
      title: doc.title,
      content: contentByDoc.get(doc.id) ?? "",
      createdAt: doc.createdAt.toISOString(),
      keywordCount: kwCount[0]?.count ?? 0,
      cardCount: cardCount[0]?.count ?? 0,
    };
  }));

  res.json({ documents: result });
});

router.delete("/:documentId", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    const documentId = req.params.documentId;

    const [doc] = await db
      .select({ id: documentsTable.id })
      .from(documentsTable)
      .where(and(eq(documentsTable.id, documentId), eq(documentsTable.userId, userId)))
      .limit(1);

    if (!doc) {
      return res.status(404).json({ error: "阅读材料不存在" });
    }

    await db.delete(documentsTable).where(eq(documentsTable.id, documentId));
    return res.json({ ok: true });
  } catch (error) {
    console.error("Delete document failed", error);
    return res.status(500).json({ error: "删除阅读材料失败" });
  }
});

router.get("/:documentId/keywords", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  const documentId = req.params.documentId;
  const keywords = await db
    .select()
    .from(keywordsTable)
    .leftJoin(sectionsTable, eq(keywordsTable.sectionId, sectionsTable.id))
    .leftJoin(documentsTable, eq(sectionsTable.documentId, documentsTable.id))
    .where(
      and(
        eq(sectionsTable.documentId, documentId),
        eq(documentsTable.userId, userId),
      ),
    );
  res.json({
    keywords: keywords.map((row) => ({
      id: row.keywords.id,
      word: row.keywords.word,
      isSelected: row.keywords.status === "SELECTED",
      documentId: row.sections?.documentId,
    })),
  });
});

router.put("/:documentId/keywords", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  const documentId = req.params.documentId;
  const body = UpdateKeywordSelectionsBody.parse(req.body);

    const keywords = await db
      .select({ id: keywordsTable.id })
      .from(keywordsTable)
      .leftJoin(sectionsTable, eq(keywordsTable.sectionId, sectionsTable.id))
      .leftJoin(documentsTable, eq(sectionsTable.documentId, documentsTable.id))
      .where(
        and(
          eq(sectionsTable.documentId, documentId),
          eq(documentsTable.userId, userId),
        ),
      );

    for (const kw of keywords) {
      await db.update(keywordsTable)
        .set({ status: body.selectedIds.includes(kw.id) ? "SELECTED" : "PENDING" })
        .where(eq(keywordsTable.id, kw.id));
    }

  const updated = await db
    .select()
    .from(keywordsTable)
    .leftJoin(sectionsTable, eq(keywordsTable.sectionId, sectionsTable.id))
    .leftJoin(documentsTable, eq(sectionsTable.documentId, documentsTable.id))
    .where(
      and(
        eq(sectionsTable.documentId, documentId),
        eq(documentsTable.userId, userId),
      ),
    );
  res.json({
    keywords: updated.map((row) => ({
      id: row.keywords.id,
      word: row.keywords.word,
      isSelected: row.keywords.status === "SELECTED",
      documentId: row.sections?.documentId,
    })),
  });
});

export default router;
