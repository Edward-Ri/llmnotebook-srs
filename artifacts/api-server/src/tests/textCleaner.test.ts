import assert from "node:assert/strict";
import { cleanText } from "../utils/textCleaner";

function run() {
  // Normalize newlines
  assert.equal(cleanText("a\r\nb\rc"), "a\nb\nc");

  // Trim lines but keep inner spaces
  assert.equal(cleanText("  foo  bar  "), "foo  bar");

  // Remove zero-width and control chars (except newline)
  const withInvisible = "a\u200B\u200C\uFEFFb\u0000\u0001";
  assert.equal(cleanText(withInvisible), "ab");

  // Collapse 3+ newlines into 2
  assert.equal(cleanText("a\n\n\n\nb"), "a\n\nb");

  // Preserve paragraph structure with at most 2 blank lines
  assert.equal(cleanText("a\n\n\n\n\nb"), "a\n\nb");

  // Empty and whitespace-only input
  assert.equal(cleanText(""), "");
  assert.equal(cleanText("   \n   "), "\n");
}

run();

