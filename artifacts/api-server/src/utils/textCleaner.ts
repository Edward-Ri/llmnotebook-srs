export function cleanText(rawText: string): string {
  const step1 = normalizeNewlines(rawText);
  const step2 = removeInvisibleChars(step1);
  const step3 = trimLines(step2);
  const result = collapseBlankLines(step3);
  return result;
}

export const TextCleaner = {
  clean: cleanText,
} as const;

function normalizeNewlines(text: string): string {
  if (!text) return "";
  // Convert CRLF and lone CR into LF
  return text.replace(/\r\n?/g, "\n");
}

function removeInvisibleChars(text: string): string {
  if (!text) return "";

  // Remove common zero-width characters and BOM
  let result = text.replace(/[\u200B-\u200D\uFEFF]/g, "");

  // Remove control characters except newline (LF)
  result = result.replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F]/g, "");

  return result;
}

function trimLines(text: string): string {
  if (!text) return "";

  const lines = text.split("\n");
  const trimmedLines = lines.map((line) => line.trim());
  return trimmedLines.join("\n");
}

function collapseBlankLines(text: string): string {
  if (!text) return "";

  // Any sequence of 3 or more newlines becomes exactly 2
  return text.replace(/\n{3,}/g, "\n\n");
}

