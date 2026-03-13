import assert from "node:assert/strict";
import type { Paragraph } from "../utils/physicalChunking";
import type { TOCNode } from "../utils/physicalChunking";
import { attachKeywordsToToc } from "../utils/toc-keywords.ts";

function run() {
  const paragraphs: Paragraph[] = [
    { index: 0, content: "AI is my favorite topic" },
    { index: 1, content: "LLM is also amazing" },
    { index: 2, content: "Nothing to see here" },
  ];

  const toc: TOCNode[] = [
    {
      id: "0",
      title: "Section 0",
      startIndex: 0,
      endIndex: 1,
      children: [],
      keywords: [],
    },
    {
      id: "1",
      title: "Section 1",
      startIndex: 2,
      endIndex: 2,
      children: [],
      keywords: [],
    },
  ];

  const keywords = [
    { id: "kw-10", word: "AI" },
    { id: "kw-20", word: "LLM" },
    { id: "kw-30", word: "Absence" },
  ];

  const enriched = attachKeywordsToToc(toc, paragraphs, keywords);
  assert.equal(enriched.length, 2);
  assert.deepEqual(enriched[0].keywords, [
    { id: "kw-10", word: "AI" },
    { id: "kw-20", word: "LLM" },
  ]);
  assert.deepEqual(enriched[1].keywords, []);

  // ensure case-insensitive matching works and duplicates are de-duplicated
  const expandedParagraphs: Paragraph[] = [
    { index: 0, content: "ai Ai AI" },
  ];
  const expandedToc: TOCNode[] = [
    {
      id: "x",
      title: "Section X",
      startIndex: 0,
      endIndex: 0,
      children: [],
      keywords: [],
    },
  ];
  const expandedKeywords = [
    { id: "kw-40", word: "AI" },
    { id: "kw-50", word: "ai" },
  ];

  const twice = attachKeywordsToToc(expandedToc, expandedParagraphs, expandedKeywords);
  assert.equal(twice[0].keywords.length, 2);
  assert.deepEqual(twice[0].keywords, [
    { id: "kw-40", word: "AI" },
    { id: "kw-50", word: "ai" },
  ]);
}

run();
