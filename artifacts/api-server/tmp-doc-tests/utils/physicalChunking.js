"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.physicalChunk = physicalChunk;
exports.segmentSections = segmentSections;
exports.buildTocTree = buildTocTree;
function physicalChunk(cleanText) {
    if (!cleanText)
        return [];
    // Normalize possible CRLF/CR newlines to LF to be robust to raw input
    var normalized = cleanText.replace(/\r\n?/g, "\n");
    var lines = normalized.split("\n");
    var blocks = [];
    for (var _i = 0, lines_1 = lines; _i < lines_1.length; _i++) {
        var line = lines_1[_i];
        var trimmed = line.trim();
        // Skip empty or very short paragraphs
        if (trimmed.length < 5)
            continue;
        blocks.push({
            index: blocks.length,
            content: trimmed,
        });
    }
    return blocks;
}
function segmentSections(blocks) {
    var sections = [];
    for (var i = 0; i < blocks.length; i += 4) {
        sections.push({
            id: sections.length,
            startIndex: i,
            endIndex: Math.min(i + 3, blocks.length - 1),
        });
    }
    return sections;
}
function buildTocTree(sections, blocks) {
    var _a;
    var toc = [];
    for (var _i = 0, sections_1 = sections; _i < sections_1.length; _i++) {
        var section = sections_1[_i];
        var startIndex = Math.max(0, section.startIndex);
        var endIndex = Math.min(section.endIndex, blocks.length - 1);
        if (blocks.length === 0 || startIndex > endIndex) {
            toc.push({
                id: String(section.id),
                title: "Section ".concat(section.id),
                startIndex: section.startIndex,
                endIndex: section.endIndex,
                children: [],
                keywords: [],
            });
            continue;
        }
        var firstBlock = blocks[startIndex];
        var rawTitle = (_a = firstBlock === null || firstBlock === void 0 ? void 0 : firstBlock.content) !== null && _a !== void 0 ? _a : "Section ".concat(section.id);
        var truncatedTitle = rawTitle.length > 80 ? "".concat(rawTitle.slice(0, 77), "...") : rawTitle;
        toc.push({
            id: String(section.id),
            title: truncatedTitle,
            startIndex: startIndex,
            endIndex: endIndex,
            children: [],
            keywords: [],
        });
    }
    return toc;
}
