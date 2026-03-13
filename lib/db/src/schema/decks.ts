import { pgTable, uuid, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const decksTable = pgTable("decks", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  parentId: uuid("parent_id").references(() => decksTable.id, { onDelete: "set null" }),
});

export const insertDeckSchema = createInsertSchema(decksTable).omit({
  id: true,
});

export type InsertDeck = z.infer<typeof insertDeckSchema>;
export type Deck = typeof decksTable.$inferSelect;
