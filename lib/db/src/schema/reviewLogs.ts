import { pgTable, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { cardsTable } from "./cards";

export const reviewLogsTable = pgTable("review_logs", {
  id: serial("id").primaryKey(),
  cardId: integer("card_id").notNull().references(() => cardsTable.id),
  grade: integer("grade").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertReviewLogSchema = createInsertSchema(reviewLogsTable).omit({ id: true, createdAt: true });
export type InsertReviewLog = z.infer<typeof insertReviewLogSchema>;
export type ReviewLog = typeof reviewLogsTable.$inferSelect;
