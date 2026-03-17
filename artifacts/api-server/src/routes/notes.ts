import { Router, type IRouter, type Request } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import {
  documentsTable,
  noteBlocksTable,
  notePagesTable,
  referencesTable,
  textBlocksTable,
} from "@workspace/db/schema";
import { and, asc, eq, gte, inArray, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

const getUserId = (req: Request) => (req as Request & { user: { id: string } }).user.id;
const getSingleParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const BlockTypeSchema = z.enum(["text", "quote", "heading"]);

const CreateNotebookRequest = z.object({
  title: z.string().trim().min(1).max(255),
});

const UpdateNotebookRequest = z.object({
  title: z.string().trim().min(1).max(255).optional(),
}).refine((body) => body.title !== undefined, {
  message: "缺少可更新字段",
});

const CreateNoteBlockRequest = z.object({
  content: z.string().min(1),
  blockType: BlockTypeSchema.optional(),
  sourceTextBlockId: z.string().uuid().nullable().optional(),
  sourceReferenceId: z.string().uuid().nullable().optional(),
  selectionOffset: z.number().int().min(0).nullable().optional(),
  selectionLength: z.number().int().min(0).nullable().optional(),
  insertAtIndex: z.number().int().min(0).nullable().optional(),
});

const UpdateNoteBlockRequest = z.object({
  content: z.string().min(1).optional(),
  blockType: BlockTypeSchema.optional(),
}).refine((body) => body.content !== undefined || body.blockType !== undefined, {
  message: "缺少可更新字段",
});

const ReorderNoteBlocksRequest = z.object({
  blockIdsInOrder: z.array(z.string().uuid()).min(1),
});

async function findOwnedDocument(documentId: string, userId: string) {
  const [doc] = await db
    .select({ id: documentsTable.id })
    .from(documentsTable)
    .where(and(eq(documentsTable.id, documentId), eq(documentsTable.userId, userId)))
    .limit(1);

  return doc ?? null;
}

async function findOwnedNotebook(notebookId: string, userId: string) {
  const [notebook] = await db
    .select({
      id: notePagesTable.id,
      userId: notePagesTable.userId,
      documentId: notePagesTable.documentId,
      title: notePagesTable.title,
      createdAt: notePagesTable.createdAt,
      updatedAt: notePagesTable.updatedAt,
    })
    .from(notePagesTable)
    .where(and(eq(notePagesTable.id, notebookId), eq(notePagesTable.userId, userId)))
    .limit(1);

  return notebook ?? null;
}

async function findOwnedBlock(blockId: string, userId: string) {
  const [block] = await db
    .select({
      id: noteBlocksTable.id,
      pageId: noteBlocksTable.pageId,
      userId: noteBlocksTable.userId,
      documentId: noteBlocksTable.documentId,
      sourceTextBlockId: noteBlocksTable.sourceTextBlockId,
      sourceReferenceId: noteBlocksTable.sourceReferenceId,
      content: noteBlocksTable.content,
      blockType: noteBlocksTable.blockType,
      positionIndex: noteBlocksTable.positionIndex,
      selectionOffset: noteBlocksTable.selectionOffset,
      selectionLength: noteBlocksTable.selectionLength,
      createdAt: noteBlocksTable.createdAt,
      updatedAt: noteBlocksTable.updatedAt,
    })
    .from(noteBlocksTable)
    .where(and(eq(noteBlocksTable.id, blockId), eq(noteBlocksTable.userId, userId)))
    .limit(1);

  return block ?? null;
}

async function validateBlockSources(input: {
  documentId: string;
  userId: string;
  sourceReferenceId: string | null;
  sourceTextBlockId: string | null;
}) {
  if (input.sourceReferenceId) {
    const [reference] = await db
      .select({ id: referencesTable.id })
      .from(referencesTable)
      .where(
        and(
          eq(referencesTable.id, input.sourceReferenceId),
          eq(referencesTable.documentId, input.documentId),
          eq(referencesTable.userId, input.userId),
        ),
      )
      .limit(1);

    if (!reference) {
      return { error: "引用来源 reference 不存在或不属于当前工作区" } as const;
    }
  }

  if (input.sourceTextBlockId) {
    const [block] = await db
      .select({ id: textBlocksTable.id })
      .from(textBlocksTable)
      .leftJoin(referencesTable, eq(textBlocksTable.referenceId, referencesTable.id))
      .where(
        and(
          eq(textBlocksTable.id, input.sourceTextBlockId),
          eq(referencesTable.documentId, input.documentId),
          eq(referencesTable.userId, input.userId),
        ),
      )
      .limit(1);

    if (!block) {
      return { error: "引用来源 text block 不存在或不属于当前工作区" } as const;
    }
  }

  return { ok: true } as const;
}

router.get("/documents/:documentId/notebooks", requireAuth, async (req, res) => {
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

    const notebooks = await db
      .select({
        id: notePagesTable.id,
        title: notePagesTable.title,
        createdAt: notePagesTable.createdAt,
        updatedAt: notePagesTable.updatedAt,
      })
      .from(notePagesTable)
      .where(and(eq(notePagesTable.documentId, documentId), eq(notePagesTable.userId, userId)))
      .orderBy(asc(notePagesTable.createdAt));

    const notebookIds = notebooks.map((notebook) => notebook.id);
    const blockCounts = notebookIds.length > 0
      ? await db
        .select({
          pageId: noteBlocksTable.pageId,
          count: sql<number>`count(*)`,
        })
        .from(noteBlocksTable)
        .where(inArray(noteBlocksTable.pageId, notebookIds))
        .groupBy(noteBlocksTable.pageId)
      : [];

    const blockCountByNotebookId = new Map(
      blockCounts.map((row) => [row.pageId, Number(row.count ?? 0)]),
    );

    return res.json({
      notebooks: notebooks.map((notebook) => ({
        id: notebook.id,
        title: notebook.title,
        blockCount: blockCountByNotebookId.get(notebook.id) ?? 0,
        createdAt: notebook.createdAt.toISOString(),
        updatedAt: notebook.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("List notebooks failed", error);
    return res.status(500).json({ error: "获取笔记本失败" });
  }
});

router.post("/documents/:documentId/notebooks", requireAuth, async (req, res) => {
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

    const body = CreateNotebookRequest.parse(req.body);
    const [notebook] = await db.insert(notePagesTable).values({
      userId,
      documentId,
      title: body.title,
    }).returning();

    return res.status(201).json({
      id: notebook.id,
      userId: notebook.userId,
      documentId: notebook.documentId,
      title: notebook.title,
      createdAt: notebook.createdAt.toISOString(),
      updatedAt: notebook.updatedAt.toISOString(),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json(error.issues);
    }
    console.error("Create notebook failed", error);
    return res.status(500).json({ error: "创建笔记本失败" });
  }
});

router.patch("/notebooks/:notebookId", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    const notebookId = getSingleParam(req.params.notebookId);
    if (!notebookId) {
      return res.status(400).json({ error: "NOTEBOOK_ID_REQUIRED" });
    }

    const notebook = await findOwnedNotebook(notebookId, userId);
    if (!notebook) {
      return res.status(404).json({ error: "NOTEBOOK_NOT_FOUND" });
    }

    const body = UpdateNotebookRequest.parse(req.body);
    const [updated] = await db
      .update(notePagesTable)
      .set({ title: body.title, updatedAt: new Date() })
      .where(eq(notePagesTable.id, notebookId))
      .returning();

    return res.json({
      id: updated.id,
      userId: updated.userId,
      documentId: updated.documentId,
      title: updated.title,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json(error.issues);
    }
    console.error("Update notebook failed", error);
    return res.status(500).json({ error: "更新笔记本失败" });
  }
});

router.delete("/notebooks/:notebookId", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    const notebookId = getSingleParam(req.params.notebookId);
    if (!notebookId) {
      return res.status(400).json({ error: "NOTEBOOK_ID_REQUIRED" });
    }

    const notebook = await findOwnedNotebook(notebookId, userId);
    if (!notebook) {
      return res.status(404).json({ error: "NOTEBOOK_NOT_FOUND" });
    }

    await db.delete(notePagesTable).where(eq(notePagesTable.id, notebookId));
    return res.json({ ok: true });
  } catch (error) {
    console.error("Delete notebook failed", error);
    return res.status(500).json({ error: "删除笔记本失败" });
  }
});

router.get("/notebooks/:notebookId/blocks", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    const notebookId = getSingleParam(req.params.notebookId);
    if (!notebookId) {
      return res.status(400).json({ error: "NOTEBOOK_ID_REQUIRED" });
    }

    const notebook = await findOwnedNotebook(notebookId, userId);
    if (!notebook) {
      return res.status(404).json({ error: "NOTEBOOK_NOT_FOUND" });
    }

    const blocks = await db
      .select()
      .from(noteBlocksTable)
      .where(eq(noteBlocksTable.pageId, notebookId))
      .orderBy(asc(noteBlocksTable.positionIndex));

    return res.json({
      blocks: blocks.map((block) => ({
        id: block.id,
        pageId: block.pageId,
        userId: block.userId,
        documentId: block.documentId,
        sourceTextBlockId: block.sourceTextBlockId,
        sourceReferenceId: block.sourceReferenceId,
        content: block.content,
        blockType: block.blockType,
        positionIndex: block.positionIndex,
        selectionOffset: block.selectionOffset,
        selectionLength: block.selectionLength,
        createdAt: block.createdAt.toISOString(),
        updatedAt: block.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Get notebook blocks failed", error);
    return res.status(500).json({ error: "获取笔记块失败" });
  }
});

router.post("/notebooks/:notebookId/blocks", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    const notebookId = getSingleParam(req.params.notebookId);
    if (!notebookId) {
      return res.status(400).json({ error: "NOTEBOOK_ID_REQUIRED" });
    }

    const notebook = await findOwnedNotebook(notebookId, userId);
    if (!notebook) {
      return res.status(404).json({ error: "NOTEBOOK_NOT_FOUND" });
    }

    const body = CreateNoteBlockRequest.parse(req.body);
    const sourceValidation = await validateBlockSources({
      documentId: notebook.documentId,
      userId,
      sourceReferenceId: body.sourceReferenceId ?? null,
      sourceTextBlockId: body.sourceTextBlockId ?? null,
    });
    if ("error" in sourceValidation) {
      return res.status(400).json({ error: sourceValidation.error });
    }

    let inserted:
      | typeof noteBlocksTable.$inferSelect
      | undefined;

    await db.transaction(async (tx) => {
      let positionIndex = body.insertAtIndex ?? 0;
      if (body.insertAtIndex !== null && body.insertAtIndex !== undefined) {
        await tx
          .update(noteBlocksTable)
          .set({ positionIndex: sql`${noteBlocksTable.positionIndex} + 1`, updatedAt: new Date() })
          .where(and(eq(noteBlocksTable.pageId, notebookId), gte(noteBlocksTable.positionIndex, body.insertAtIndex)));
        positionIndex = body.insertAtIndex;
      } else {
        const rows = await tx
          .select({ positionIndex: noteBlocksTable.positionIndex })
          .from(noteBlocksTable)
          .where(eq(noteBlocksTable.pageId, notebookId))
          .orderBy(asc(noteBlocksTable.positionIndex));
        positionIndex = rows.length > 0 ? rows[rows.length - 1].positionIndex + 1 : 0;
      }

      [inserted] = await tx.insert(noteBlocksTable).values({
        pageId: notebookId,
        userId,
        documentId: notebook.documentId,
        sourceTextBlockId: body.sourceTextBlockId ?? null,
        sourceReferenceId: body.sourceReferenceId ?? null,
        content: body.content,
        blockType: body.blockType ?? "text",
        positionIndex,
        selectionOffset: body.selectionOffset ?? null,
        selectionLength: body.selectionLength ?? null,
      }).returning();
    });

    if (!inserted) {
      return res.status(500).json({ error: "创建笔记块失败" });
    }

    return res.status(201).json({
      id: inserted.id,
      pageId: inserted.pageId,
      userId: inserted.userId,
      documentId: inserted.documentId,
      sourceTextBlockId: inserted.sourceTextBlockId,
      sourceReferenceId: inserted.sourceReferenceId,
      content: inserted.content,
      blockType: inserted.blockType,
      positionIndex: inserted.positionIndex,
      selectionOffset: inserted.selectionOffset,
      selectionLength: inserted.selectionLength,
      createdAt: inserted.createdAt.toISOString(),
      updatedAt: inserted.updatedAt.toISOString(),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json(error.issues);
    }
    console.error("Create note block failed", error);
    return res.status(500).json({ error: "创建笔记块失败" });
  }
});

router.patch("/notes/blocks/:blockId", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    const blockId = getSingleParam(req.params.blockId);
    if (!blockId) {
      return res.status(400).json({ error: "BLOCK_ID_REQUIRED" });
    }

    const block = await findOwnedBlock(blockId, userId);
    if (!block) {
      return res.status(404).json({ error: "NOTE_BLOCK_NOT_FOUND" });
    }

    const body = UpdateNoteBlockRequest.parse(req.body);
    const [updated] = await db
      .update(noteBlocksTable)
      .set({
        ...(body.content !== undefined ? { content: body.content } : {}),
        ...(body.blockType !== undefined ? { blockType: body.blockType } : {}),
        updatedAt: new Date(),
      })
      .where(eq(noteBlocksTable.id, blockId))
      .returning();

    return res.json({
      id: updated.id,
      pageId: updated.pageId,
      userId: updated.userId,
      documentId: updated.documentId,
      sourceTextBlockId: updated.sourceTextBlockId,
      sourceReferenceId: updated.sourceReferenceId,
      content: updated.content,
      blockType: updated.blockType,
      positionIndex: updated.positionIndex,
      selectionOffset: updated.selectionOffset,
      selectionLength: updated.selectionLength,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json(error.issues);
    }
    console.error("Update note block failed", error);
    return res.status(500).json({ error: "更新笔记块失败" });
  }
});

router.delete("/notes/blocks/:blockId", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    const blockId = getSingleParam(req.params.blockId);
    if (!blockId) {
      return res.status(400).json({ error: "BLOCK_ID_REQUIRED" });
    }

    const block = await findOwnedBlock(blockId, userId);
    if (!block) {
      return res.status(404).json({ error: "NOTE_BLOCK_NOT_FOUND" });
    }

    await db.delete(noteBlocksTable).where(eq(noteBlocksTable.id, blockId));
    return res.json({ ok: true });
  } catch (error) {
    console.error("Delete note block failed", error);
    return res.status(500).json({ error: "删除笔记块失败" });
  }
});

router.patch("/notebooks/:notebookId/reorder", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    const notebookId = getSingleParam(req.params.notebookId);
    if (!notebookId) {
      return res.status(400).json({ error: "NOTEBOOK_ID_REQUIRED" });
    }

    const notebook = await findOwnedNotebook(notebookId, userId);
    if (!notebook) {
      return res.status(404).json({ error: "NOTEBOOK_NOT_FOUND" });
    }

    const body = ReorderNoteBlocksRequest.parse(req.body);
    const existingBlocks = await db
      .select({ id: noteBlocksTable.id })
      .from(noteBlocksTable)
      .where(eq(noteBlocksTable.pageId, notebookId))
      .orderBy(asc(noteBlocksTable.positionIndex));

    if (existingBlocks.length !== body.blockIdsInOrder.length) {
      return res.status(400).json({ error: "重排列表与当前笔记块数量不一致" });
    }

    const existingIds = new Set(existingBlocks.map((block) => block.id));
    const incomingIds = new Set(body.blockIdsInOrder);
    if (existingIds.size !== incomingIds.size || [...existingIds].some((id) => !incomingIds.has(id))) {
      return res.status(400).json({ error: "重排列表包含无效笔记块" });
    }

    await db.transaction(async (tx) => {
      for (let index = 0; index < body.blockIdsInOrder.length; index += 1) {
        await tx
          .update(noteBlocksTable)
          .set({ positionIndex: index, updatedAt: new Date() })
          .where(eq(noteBlocksTable.id, body.blockIdsInOrder[index]));
      }
    });

    return res.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json(error.issues);
    }
    console.error("Reorder note blocks failed", error);
    return res.status(500).json({ error: "重排笔记块失败" });
  }
});

export default router;
