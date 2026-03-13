import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const decksTable = pgTable("decks", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  ownerUserId: integer("owner_user_id").references(() => usersTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertDeckSchema = createInsertSchema(decksTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertDeck = z.infer<typeof insertDeckSchema>;
export type Deck = typeof decksTable.$inferSelect;

