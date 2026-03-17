import { Router, type IRouter, type Request } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import {
  documentsTable,
  keywordsTable,
  referencesTable,
  sectionsTable,
  textBlocksTable,
} from "@workspace/db/schema";
import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { buildTocFromStoredSections, parseReferenceContent } from "../services/referenceParser";

const router: IRouter = Router();

const getUserId = (req: Request) => (req as Request & { user: { id: string } }).user.id;
const getSingleParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const ImportReferenceRequest = z.object({
  title: z.string().trim().min(1).max(255),
  text: z.string().min(1),
});

async function findOwnedDocument(documentId: string, userId: string) {
  const [doc] = await db
    .select({ id: documentsTable.id, title: documentsTable.title })
    .from(documentsTable)
    .where(and(eq(documentsTable.id, documentId), eq(documentsTable.userId, userId)))
    .limit(1);

  return doc ?? null;
}

async function findOwnedReference(referenceId: string, userId: string) {
  const [reference] = await db
    .select({
      id: referencesTable.id,
      documentId: referencesTable.documentId,
      userId: referencesTable.userId,
      title: referencesTable.title,
      createdAt: referencesTable.createdAt,
    })
    .from(referencesTable)
    .where(and(eq(referencesTable.id, referenceId), eq(referencesTable.userId, userId)))
    .limit(1);

  return reference ?? null;
}

router.post("/documents/:documentId/references", requireAuth, async (req, res) => {
  let createdReferenceId: string | null = null;

  try {
    const userId = getUserId(req);
    const documentId = getSingleParam(req.params.documentId);
    if (!documentId) {
      return res.status(400).json({ error: "DOCUMENT_ID_REQUIRED" });
    }

    const doc = await findOwnedDocument(documentId, userId);
    if (!doc) {
      return res.status(404).json({ error: "DOCUMENT_NOT_FOUND" });
    }

    const body = ImportReferenceRequest.parse(req.body);
    const [reference] = await db.insert(referencesTable).values({
      documentId,
      userId,
      title: body.title,
    }).returning({
      id: referencesTable.id,
      documentId: referencesTable.documentId,
      title: referencesTable.title,
      createdAt: referencesTable.createdAt,
    });

    createdReferenceId = reference.id;
    const parsed = await parseReferenceContent({
      referenceId: reference.id,
      title: reference.title,
      text: body.text,
    });

    return res.status(201).json({
      reference: {
        id: reference.id,
        documentId: reference.documentId,
        title: reference.title,
        createdAt: reference.createdAt.toISOString(),
      },
      tocSource: parsed.tocSource,
      toc: parsed.toc,
      keywords: parsed.keywords,
    });
  } catch (error) {
    if (createdReferenceId) {
      await db.delete(referencesTable).where(eq(referencesTable.id, createdReferenceId));
    }

    if (error instanceof z.ZodError) {
      return res.status(400).json(error.issues);
    }

    console.error("Import reference failed", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.startsWith("LLM_ERROR:")) {
      return res.status(502).json({
        error: "LLM_ERROR",
        message: message.replace("LLM_ERROR:", "").trim(),
      });
    }
    if (message === "EMPTY_DOCUMENT") {
      return res.status(400).json({ error: "EMPTY_DOCUMENT" });
    }
    return res.status(500).json({ error: "REFERENCE_IMPORT_FAILED", message });
  }
});

router.get("/documents/:documentId/references", requireAuth, async (req, res) => {
  try {
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
      .orderBy(desc(referencesTable.createdAt));

    const referenceIds = references.map((reference) => reference.id);
    const textBlockCounts = referenceIds.length > 0
      ? await db
        .select({
          referenceId: textBlocksTable.referenceId,
          count: count(textBlocksTable.id),
        })
        .from(textBlocksTable)
        .where(inArray(textBlocksTable.referenceId, referenceIds))
        .groupBy(textBlocksTable.referenceId)
      : [];

    const keywordCounts = referenceIds.length > 0
      ? await db
        .select({
          referenceId: sectionsTable.referenceId,
          count: count(keywordsTable.id),
        })
        .from(sectionsTable)
        .leftJoin(keywordsTable, eq(keywordsTable.sectionId, sectionsTable.id))
        .where(inArray(sectionsTable.referenceId, referenceIds))
        .groupBy(sectionsTable.referenceId)
      : [];

    const textBlockCountByReferenceId = new Map(
      textBlockCounts.map((row) => [row.referenceId, Number(row.count ?? 0)]),
    );
    const keywordCountByReferenceId = new Map(
      keywordCounts.map((row) => [row.referenceId, Number(row.count ?? 0)]),
    );

    return res.json({
      references: references.map((reference) => ({
        id: reference.id,
        title: reference.title,
        createdAt: reference.createdAt.toISOString(),
        textBlockCount: textBlockCountByReferenceId.get(reference.id) ?? 0,
        keywordCount: keywordCountByReferenceId.get(reference.id) ?? 0,
      })),
    });
  } catch (error) {
    console.error("List references failed", error);
    return res.status(500).json({ error: "获取参考材料失败" });
  }
});

router.get("/references/:referenceId/outline", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    const referenceId = getSingleParam(req.params.referenceId);
    if (!referenceId) {
      return res.status(400).json({ error: "REFERENCE_ID_REQUIRED" });
    }

    const reference = await findOwnedReference(referenceId, userId);
    if (!reference) {
      return res.status(404).json({ error: "REFERENCE_NOT_FOUND" });
    }

    const sections = await db
      .select({
        id: sectionsTable.id,
        parentSectionId: sectionsTable.parentSectionId,
        heading: sectionsTable.heading,
        startBlockIndex: sectionsTable.startBlockIndex,
        endBlockIndex: sectionsTable.endBlockIndex,
      })
      .from(sectionsTable)
      .where(eq(sectionsTable.referenceId, referenceId))
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

    return res.json({
      documentId: reference.documentId,
      reference: {
        id: reference.id,
        title: reference.title,
      },
      toc: buildTocFromStoredSections(sections, keywords),
    });
  } catch (error) {
    console.error("Get reference outline failed", error);
    return res.status(500).json({ error: "获取参考材料目录失败" });
  }
});

router.get("/references/:referenceId/blocks", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    const referenceId = getSingleParam(req.params.referenceId);
    if (!referenceId) {
      return res.status(400).json({ error: "REFERENCE_ID_REQUIRED" });
    }

    const reference = await findOwnedReference(referenceId, userId);
    if (!reference) {
      return res.status(404).json({ error: "REFERENCE_NOT_FOUND" });
    }

    const blocks = await db
      .select({
        id: textBlocksTable.id,
        content: textBlocksTable.content,
        positionIndex: textBlocksTable.positionIndex,
      })
      .from(textBlocksTable)
      .where(eq(textBlocksTable.referenceId, referenceId))
      .orderBy(asc(textBlocksTable.positionIndex));

    return res.json({ blocks });
  } catch (error) {
    console.error("Get reference blocks failed", error);
    return res.status(500).json({ error: "获取参考材料原文失败" });
  }
});

router.delete("/references/:referenceId", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    const referenceId = getSingleParam(req.params.referenceId);
    if (!referenceId) {
      return res.status(400).json({ error: "REFERENCE_ID_REQUIRED" });
    }

    const reference = await findOwnedReference(referenceId, userId);
    if (!reference) {
      return res.status(404).json({ error: "REFERENCE_NOT_FOUND" });
    }

    await db.delete(referencesTable).where(eq(referencesTable.id, referenceId));
    return res.json({ ok: true });
  } catch (error) {
    console.error("Delete reference failed", error);
    return res.status(500).json({ error: "删除参考材料失败" });
  }
});

export default router;
