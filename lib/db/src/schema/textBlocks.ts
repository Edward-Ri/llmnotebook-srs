import { index, integer, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { referencesTable } from "./references";

export const textBlocksTable = pgTable(
  "text_blocks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    referenceId: uuid("reference_id")
      .notNull()
      .references(() => referencesTable.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    positionIndex: integer("position_index").notNull(),
  },
  (t) => ({
    referenceIdIdx: index("text_blocks_reference_id_idx").on(t.referenceId),
    referenceIdPositionUnique: uniqueIndex("text_blocks_reference_id_position_index_uq").on(
      t.referenceId,
      t.positionIndex,
    ),
  }),
);

export type TextBlock = typeof textBlocksTable.$inferSelect;
export type InsertTextBlock = typeof textBlocksTable.$inferInsert;
