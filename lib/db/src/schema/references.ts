import { index, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { documentsTable } from "./documents";
import { usersTable } from "./users";

export const referencesTable = pgTable(
  "references",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documentsTable.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    documentUserIdx: index("references_document_id_user_id_idx").on(t.documentId, t.userId),
  }),
);

export const insertReferenceSchema = createInsertSchema(referencesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertReference = z.infer<typeof insertReferenceSchema>;
export type Reference = typeof referencesTable.$inferSelect;
