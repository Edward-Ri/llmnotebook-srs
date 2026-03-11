import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { documentsTable, keywordsTable, cardsTable } from "@workspace/db/schema";
import { eq, count } from "drizzle-orm";
import {
  AnalyzeDocumentBody,
  UpdateKeywordSelectionsBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    "的","了","在","是","我","有","和","就","不","人","都","一","一个","上","也","很","到","说","要","去","你","会","着","没有",
    "看","好","自己","这","那","们","来","用","她","他","它","这个","那个","但","与","或","以","对","于","中","为","从","所",
    "其","而","如","则","之","把","被","让","使","将","后","前","中","下","内","外","产","形","问","第","可","还","只","时",
    "又","因","如果","但是","所以","因为","虽然","不过","而且","然后","这样","这些","那些","可以","已经","应该","需要","通过","根据",
    "the","a","an","of","in","to","for","is","are","was","were","be","been","being","have","has","had","do","does","did",
    "and","or","but","not","this","that","these","those","with","from","by","at","on","as","it","its","they","them","their",
    "we","our","you","your","he","his","she","her","will","would","can","could","may","might","shall","should","must","into"
  ]);

  const words: Map<string, number> = new Map();
  
  const chineseMatches = text.match(/[\u4e00-\u9fa5]{2,8}/g) || [];
  for (const word of chineseMatches) {
    if (!stopWords.has(word)) {
      words.set(word, (words.get(word) || 0) + 1);
    }
  }

  const englishMatches = text.match(/\b[A-Za-z][a-z]{2,}\b/g) || [];
  for (const word of englishMatches) {
    const lower = word.toLowerCase();
    if (!stopWords.has(lower) && lower.length > 3) {
      words.set(word, (words.get(word) || 0) + 1);
    }
  }

  const sorted = Array.from(words.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([w]) => w);

  return sorted;
}

router.post("/analyze", async (req, res) => {
  const body = AnalyzeDocumentBody.parse(req.body);
  
  const [doc] = await db.insert(documentsTable).values({
    content: body.content,
    title: body.title || `文档 ${new Date().toLocaleDateString("zh-CN")}`,
  }).returning();

  const keywordWords = extractKeywords(body.content);

  const keywordRows = await db.insert(keywordsTable).values(
    keywordWords.map((word) => ({
      documentId: doc.id,
      word,
      isSelected: false,
    }))
  ).returning();

  res.json({
    documentId: doc.id,
    title: doc.title,
    keywords: keywordRows.map((k) => ({
      id: k.id,
      word: k.word,
      isSelected: k.isSelected,
      documentId: k.documentId,
    })),
  });
});

router.get("/", async (_req, res) => {
  const docs = await db.select().from(documentsTable).orderBy(documentsTable.createdAt);
  
  const result = await Promise.all(docs.map(async (doc) => {
    const kwCount = await db.select({ count: count() }).from(keywordsTable).where(eq(keywordsTable.documentId, doc.id));
    const cardCount = await db
      .select({ count: count() })
      .from(cardsTable)
      .leftJoin(keywordsTable, eq(cardsTable.keywordId, keywordsTable.id))
      .where(eq(keywordsTable.documentId, doc.id));
    return {
      id: doc.id,
      title: doc.title,
      content: doc.content,
      createdAt: doc.createdAt.toISOString(),
      keywordCount: kwCount[0]?.count ?? 0,
      cardCount: cardCount[0]?.count ?? 0,
    };
  }));

  res.json({ documents: result });
});

router.get("/:documentId/keywords", async (req, res) => {
  const documentId = parseInt(req.params.documentId);
  const keywords = await db.select().from(keywordsTable).where(eq(keywordsTable.documentId, documentId));
  res.json({
    keywords: keywords.map((k) => ({
      id: k.id,
      word: k.word,
      isSelected: k.isSelected,
      documentId: k.documentId,
    })),
  });
});

router.put("/:documentId/keywords", async (req, res) => {
  const documentId = parseInt(req.params.documentId);
  const body = UpdateKeywordSelectionsBody.parse(req.body);

  const keywords = await db.select().from(keywordsTable).where(eq(keywordsTable.documentId, documentId));
  
  for (const kw of keywords) {
    await db.update(keywordsTable)
      .set({ isSelected: body.selectedIds.includes(kw.id) })
      .where(eq(keywordsTable.id, kw.id));
  }

  const updated = await db.select().from(keywordsTable).where(eq(keywordsTable.documentId, documentId));
  res.json({
    keywords: updated.map((k) => ({
      id: k.id,
      word: k.word,
      isSelected: k.isSelected,
      documentId: k.documentId,
    })),
  });
});

export default router;
