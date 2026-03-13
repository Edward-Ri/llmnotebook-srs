import type { Paragraph } from "./physicalChunking";
import type { TOCNode, TOCKeyword } from "./physicalChunking";

export function attachKeywordsToToc(
  toc: TOCNode[],
  paragraphs: Paragraph[],
  keywords: { id: number; word: string }[],
): TOCNode[] {
  const loweredKeywords = keywords.map((keyword) => ({
    ...keyword,
    lower: keyword.word.toLowerCase(),
  }));

  return toc.map((node) => {
    const start = Math.max(0, node.startIndex);
    const end = Math.min(node.endIndex, paragraphs.length - 1);
    if (paragraphs.length === 0 || start > end) {
      return { ...node, keywords: [] };
    }

    const nodeText = paragraphs
      .slice(start, end + 1)
      .map((block) => block.content)
      .join(" ")
      .toLowerCase();

    const matched = new Map<number, TOCKeyword>();

    for (const keyword of loweredKeywords) {
      if (!keyword.lower) continue;
      if (nodeText.includes(keyword.lower)) {
        matched.set(keyword.id, { id: keyword.id, word: keyword.word });
      }
    }

    return {
      ...node,
      keywords: Array.from(matched.values()),
    };
  });
}
