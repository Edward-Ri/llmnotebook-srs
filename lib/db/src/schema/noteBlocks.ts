import { index, integer, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { documentsTable } from "./documents";
import { notePagesTable } from "./notePages";
import { referencesTable } from "./references";
import { textBlocksTable } from "./textBlocks";
import { usersTable } from "./users";

export const noteBlocksTable = pgTable(
  "note_blocks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    pageId: uuid("page_id")
      .notNull()
      .references(() => notePagesTable.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documentsTable.id, { onDelete: "cascade" }),
    sourceTextBlockId: uuid("source_text_block_id").references(() => textBlocksTable.id, {
      onDelete: "set null",
    }),
    sourceReferenceId: uuid("source_reference_id").references(() => referencesTable.id, {
      onDelete: "set null",
    }),
    content: text("content").notNull(),
    blockType: varchar("block_type", { length: 32 }).notNull().default("text"),
    positionIndex: integer("position_index").notNull(),
    selectionOffset: integer("selection_offset"),
    selectionLength: integer("selection_length"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    pagePositionIdx: index("note_blocks_page_id_position_index_idx").on(t.pageId, t.positionIndex),
    documentUserIdx: index("note_blocks_document_id_user_id_idx").on(t.documentId, t.userId),
  }),
);

export type NoteBlock = typeof noteBlocksTable.$inferSelect;
export type InsertNoteBlock = typeof noteBlocksTable.$inferInsert;
