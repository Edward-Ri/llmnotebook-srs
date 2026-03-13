import { pgTable, text, uuid, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sectionsTable } from "./sections";
import { textBlocksTable } from "./textBlocks";

export const keywordsTable = pgTable("keywords", {
  id: uuid("id").defaultRandom().primaryKey(),
  sectionId: uuid("section_id").notNull().references(() => sectionsTable.id, { onDelete: "cascade" }),
  textBlockId: uuid("text_block_id").references(() => textBlocksTable.id, { onDelete: "set null" }),
  word: varchar("word", { length: 100 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("PENDING"),
});

export const insertKeywordSchema = createInsertSchema(keywordsTable).omit({ id: true });
export type InsertKeyword = z.infer<typeof insertKeywordSchema>;
export type Keyword = typeof keywordsTable.$inferSelect;
