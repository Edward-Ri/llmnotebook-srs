export type Paragraph = {
  index: number;
  content: string;
};

export type Section = {
  id: number;
  startIndex: number;
  endIndex: number;
};

export type TOCKeyword = {
  id: number;
  word: string;
};

export type TOCNode = {
  id: string;
  title: string;
  startIndex: number;
  endIndex: number;
  children: TOCNode[];
  keywords: TOCKeyword[];
};

export function physicalChunk(cleanText: string): Paragraph[] {
  if (!cleanText) return [];

  // Normalize possible CRLF/CR newlines to LF to be robust to raw input
  const normalized = cleanText.replace(/\r\n?/g, "\n");
  const lines = normalized.split("\n");

  const blocks: Paragraph[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty or very short paragraphs
    if (trimmed.length < 5) continue;

    blocks.push({
      index: blocks.length,
      content: trimmed,
    });
  }

  return blocks;
}

export function segmentSections(blocks: Paragraph[]): Section[] {
  const sections: Section[] = [];

  for (let i = 0; i < blocks.length; i += 4) {
    sections.push({
      id: sections.length,
      startIndex: i,
      endIndex: Math.min(i + 3, blocks.length - 1),
    });
  }

  return sections;
}

export function buildTocTree(sections: Section[], blocks: Paragraph[]): TOCNode[] {
  const toc: TOCNode[] = [];

  for (const section of sections) {
    const startIndex = Math.max(0, section.startIndex);
    const endIndex = Math.min(section.endIndex, blocks.length - 1);

    if (blocks.length === 0 || startIndex > endIndex) {
      toc.push({
        id: String(section.id),
        title: `Section ${section.id}`,
        startIndex: section.startIndex,
        endIndex: section.endIndex,
        children: [],
        keywords: [],
      });
      continue;
    }

    const firstBlock = blocks[startIndex];
    const rawTitle = firstBlock?.content ?? `Section ${section.id}`;
    const truncatedTitle = rawTitle.length > 80 ? `${rawTitle.slice(0, 77)}...` : rawTitle;

    toc.push({
      id: String(section.id),
      title: truncatedTitle,
      startIndex,
      endIndex,
      children: [],
      keywords: [],
    });
  }

  return toc;
}
