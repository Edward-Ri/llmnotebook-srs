export type Paragraph = {
  index: number;
  content: string;
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

