import { pgTable, serial, text, integer, real, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { keywordsTable } from "./keywords";

export const cardsTable = pgTable("cards", {
  id: serial("id").primaryKey(),
  keywordId: integer("keyword_id").notNull().references(() => keywordsTable.id),
  frontContent: text("front_content").notNull(),
  backContent: text("back_content").notNull(),
  status: text("status").notNull().default("pending_validation"),
  sm2Interval: integer("sm2_interval").notNull().default(1),
  sm2Repetition: integer("sm2_repetition").notNull().default(0),
  sm2Efactor: real("sm2_efactor").notNull().default(2.5),
  dueDate: timestamp("due_date").defaultNow().notNull(),
}, (table) => [
  index("cards_due_date_idx").on(table.dueDate),
  index("cards_status_idx").on(table.status),
]);

export const insertCardSchema = createInsertSchema(cardsTable).omit({ id: true });
export type InsertCard = z.infer<typeof insertCardSchema>;
export type Card = typeof cardsTable.$inferSelect;
