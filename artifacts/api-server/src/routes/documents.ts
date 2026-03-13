import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  documentsTable,
  keywordsTable,
  cardsTable,
  textBlocksTable,
  sectionsTable,
} from "@workspace/db/schema";
import { eq, count } from "drizzle-orm";
import {
  AnalyzeDocumentBody,
  UpdateKeywordSelectionsBody,
} from "@workspace/api-zod";
import {
  buildTocTree,
  physicalChunk,
  segmentSections,
} from "../utils/physicalChunking";
import { deepseekChat, type ChatMessage } from "../services/llm";

const router: IRouter = Router();

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

router.post("/analyze", async (req, res) => {
  const body = AnalyzeDocumentBody.parse(req.body);

  const paragraphs = physicalChunk(body.content);
  const sections = segmentSections(paragraphs);
  const tocTree = buildTocTree(sections, paragraphs);

  const authUser = (req as any).authUser as { userId: number } | undefined;
  const [doc] = await db.insert(documentsTable).values({
    title: body.title || `文档 ${new Date().toLocaleDateString("zh-CN")}`,
    userId: authUser?.userId ?? null,
  }).returning();

  if (paragraphs.length > 0) {
    await db.insert(textBlocksTable).values(
      paragraphs.map((block) => ({
        documentId: doc.id,
        content: block.content,
        positionIndex: block.index,
      })),
    );
  }

  if (sections.length > 0) {
    await db.insert(sectionsTable).values(
      sections.map((section) => ({
        documentId: doc.id,
        parentSectionId: null,
        heading: null,
        startBlockIndex: section.startIndex,
        endBlockIndex: section.endIndex,
        level: 1,
      })),
    );
  }

  const sectionKeywords: { sectionIndex: number; word: string }[] = [];

  for (const section of sections) {
    const sectionBlocks = paragraphs
      .slice(section.startIndex, section.endIndex + 1)
      .map((block) => block.content);

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

    const raw = await deepseekChat(messages, { temperature: 0.2 });
    const parsed = parseKeywordJson(raw)
      .filter((item) => Number(item.score ?? 0) >= 3)
      .map((item) => item.word)
      .filter((word) => typeof word === "string" && word.trim().length > 0);

    for (const word of parsed) {
      sectionKeywords.push({ sectionIndex: section.id, word: word.trim() });
    }
  }

  const keywordRows = await db.insert(keywordsTable).values(
    sectionKeywords.map((kw) => ({
      documentId: doc.id,
      word: kw.word,
      isSelected: false,
    })),
  ).returning();

  const keywordsBySection = new Map<number, { id: number; word: string }[]>();
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
      isSelected: k.isSelected,
      documentId: k.documentId,
    })),
    toc: tocWithKeywordRefs,
  });
});

router.get("/", async (_req, res) => {
  const docs = await db.select().from(documentsTable).orderBy(documentsTable.createdAt);
  
  const result = await Promise.all(docs.map(async (doc) => {
    const kwCount = await db.select({ count: count() }).from(keywordsTable).where(eq(keywordsTable.documentId, doc.id));
    const cardCount = await db
      .select({ count: count() })
      .from(cardsTable)
      .leftJoin(keywordsTable, eq(cardsTable.keywordId, keywordsTable.id))
      .where(eq(keywordsTable.documentId, doc.id));
    return {
      id: doc.id,
      title: doc.title,
      content: "",
      createdAt: doc.createdAt.toISOString(),
      keywordCount: kwCount[0]?.count ?? 0,
      cardCount: cardCount[0]?.count ?? 0,
    };
  }));

  res.json({ documents: result });
});

router.get("/:documentId/keywords", async (req, res) => {
  const documentId = req.params.documentId;
  const keywords = await db.select().from(keywordsTable).where(eq(keywordsTable.documentId, documentId));
  res.json({
    keywords: keywords.map((k) => ({
      id: k.id,
      word: k.word,
      isSelected: k.isSelected,
      documentId: k.documentId,
    })),
  });
});

router.put("/:documentId/keywords", async (req, res) => {
  const documentId = req.params.documentId;
  const body = UpdateKeywordSelectionsBody.parse(req.body);

  const keywords = await db.select().from(keywordsTable).where(eq(keywordsTable.documentId, documentId));
  
  for (const kw of keywords) {
    await db.update(keywordsTable)
      .set({ isSelected: body.selectedIds.includes(kw.id) })
      .where(eq(keywordsTable.id, kw.id));
  }

  const updated = await db.select().from(keywordsTable).where(eq(keywordsTable.documentId, documentId));
  res.json({
    keywords: updated.map((k) => ({
      id: k.id,
      word: k.word,
      isSelected: k.isSelected,
      documentId: k.documentId,
    })),
  });
});

export default router;
