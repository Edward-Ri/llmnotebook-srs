"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.attachKeywordsToToc = attachKeywordsToToc;
var express_1 = require("express");
var db_1 = require("@workspace/db");
var schema_1 = require("@workspace/db/schema");
var drizzle_orm_1 = require("drizzle-orm");
var api_zod_1 = require("@workspace/api-zod");
var physicalChunking_1 = require("../utils/physicalChunking");
var router = (0, express_1.Router)();
function extractKeywords(text) {
    var stopWords = new Set([
        "的", "了", "在", "是", "我", "有", "和", "就", "不", "人", "都", "一", "一个", "上", "也", "很", "到", "说", "要", "去", "你", "会", "着", "没有",
        "看", "好", "自己", "这", "那", "们", "来", "用", "她", "他", "它", "这个", "那个", "但", "与", "或", "以", "对", "于", "中", "为", "从", "所",
        "其", "而", "如", "则", "之", "把", "被", "让", "使", "将", "后", "前", "中", "下", "内", "外", "产", "形", "问", "第", "可", "还", "只", "时",
        "又", "因", "如果", "但是", "所以", "因为", "虽然", "不过", "而且", "然后", "这样", "这些", "那些", "可以", "已经", "应该", "需要", "通过", "根据",
        "the", "a", "an", "of", "in", "to", "for", "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", "do", "does", "did",
        "and", "or", "but", "not", "this", "that", "these", "those", "with", "from", "by", "at", "on", "as", "it", "its", "they", "them", "their",
        "we", "our", "you", "your", "he", "his", "she", "her", "will", "would", "can", "could", "may", "might", "shall", "should", "must", "into"
    ]);
    var words = new Map();
    var chineseMatches = text.match(/[\u4e00-\u9fa5]{2,8}/g) || [];
    for (var _i = 0, chineseMatches_1 = chineseMatches; _i < chineseMatches_1.length; _i++) {
        var word = chineseMatches_1[_i];
        if (!stopWords.has(word)) {
            words.set(word, (words.get(word) || 0) + 1);
        }
    }
    var englishMatches = text.match(/\b[A-Za-z][a-z]{2,}\b/g) || [];
    for (var _a = 0, englishMatches_1 = englishMatches; _a < englishMatches_1.length; _a++) {
        var word = englishMatches_1[_a];
        var lower = word.toLowerCase();
        if (!stopWords.has(lower) && lower.length > 3) {
            words.set(word, (words.get(word) || 0) + 1);
        }
    }
    var sorted = Array.from(words.entries())
        .sort(function (a, b) { return b[1] - a[1]; })
        .slice(0, 30)
        .map(function (_a) {
        var w = _a[0];
        return w;
    });
    return sorted;
}
router.post("/analyze", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var body, paragraphs, sections, tocTree, authUser, doc, keywordWords, keywordRows, tocWithKeywordRefs;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                body = api_zod_1.AnalyzeDocumentBody.parse(req.body);
                paragraphs = (0, physicalChunking_1.physicalChunk)(body.content);
                sections = (0, physicalChunking_1.segmentSections)(paragraphs);
                tocTree = (0, physicalChunking_1.buildTocTree)(sections, paragraphs);
                authUser = req.authUser;
                return [4 /*yield*/, db_1.db.insert(schema_1.documentsTable).values({
                        title: body.title || "\u6587\u6863 ".concat(new Date().toLocaleDateString("zh-CN")),
                        userId: (_a = authUser === null || authUser === void 0 ? void 0 : authUser.userId) !== null && _a !== void 0 ? _a : null,
                    }).returning()];
            case 1:
                doc = (_b.sent())[0];
                keywordWords = extractKeywords(body.content);
                return [4 /*yield*/, db_1.db.insert(schema_1.keywordsTable).values(keywordWords.map(function (word) { return ({
                        documentId: doc.id,
                        word: word,
                        isSelected: false,
                    }); })).returning()];
            case 2:
                keywordRows = _b.sent();
                tocWithKeywordRefs = attachKeywordsToToc(tocTree, paragraphs, keywordRows);
                res.json({
                    documentId: doc.id,
                    title: doc.title,
                    keywords: keywordRows.map(function (k) { return ({
                        id: k.id,
                        word: k.word,
                        isSelected: k.isSelected,
                        documentId: k.documentId,
                    }); }),
                    toc: tocWithKeywordRefs,
                });
                return [2 /*return*/];
        }
    });
}); });
function attachKeywordsToToc(toc, paragraphs, keywords) {
    var loweredKeywords = keywords.map(function (keyword) { return (__assign(__assign({}, keyword), { lower: keyword.word.toLowerCase() })); });
    return toc.map(function (node) {
        var start = Math.max(0, node.startIndex);
        var end = Math.min(node.endIndex, paragraphs.length - 1);
        if (paragraphs.length === 0 || start > end) {
            return __assign(__assign({}, node), { keywords: [] });
        }
        var nodeText = paragraphs
            .slice(start, end + 1)
            .map(function (block) { return block.content; })
            .join(" ")
            .toLowerCase();
        var matched = new Map();
        for (var _i = 0, loweredKeywords_1 = loweredKeywords; _i < loweredKeywords_1.length; _i++) {
            var keyword = loweredKeywords_1[_i];
            if (!keyword.lower)
                continue;
            if (nodeText.includes(keyword.lower)) {
                matched.set(keyword.id, { id: keyword.id, word: keyword.word });
            }
        }
        return __assign(__assign({}, node), { keywords: Array.from(matched.values()) });
    });
}
router.get("/", function (_req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var docs, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, db_1.db.select().from(schema_1.documentsTable).orderBy(schema_1.documentsTable.createdAt)];
            case 1:
                docs = _a.sent();
                return [4 /*yield*/, Promise.all(docs.map(function (doc) { return __awaiter(void 0, void 0, void 0, function () {
                        var kwCount, cardCount;
                        var _a, _b, _c, _d;
                        return __generator(this, function (_e) {
                            switch (_e.label) {
                                case 0: return [4 /*yield*/, db_1.db.select({ count: (0, drizzle_orm_1.count)() }).from(schema_1.keywordsTable).where((0, drizzle_orm_1.eq)(schema_1.keywordsTable.documentId, doc.id))];
                                case 1:
                                    kwCount = _e.sent();
                                    return [4 /*yield*/, db_1.db
                                            .select({ count: (0, drizzle_orm_1.count)() })
                                            .from(schema_1.cardsTable)
                                            .leftJoin(schema_1.keywordsTable, (0, drizzle_orm_1.eq)(schema_1.cardsTable.keywordId, schema_1.keywordsTable.id))
                                            .where((0, drizzle_orm_1.eq)(schema_1.keywordsTable.documentId, doc.id))];
                                case 2:
                                    cardCount = _e.sent();
                                    return [2 /*return*/, {
                                            id: doc.id,
                                            title: doc.title,
                                            content: "",
                                            createdAt: doc.createdAt.toISOString(),
                                            keywordCount: (_b = (_a = kwCount[0]) === null || _a === void 0 ? void 0 : _a.count) !== null && _b !== void 0 ? _b : 0,
                                            cardCount: (_d = (_c = cardCount[0]) === null || _c === void 0 ? void 0 : _c.count) !== null && _d !== void 0 ? _d : 0,
                                        }];
                            }
                        });
                    }); }))];
            case 2:
                result = _a.sent();
                res.json({ documents: result });
                return [2 /*return*/];
        }
    });
}); });
router.get("/:documentId/keywords", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var documentId, keywords;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                documentId = req.params.documentId;
                return [4 /*yield*/, db_1.db.select().from(schema_1.keywordsTable).where((0, drizzle_orm_1.eq)(schema_1.keywordsTable.documentId, documentId))];
            case 1:
                keywords = _a.sent();
                res.json({
                    keywords: keywords.map(function (k) { return ({
                        id: k.id,
                        word: k.word,
                        isSelected: k.isSelected,
                        documentId: k.documentId,
                    }); }),
                });
                return [2 /*return*/];
        }
    });
}); });
router.put("/:documentId/keywords", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var documentId, body, keywords, _i, keywords_1, kw, updated;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                documentId = req.params.documentId;
                body = api_zod_1.UpdateKeywordSelectionsBody.parse(req.body);
                return [4 /*yield*/, db_1.db.select().from(schema_1.keywordsTable).where((0, drizzle_orm_1.eq)(schema_1.keywordsTable.documentId, documentId))];
            case 1:
                keywords = _a.sent();
                _i = 0, keywords_1 = keywords;
                _a.label = 2;
            case 2:
                if (!(_i < keywords_1.length)) return [3 /*break*/, 5];
                kw = keywords_1[_i];
                return [4 /*yield*/, db_1.db.update(schema_1.keywordsTable)
                        .set({ isSelected: body.selectedIds.includes(kw.id) })
                        .where((0, drizzle_orm_1.eq)(schema_1.keywordsTable.id, kw.id))];
            case 3:
                _a.sent();
                _a.label = 4;
            case 4:
                _i++;
                return [3 /*break*/, 2];
            case 5: return [4 /*yield*/, db_1.db.select().from(schema_1.keywordsTable).where((0, drizzle_orm_1.eq)(schema_1.keywordsTable.documentId, documentId))];
            case 6:
                updated = _a.sent();
                res.json({
                    keywords: updated.map(function (k) { return ({
                        id: k.id,
                        word: k.word,
                        isSelected: k.isSelected,
                        documentId: k.documentId,
                    }); }),
                });
                return [2 /*return*/];
        }
    });
}); });
exports.default = router;
