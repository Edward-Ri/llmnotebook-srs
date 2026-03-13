import { index, integer, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { documentsTable } from "./documents";

export const textBlocksTable = pgTable(
  "text_blocks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documentsTable.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    positionIndex: integer("position_index").notNull(),
  },
  (t) => ({
    documentIdIdx: index("text_blocks_document_id_idx").on(t.documentId),
    documentIdPositionUnique: uniqueIndex("text_blocks_document_id_position_index_uq").on(
      t.documentId,
      t.positionIndex,
    ),
  }),
);

export type TextBlock = typeof textBlocksTable.$inferSelect;
export type InsertTextBlock = typeof textBlocksTable.$inferInsert;
