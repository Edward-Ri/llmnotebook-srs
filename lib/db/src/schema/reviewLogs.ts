import { pgTable, serial, integer, timestamp, uuid } from "drizzle-orm/pg-core";
import { flashcardsTable } from "./flashcards";

export const reviewLogsTable = pgTable("review_logs", {
  id: serial("id").primaryKey(),
  cardId: uuid("card_id").notNull().references(() => flashcardsTable.id, { onDelete: "cascade" }),
  grade: integer("grade").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ReviewLog = typeof reviewLogsTable.$inferSelect;
export type InsertReviewLog = typeof reviewLogsTable.$inferInsert;
