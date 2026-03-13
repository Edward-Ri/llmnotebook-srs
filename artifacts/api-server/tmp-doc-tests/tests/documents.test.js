"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var strict_1 = require("node:assert/strict");
var documents_1 = require("../routes/documents");
function run() {
    var paragraphs = [
        { index: 0, content: "AI is my favorite topic" },
        { index: 1, content: "LLM is also amazing" },
        { index: 2, content: "Nothing to see here" },
    ];
    var toc = [
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
    var keywords = [
        { id: 10, word: "AI" },
        { id: 20, word: "LLM" },
        { id: 30, word: "Absence" },
    ];
    var enriched = (0, documents_1.attachKeywordsToToc)(toc, paragraphs, keywords);
    strict_1.default.equal(enriched.length, 2);
    strict_1.default.deepEqual(enriched[0].keywords, [
        { id: 10, word: "AI" },
        { id: 20, word: "LLM" },
    ]);
    strict_1.default.deepEqual(enriched[1].keywords, []);
    // ensure case-insensitive matching works and duplicates are de-duplicated
    var expandedParagraphs = [
        { index: 0, content: "ai Ai AI" },
    ];
    var expandedToc = [
        {
            id: "x",
            title: "Section X",
            startIndex: 0,
            endIndex: 0,
            children: [],
            keywords: [],
        },
    ];
    var expandedKeywords = [
        { id: 40, word: "AI" },
        { id: 50, word: "ai" },
    ];
    var twice = (0, documents_1.attachKeywordsToToc)(expandedToc, expandedParagraphs, expandedKeywords);
    strict_1.default.equal(twice[0].keywords.length, 2);
    strict_1.default.deepEqual(twice[0].keywords, [
        { id: 40, word: "AI" },
        { id: 50, word: "ai" },
    ]);
}
run();
