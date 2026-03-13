import assert from "node:assert/strict";
import { physicalChunk, type Paragraph } from "../utils/physicalChunking";

function run() {
  // Basic splitting and indexing
  {
    const input = [
      "This is the first line.",
      "This is the second line.",
      "OK", // too short, should be filtered out
      "",
      "   Another long line here   ",
    ].join("\n");

    const blocks = physicalChunk(input);

    const expected: Paragraph[] = [
      { index: 0, content: "This is the first line." },
      { index: 1, content: "This is the second line." },
      { index: 2, content: "Another long line here" },
    ];

    assert.deepEqual(blocks, expected);
  }

  // Empty, whitespace-only and very short lines are removed
  {
    const input = "\n  \nOK\n1234\n  12345  ";
    const blocks = physicalChunk(input);

    const expected: Paragraph[] = [{ index: 0, content: "12345" }];

    assert.deepEqual(blocks, expected);
  }

  // Mixed newline styles are handled robustly
  {
    const input = "Line one\r\nLine two\rcarriage return only";
    const blocks = physicalChunk(input);

    const expected: Paragraph[] = [
      { index: 0, content: "Line one" },
      { index: 1, content: "Line two" },
      { index: 2, content: "carriage return only" },
    ];

    assert.deepEqual(blocks, expected);
  }

  // All short/empty paragraphs -> empty result
  {
    const input = "OK\n1234\n \n";
    const blocks = physicalChunk(input);

    assert.equal(blocks.length, 0);
  }
}

run();

