import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { decksTable, cardsTable, keywordsTable, documentsTable } from "@workspace/db/schema";
import { and, count, eq, lte } from "drizzle-orm";

const router: IRouter = Router();

function parseCreateDeckBody(body: unknown): { name: string; description?: string } {
  if (typeof body !== "object" || body === null) {
    throw new Error("Invalid request body");
  }
  const maybe = body as { name?: unknown; description?: unknown };
  if (typeof maybe.name !== "string" || maybe.name.trim().length === 0) {
    throw new Error("Invalid name");
  }
  if (!(maybe.description === undefined || typeof maybe.description === "string")) {
    throw new Error("Invalid description");
  }
  return { name: maybe.name.trim(), description: maybe.description };
}

router.get("/", async (_req, res) => {
  const decks = await db.select().from(decksTable).orderBy(decksTable.createdAt);

  const result = await Promise.all(
    decks.map(async (deck) => {
      const [total] = await db
        .select({ count: count() })
        .from(cardsTable)
        .where(eq(cardsTable.deckId, deck.id));

      const now = new Date();
      const [due] = await db
        .select({ count: count() })
        .from(cardsTable)
        .where(
          and(
            eq(cardsTable.deckId, deck.id),
            eq(cardsTable.status, "active"),
            lte(cardsTable.dueDate, now)
          )
        );

      return {
        id: deck.id,
        name: deck.name,
        description: deck.description ?? "",
        createdAt: deck.createdAt.toISOString(),
        updatedAt: deck.updatedAt.toISOString(),
        totalCards: total.count,
        dueCards: due.count,
      };
    })
  );

  res.json({ decks: result });
});

router.post("/", async (req, res) => {
  let body: { name: string; description?: string };
  try {
    body = parseCreateDeckBody(req.body);
  } catch (e: any) {
    return res.status(400).json({ error: e?.message ?? "Invalid request body" });
  }

  const [deck] = await db
    .insert(decksTable)
    .values({
      name: body.name,
      description: body.description ?? null,
    })
    .returning();

  return res.status(201).json({
    id: deck.id,
    name: deck.name,
    description: deck.description ?? "",
    createdAt: deck.createdAt.toISOString(),
    updatedAt: deck.updatedAt.toISOString(),
    totalCards: 0,
    dueCards: 0,
  });
});

router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: "Invalid deck id" });
  }

  const [deck] = await db.select().from(decksTable).where(eq(decksTable.id, id)).limit(1);
  if (!deck) {
    return res.status(404).json({ error: "Deck not found" });
  }

  const cards = await db
    .select({
      id: cardsTable.id,
      frontContent: cardsTable.frontContent,
      backContent: cardsTable.backContent,
      status: cardsTable.status,
      keywordId: cardsTable.keywordId,
      dueDate: cardsTable.dueDate,
      keyword: keywordsTable.word,
      documentId: documentsTable.id,
      documentTitle: documentsTable.title,
    })
    .from(cardsTable)
    .leftJoin(keywordsTable, eq(cardsTable.keywordId, keywordsTable.id))
    .leftJoin(documentsTable, eq(keywordsTable.documentId, documentsTable.id))
    .where(eq(cardsTable.deckId, id));

  const now = new Date();
  const [total] = await db
    .select({ count: count() })
    .from(cardsTable)
    .where(eq(cardsTable.deckId, id));
  const [due] = await db
    .select({ count: count() })
    .from(cardsTable)
    .where(
      and(
        eq(cardsTable.deckId, id),
        eq(cardsTable.status, "active"),
        lte(cardsTable.dueDate, now)
      )
    );

  return res.json({
    id: deck.id,
    name: deck.name,
    description: deck.description ?? "",
    createdAt: deck.createdAt.toISOString(),
    updatedAt: deck.updatedAt.toISOString(),
    totalCards: total.count,
    dueCards: due.count,
    cards: cards.map((c) => ({
      id: c.id,
      frontContent: c.frontContent,
      backContent: c.backContent,
      status: c.status,
      keywordId: c.keywordId,
      keyword: c.keyword ?? "",
      dueDate: c.dueDate?.toISOString(),
      documentId: c.documentId,
      documentTitle: c.documentTitle,
    })),
  });
});

export default router;

