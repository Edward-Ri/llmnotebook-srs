import { pgTable, serial, integer, timestamp, uuid } from "drizzle-orm/pg-core";
import { flashcardsTable } from "./flashcards";
import { usersTable } from "./users";

export const reviewLogsTable = pgTable("review_logs", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").references(() => usersTable.id, { onDelete: "cascade" }),
  cardId: uuid("card_id").notNull().references(() => flashcardsTable.id, { onDelete: "cascade" }),
  grade: integer("grade").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ReviewLog = typeof reviewLogsTable.$inferSelect;
export type InsertReviewLog = typeof reviewLogsTable.$inferInsert;
