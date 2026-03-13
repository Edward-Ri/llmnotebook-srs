export type Paragraph = {
  index: number;
  content: string;
};

export type Section = {
  id: number;
  startIndex: number;
  endIndex: number;
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

