import { pgTable, uuid, text, timestamp, integer, real, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { decksTable } from "./decks";
import { keywordsTable } from "./keywords";
import { noteBlocksTable } from "./noteBlocks";
import { referencesTable } from "./references";
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
  sourceNoteBlockId: uuid("source_note_block_id").references(() => noteBlocksTable.id, {
    onDelete: "set null",
  }),
  sourceReferenceId: uuid("source_reference_id").references(() => referencesTable.id, {
    onDelete: "set null",
  }),
  generationMode: varchar("generation_mode", { length: 32 }).default("keyword").notNull(),
  frontContent: text("front_content").notNull(),
  backContent: text("back_content").notNull(),
  repetition: integer("repetition").default(0).notNull(),
  interval: integer("interval").default(0).notNull(),
  easeFactor: real("ease_factor").default(2.5).notNull(),
  nextReviewDate: timestamp("next_review_date").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertFlashcardSchema = createInsertSchema(flashcardsTable).omit({
  id: true,
  createdAt: true,
  repetition: true,
  interval: true,
  easeFactor: true,
  nextReviewDate: true,
});

export type InsertFlashcard = z.infer<typeof insertFlashcardSchema>;
export type Flashcard = typeof flashcardsTable.$inferSelect;
