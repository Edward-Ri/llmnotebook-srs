import { AnyPgColumn, index, integer, pgTable, uuid, varchar } from "drizzle-orm/pg-core";
import { referencesTable } from "./references";

export const sectionsTable = pgTable(
  "sections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    referenceId: uuid("reference_id")
      .notNull()
      .references(() => referencesTable.id, { onDelete: "cascade" }),
    parentSectionId: uuid("parent_section_id").references((): AnyPgColumn => sectionsTable.id, {
      onDelete: "set null",
    }),
    heading: varchar("heading", { length: 255 }),
    startBlockIndex: integer("start_block_index").notNull(),
    endBlockIndex: integer("end_block_index").notNull(),
    level: integer("level").notNull(),
  },
  (t) => ({
    referenceIdIdx: index("sections_reference_id_idx").on(t.referenceId),
    parentSectionIdIdx: index("sections_parent_section_id_idx").on(t.parentSectionId),
    startBlockIndexIdx: index("sections_start_block_index_idx").on(t.startBlockIndex),
    endBlockIndexIdx: index("sections_end_block_index_idx").on(t.endBlockIndex),
  }),
);

export type Section = typeof sectionsTable.$inferSelect;
export type InsertSection = typeof sectionsTable.$inferInsert;
