import { Router, type IRouter, type Request } from "express";
import { db } from "@workspace/db";
import {
  documentsTable,
  flashcardsTable,
  keywordsTable,
  referencesTable,
  sectionsTable,
  textBlocksTable,
} from "@workspace/db/schema";
import { UpdateKeywordSelectionsBody } from "@workspace/api-zod";
import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { buildTocFromStoredSections } from "../services/referenceParser";

const router: IRouter = Router();

const getUserId = (req: Request) => (req as Request & { user: { id: string } }).user.id;
const getSingleParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

async function findOwnedDocument(documentId: string, userId: string) {
  const [doc] = await db
    .select({ id: documentsTable.id, title: documentsTable.title })
    .from(documentsTable)
    .where(and(eq(documentsTable.id, documentId), eq(documentsTable.userId, userId)))
    .limit(1);

  return doc ?? null;
}

router.post("/", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  const { title } = req.body ?? {};
  const [doc] = await db.insert(documentsTable).values({
    title: typeof title === "string" && title.trim().length > 0
      ? title.trim()
      : "未命名阅读材料",
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

router.post("/analyze", requireAuth, async (_req, res) => {
  return res.status(410).json({
    error: "DOCUMENT_ANALYZE_DEPRECATED",
    message: "请改用 POST /api/documents/:documentId/references",
  });
});

router.get("/", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  const docs = await db
    .select()
    .from(documentsTable)
    .where(eq(documentsTable.userId, userId))
    .orderBy(desc(documentsTable.createdAt));

  const docIds = docs.map((doc) => doc.id);
  const references = docIds.length > 0
    ? await db
      .select({
        id: referencesTable.id,
        documentId: referencesTable.documentId,
        createdAt: referencesTable.createdAt,
      })
      .from(referencesTable)
      .where(inArray(referencesTable.documentId, docIds))
      .orderBy(asc(referencesTable.createdAt))
    : [];

  const referenceIds = references.map((reference) => reference.id);
  const blocks = referenceIds.length > 0
    ? await db
      .select({
        referenceId: textBlocksTable.referenceId,
        content: textBlocksTable.content,
        positionIndex: textBlocksTable.positionIndex,
      })
      .from(textBlocksTable)
      .where(inArray(textBlocksTable.referenceId, referenceIds))
      .orderBy(asc(textBlocksTable.referenceId), asc(textBlocksTable.positionIndex))
    : [];

  const blockContentByReferenceId = new Map<string, string>();
  for (const block of blocks) {
    const prev = blockContentByReferenceId.get(block.referenceId) ?? "";
    const next = prev.length > 0 ? `${prev}\n\n${block.content}` : block.content;
    blockContentByReferenceId.set(block.referenceId, next);
  }

  const contentByDoc = new Map<string, string>();
  for (const reference of references) {
    const referenceContent = blockContentByReferenceId.get(reference.id);
    if (!referenceContent) continue;
    const prev = contentByDoc.get(reference.documentId) ?? "";
    const next = prev.length > 0 ? `${prev}\n\n${referenceContent}` : referenceContent;
    contentByDoc.set(reference.documentId, next);
  }

  const keywordCounts = docIds.length > 0
    ? await db
      .select({
        documentId: referencesTable.documentId,
        count: count(keywordsTable.id),
      })
      .from(referencesTable)
      .leftJoin(sectionsTable, eq(sectionsTable.referenceId, referencesTable.id))
      .leftJoin(keywordsTable, eq(keywordsTable.sectionId, sectionsTable.id))
      .where(inArray(referencesTable.documentId, docIds))
      .groupBy(referencesTable.documentId)
    : [];

  const cardCounts = docIds.length > 0
    ? await db
      .select({
        documentId: referencesTable.documentId,
        count: count(flashcardsTable.id),
      })
      .from(flashcardsTable)
      .leftJoin(keywordsTable, eq(flashcardsTable.sourceKeywordId, keywordsTable.id))
      .leftJoin(sectionsTable, eq(keywordsTable.sectionId, sectionsTable.id))
      .leftJoin(referencesTable, eq(sectionsTable.referenceId, referencesTable.id))
      .where(inArray(referencesTable.documentId, docIds))
      .groupBy(referencesTable.documentId)
    : [];

  const keywordCountByDocId = new Map(keywordCounts.map((row) => [row.documentId, Number(row.count ?? 0)]));
  const cardCountByDocId = new Map(cardCounts.map((row) => [row.documentId, Number(row.count ?? 0)]));

  return res.json({
    documents: docs.map((doc) => ({
      id: doc.id,
      title: doc.title,
      content: contentByDoc.get(doc.id) ?? "",
      createdAt: doc.createdAt.toISOString(),
      keywordCount: keywordCountByDocId.get(doc.id) ?? 0,
      cardCount: cardCountByDocId.get(doc.id) ?? 0,
    })),
  });
});

router.get("/:documentId/outline", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  const documentId = getSingleParam(req.params.documentId);
  if (!documentId) {
    return res.status(400).json({ error: "DOCUMENT_ID_REQUIRED" });
  }

  const doc = await findOwnedDocument(documentId, userId);
  if (!doc) {
    return res.status(404).json({ error: "DOCUMENT_NOT_FOUND" });
  }

  const references = await db
    .select({
      id: referencesTable.id,
      title: referencesTable.title,
      createdAt: referencesTable.createdAt,
    })
    .from(referencesTable)
    .where(and(eq(referencesTable.documentId, documentId), eq(referencesTable.userId, userId)))
    .orderBy(asc(referencesTable.createdAt));

  if (references.length === 0) {
    return res.json({ documentId, toc: [] });
  }

  const referenceIds = references.map((reference) => reference.id);
  const sections = await db
    .select({
      id: sectionsTable.id,
      referenceId: sectionsTable.referenceId,
      parentSectionId: sectionsTable.parentSectionId,
      heading: sectionsTable.heading,
      startBlockIndex: sectionsTable.startBlockIndex,
      endBlockIndex: sectionsTable.endBlockIndex,
    })
    .from(sectionsTable)
    .where(inArray(sectionsTable.referenceId, referenceIds))
    .orderBy(asc(sectionsTable.level), asc(sectionsTable.startBlockIndex), asc(sectionsTable.endBlockIndex));

  const sectionIds = sections.map((section) => section.id);
  const keywords = sectionIds.length > 0
    ? await db
      .select({
        id: keywordsTable.id,
        sectionId: keywordsTable.sectionId,
        word: keywordsTable.word,
      })
      .from(keywordsTable)
      .where(inArray(keywordsTable.sectionId, sectionIds))
      .orderBy(asc(keywordsTable.word))
    : [];

  const sectionsByReferenceId = new Map<string, typeof sections>();
  const sectionById = new Map(sections.map((section) => [section.id, section]));
  for (const section of sections) {
    const list = sectionsByReferenceId.get(section.referenceId) ?? [];
    list.push(section);
    sectionsByReferenceId.set(section.referenceId, list);
  }

  const keywordsByReferenceId = new Map<string, typeof keywords>();
  for (const keyword of keywords) {
    const section = sectionById.get(keyword.sectionId);
    if (!section) continue;
    const list = keywordsByReferenceId.get(section.referenceId) ?? [];
    list.push(keyword);
    keywordsByReferenceId.set(section.referenceId, list);
  }

  const toc = references.map((reference) => {
    const children = buildTocFromStoredSections(
      sectionsByReferenceId.get(reference.id) ?? [],
      keywordsByReferenceId.get(reference.id) ?? [],
    );
    const endIndex = children.reduce((max, child) => Math.max(max, child.endIndex), 0);
    return {
      id: `reference:${reference.id}`,
      title: reference.title,
      startIndex: 0,
      endIndex,
      children,
      keywords: [],
    };
  });

  return res.json({ documentId, toc });
});

router.delete("/:documentId", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    const documentId = getSingleParam(req.params.documentId);
    if (!documentId) {
      return res.status(400).json({ error: "DOCUMENT_ID_REQUIRED" });
    }

    const doc = await findOwnedDocument(documentId, userId);
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
  const documentId = getSingleParam(req.params.documentId);
  if (!documentId) {
    return res.status(400).json({ error: "DOCUMENT_ID_REQUIRED" });
  }

  const doc = await findOwnedDocument(documentId, userId);
  if (!doc) {
    return res.status(404).json({ error: "DOCUMENT_NOT_FOUND" });
  }

  const rows = await db
    .select({
      id: keywordsTable.id,
      word: keywordsTable.word,
      status: keywordsTable.status,
      sectionId: keywordsTable.sectionId,
      startBlockIndex: sectionsTable.startBlockIndex,
      documentId: referencesTable.documentId,
    })
    .from(keywordsTable)
    .leftJoin(sectionsTable, eq(keywordsTable.sectionId, sectionsTable.id))
    .leftJoin(referencesTable, eq(sectionsTable.referenceId, referencesTable.id))
    .where(
      and(
        eq(referencesTable.documentId, documentId),
        eq(referencesTable.userId, userId),
      ),
    )
    .orderBy(asc(sectionsTable.startBlockIndex), asc(keywordsTable.word));

  return res.json({
    keywords: rows.map((row) => ({
      id: row.id,
      word: row.word,
      isSelected: row.status === "SELECTED",
      documentId: row.documentId,
      sectionId: row.sectionId,
    })),
  });
});

router.put("/:documentId/keywords", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  const documentId = getSingleParam(req.params.documentId);
  if (!documentId) {
    return res.status(400).json({ error: "DOCUMENT_ID_REQUIRED" });
  }

  const doc = await findOwnedDocument(documentId, userId);
  if (!doc) {
    return res.status(404).json({ error: "DOCUMENT_NOT_FOUND" });
  }

  const body = UpdateKeywordSelectionsBody.parse(req.body);
  const keywords = await db
    .select({ id: keywordsTable.id })
    .from(keywordsTable)
    .leftJoin(sectionsTable, eq(keywordsTable.sectionId, sectionsTable.id))
    .leftJoin(referencesTable, eq(sectionsTable.referenceId, referencesTable.id))
    .where(
      and(
        eq(referencesTable.documentId, documentId),
        eq(referencesTable.userId, userId),
      ),
    );

  for (const keyword of keywords) {
    await db.update(keywordsTable)
      .set({ status: body.selectedIds.includes(keyword.id) ? "SELECTED" : "PENDING" })
      .where(eq(keywordsTable.id, keyword.id));
  }

  const updated = await db
    .select({
      id: keywordsTable.id,
      word: keywordsTable.word,
      status: keywordsTable.status,
      sectionId: keywordsTable.sectionId,
      documentId: referencesTable.documentId,
      startBlockIndex: sectionsTable.startBlockIndex,
    })
    .from(keywordsTable)
    .leftJoin(sectionsTable, eq(keywordsTable.sectionId, sectionsTable.id))
    .leftJoin(referencesTable, eq(sectionsTable.referenceId, referencesTable.id))
    .where(
      and(
        eq(referencesTable.documentId, documentId),
        eq(referencesTable.userId, userId),
      ),
    )
    .orderBy(asc(sectionsTable.startBlockIndex), asc(keywordsTable.word));

  return res.json({
    keywords: updated.map((row) => ({
      id: row.id,
      word: row.word,
      isSelected: row.status === "SELECTED",
      documentId: row.documentId,
      sectionId: row.sectionId,
    })),
  });
});

export default router;
