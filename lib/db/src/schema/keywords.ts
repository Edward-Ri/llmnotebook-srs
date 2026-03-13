import { pgTable, serial, text, boolean, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { documentsTable } from "./documents";

export const keywordsTable = pgTable("keywords", {
  id: serial("id").primaryKey(),
  documentId: uuid("document_id").notNull().references(() => documentsTable.id, { onDelete: "cascade" }),
  word: text("word").notNull(),
  isSelected: boolean("is_selected").notNull().default(false),
});

export const insertKeywordSchema = createInsertSchema(keywordsTable).omit({ id: true });
export type InsertKeyword = z.infer<typeof insertKeywordSchema>;
export type Keyword = typeof keywordsTable.$inferSelect;
