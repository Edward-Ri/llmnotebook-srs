import { pgTable, uuid, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { documentsTable } from "./documents";
import { keywordsTable } from "./keywords";
import { usersTable } from "./users";

export const cardCandidatesTable = pgTable("card_candidates", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => usersTable.id, { onDelete: "cascade" }),
  documentId: uuid("document_id")
    .notNull()
    .references(() => documentsTable.id, { onDelete: "cascade" }),
  keywordId: uuid("keyword_id").references(() => keywordsTable.id, { onDelete: "set null" }),
  frontContent: text("front_content").notNull(),
  backContent: text("back_content").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending_validation"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type CardCandidate = typeof cardCandidatesTable.$inferSelect;
export type InsertCardCandidate = typeof cardCandidatesTable.$inferInsert;
