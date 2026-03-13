import assert from "node:assert/strict";
import {
  physicalChunk,
  segmentSections,
  type Paragraph,
  type Section,
} from "../utils/physicalChunking";
import type { TOCNode } from "../utils/physicalChunking";

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

  // Section segmentation: empty input
  {
    const blocks: Paragraph[] = [];
    const sections = segmentSections(blocks);
    assert.deepEqual(sections, []);
  }

  // Section segmentation: 1..4 paragraphs -> single section
  {
    for (let len = 1; len <= 4; len++) {
      const blocks: Paragraph[] = Array.from({ length: len }, (_, index) => ({
        index,
        content: `P${index}`,
      }));

      const sections = segmentSections(blocks);

      const expected: Section[] = [
        {
          id: 0,
          startIndex: 0,
          endIndex: len - 1,
        },
      ];

      assert.deepEqual(sections, expected);
    }
  }

  // Section segmentation: 5 paragraphs -> [0-3], [4-4]
  {
    const blocks: Paragraph[] = Array.from({ length: 5 }, (_, index) => ({
      index,
      content: `P${index}`,
    }));

    const sections = segmentSections(blocks);

    const expected: Section[] = [
      { id: 0, startIndex: 0, endIndex: 3 },
      { id: 1, startIndex: 4, endIndex: 4 },
    ];

    assert.deepEqual(sections, expected);
  }

  // Section segmentation: 8 paragraphs -> [0-3], [4-7]
  {
    const blocks: Paragraph[] = Array.from({ length: 8 }, (_, index) => ({
      index,
      content: `P${index}`,
    }));

    const sections = segmentSections(blocks);

    const expected: Section[] = [
      { id: 0, startIndex: 0, endIndex: 3 },
      { id: 1, startIndex: 4, endIndex: 7 },
    ];

    assert.deepEqual(sections, expected);
  }

  // Section segmentation: 10 paragraphs -> [0-3], [4-7], [8-9]
  {
    const blocks: Paragraph[] = Array.from({ length: 10 }, (_, index) => ({
      index,
      content: `P${index}`,
    }));

    const sections = segmentSections(blocks);

    const expected: Section[] = [
      { id: 0, startIndex: 0, endIndex: 3 },
      { id: 1, startIndex: 4, endIndex: 7 },
      { id: 2, startIndex: 8, endIndex: 9 },
    ];

    assert.deepEqual(sections, expected);
  }

  // TOC building: each section becomes a single root node with title from first block
  {
    const blocks: Paragraph[] = Array.from({ length: 5 }, (_, index) => ({
      index,
      content: `Paragraph ${index}`,
    }));

    const sections: Section[] = segmentSections(blocks);

    const toc: TOCNode[] = [];

    // simple inlined expectation to avoid tight coupling to implementation details
    for (const section of sections) {
      const firstBlock = blocks[section.startIndex];
      const title = firstBlock?.content ?? `Section ${section.id}`;

      toc.push({
        id: String(section.id),
        title,
        startIndex: section.startIndex,
        endIndex: section.endIndex,
        children: [],
        keywords: [],
      });
    }

    // call the real implementation and compare structure
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { buildTocTree } = require("../utils/physicalChunking") as {
      buildTocTree: (sections: Section[], blocks: Paragraph[]) => TOCNode[];
    };

    const actual = buildTocTree(sections, blocks);

    assert.deepEqual(actual, toc);
  }
}

run();

