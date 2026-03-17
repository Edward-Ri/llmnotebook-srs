import { index, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { documentsTable } from "./documents";
import { usersTable } from "./users";

export const notePagesTable = pgTable(
  "note_pages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documentsTable.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    documentUserIdx: index("note_pages_document_id_user_id_idx").on(t.documentId, t.userId),
  }),
);

export const insertNotePageSchema = createInsertSchema(notePagesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertNotePage = z.infer<typeof insertNotePageSchema>;
export type NotePage = typeof notePagesTable.$inferSelect;
