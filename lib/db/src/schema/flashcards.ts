import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { decksTable } from "./decks";
import { keywordsTable } from "./keywords";
import { textBlocksTable } from "./textBlocks";

export const flashcardsTable = pgTable("flashcards", {
  id: uuid("id").defaultRandom().primaryKey(),
  deckId: uuid("deck_id").notNull().references(() => decksTable.id, { onDelete: "restrict" }),
  sourceKeywordId: uuid("source_keyword_id").references(() => keywordsTable.id, {
    onDelete: "set null",
  }),
  sourceTextBlockId: uuid("source_text_block_id").references(() => textBlocksTable.id, {
    onDelete: "set null",
  }),
  frontContent: text("front_content").notNull(),
  backContent: text("back_content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertFlashcardSchema = createInsertSchema(flashcardsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertFlashcard = z.infer<typeof insertFlashcardSchema>;
export type Flashcard = typeof flashcardsTable.$inferSelect;
