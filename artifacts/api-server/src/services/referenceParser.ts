import { db } from "@workspace/db";
import {
  keywordsTable,
  sectionsTable,
  textBlocksTable,
} from "@workspace/db/schema";
import {
  buildTocTree,
  physicalChunk,
  segmentSections,
  type Paragraph,
  type TOCNode,
} from "../utils/physicalChunking";
import { deepseekChat, type ChatMessage } from "./llm";

type LlmKeyword = { word: string; reason?: string; score?: number };
export type TocSource = "rule" | "llm" | "fallback";

type SectionPlan = {
  tempId: string;
  parentTempId: string | null;
  title: string;
  startIndex: number;
  endIndex: number;
  level: number;
};

type LlmOutlineNode = {
  title: string;
  startIndex: number;
  endIndex: number;
  children?: LlmOutlineNode[];
};

const KEYWORD_STOPWORDS = new Set([
  "的",
  "了",
  "和",
  "与",
  "及",
  "是",
  "在",
  "对",
  "及其",
  "其中",
  "通过",
  "进行",
  "以及",
  "我们",
  "你们",
  "他们",
  "this",
  "that",
  "these",
  "those",
  "with",
  "from",
  "into",
  "about",
  "using",
  "used",
  "use",
  "for",
  "and",
  "the",
  "a",
  "an",
  "of",
  "to",
  "in",
  "on",
  "by",
  "or",
  "as",
  "is",
  "are",
  "be",
]);

function parseKeywordJson(raw: string): LlmKeyword[] {
  const trimmed = raw.trim();
  const start = trimmed.indexOf("[");
  const end = trimmed.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return [];
  try {
    const json = JSON.parse(trimmed.slice(start, end + 1));
    return Array.isArray(json) ? json : [];
  } catch {
    return [];
  }
}

function parseJsonArray(raw: string): unknown[] {
  const trimmed = raw.trim();
  const start = trimmed.indexOf("[");
  const end = trimmed.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return [];
  try {
    const json = JSON.parse(trimmed.slice(start, end + 1));
    return Array.isArray(json) ? json : [];
  } catch {
    return [];
  }
}

function normalizeKeywordWord(word: string): string {
  return word
    .trim()
    .replace(/^[\s,.;:!?，。；：！？、]+/, "")
    .replace(/[\s,.;:!?，。；：！？、]+$/, "");
}

function selectKeywords(words: string[], sectionText: string): string[] {
  const sectionLower = sectionText.toLowerCase();
  const uniq = new Map<string, { word: string; pos: number }>();

  for (const raw of words) {
    const normalized = normalizeKeywordWord(raw);
    if (normalized.length < 2 || normalized.length > 30) continue;
    if (/^\d+$/.test(normalized)) continue;

    const lower = normalized.toLowerCase();
    if (KEYWORD_STOPWORDS.has(lower)) continue;
    if (uniq.has(lower)) continue;

    const pos = sectionLower.indexOf(lower);
    uniq.set(lower, {
      word: normalized,
      pos: pos === -1 ? Number.MAX_SAFE_INTEGER : pos,
    });
  }

  return Array.from(uniq.values())
    .sort((a, b) => a.pos - b.pos || a.word.localeCompare(b.word, "zh-CN"))
    .slice(0, 8)
    .map((item) => item.word);
}

function parseHeading(paragraph: string): { level: number; title: string } | null {
  const line = paragraph.trim();
  if (!line || line.length > 100) return null;

  const markdown = line.match(/^(#{1,6})\s+(.+)$/);
  if (markdown) {
    return {
      level: Math.min(4, Math.max(1, markdown[1].length)),
      title: markdown[2].trim(),
    };
  }

  const zhChapter = line.match(/^第([一二三四五六七八九十百千万0-9]+)(章|节|篇|部分|卷)[\s:：、.-]*(.*)$/);
  if (zhChapter) {
    return { level: zhChapter[2] === "节" ? 2 : 1, title: line };
  }

  const numbered = line.match(/^(\d+(?:\.\d+){0,3})[\s、.．)\]-]+(.+)$/);
  if (numbered) {
    const depth = numbered[1].split(".").length;
    return {
      level: Math.min(4, Math.max(1, depth)),
      title: `${numbered[1]} ${numbered[2].trim()}`.trim(),
    };
  }

  const zhOrdered = line.match(/^([一二三四五六七八九十]+)[、.．]\s*(.+)$/);
  if (zhOrdered) {
    return {
      level: 2,
      title: `${zhOrdered[1]}、${zhOrdered[2].trim()}`,
    };
  }

  return null;
}

function buildRuleBasedSectionPlans(paragraphs: Paragraph[]): SectionPlan[] {
  const headingHits = paragraphs
    .map((p) => {
      const heading = parseHeading(p.content);
      if (!heading) return null;
      return {
        index: p.index,
        level: heading.level,
        title: heading.title,
      };
    })
    .filter((item): item is { index: number; level: number; title: string } => Boolean(item));

  if (headingHits.length === 0) return [];

  const plans: SectionPlan[] = [];
  const stack: { tempId: string; level: number }[] = [];

  if (headingHits[0].index > 0) {
    plans.push({
      tempId: "rule-intro",
      parentTempId: null,
      title: "导言",
      startIndex: 0,
      endIndex: headingHits[0].index - 1,
      level: 1,
    });
  }

  for (let i = 0; i < headingHits.length; i += 1) {
    const hit = headingHits[i];
    const next = headingHits[i + 1];
    const tempId = `rule-${i}`;
    const endIndex = next ? next.index - 1 : paragraphs.length - 1;

    while (stack.length > 0 && stack[stack.length - 1].level >= hit.level) {
      stack.pop();
    }

    plans.push({
      tempId,
      parentTempId: stack.length > 0 ? stack[stack.length - 1].tempId : null,
      title: hit.title,
      startIndex: hit.index,
      endIndex,
      level: Math.min(4, Math.max(1, hit.level)),
    });

    stack.push({ tempId, level: hit.level });
  }

  return plans.filter((plan) => plan.startIndex <= plan.endIndex);
}

function normalizeLlmOutlineNodes(nodes: unknown[], maxIndex: number): LlmOutlineNode[] {
  const normalized: LlmOutlineNode[] = [];

  for (const node of nodes) {
    if (!node || typeof node !== "object") continue;
    const item = node as Record<string, unknown>;
    const title = typeof item.title === "string" ? item.title.trim() : "";
    const startIndex = Number(item.startIndex);
    const endIndex = Number(item.endIndex);
    if (!title || Number.isNaN(startIndex) || Number.isNaN(endIndex)) continue;

    const clampedStart = Math.max(0, Math.min(maxIndex, Math.floor(startIndex)));
    const clampedEnd = Math.max(0, Math.min(maxIndex, Math.floor(endIndex)));
    if (clampedEnd < clampedStart) continue;

    const childRaw = Array.isArray(item.children) ? item.children : [];
    const children: LlmOutlineNode[] = [];
    for (const child of childRaw) {
      if (!child || typeof child !== "object") continue;
      const c = child as Record<string, unknown>;
      const childTitle = typeof c.title === "string" ? c.title.trim() : "";
      const childStart = Number(c.startIndex);
      const childEnd = Number(c.endIndex);
      if (!childTitle || Number.isNaN(childStart) || Number.isNaN(childEnd)) continue;

      const clampedChildStart = Math.max(clampedStart, Math.min(clampedEnd, Math.floor(childStart)));
      const clampedChildEnd = Math.max(clampedStart, Math.min(clampedEnd, Math.floor(childEnd)));
      if (clampedChildEnd < clampedChildStart) continue;

      children.push({
        title: childTitle,
        startIndex: clampedChildStart,
        endIndex: clampedChildEnd,
        children: [],
      });
    }

    children.sort((a, b) => a.startIndex - b.startIndex || a.endIndex - b.endIndex);
    normalized.push({
      title,
      startIndex: clampedStart,
      endIndex: clampedEnd,
      children,
    });
  }

  normalized.sort((a, b) => a.startIndex - b.startIndex || a.endIndex - b.endIndex);
  return normalized;
}

async function buildLlmSectionPlans(title: string, paragraphs: Paragraph[]): Promise<SectionPlan[]> {
  const indexedBlocks = paragraphs.map((p) => `${p.index}: ${p.content.slice(0, 180)}`);
  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        "你是文档目录规划助手。请基于段落索引生成两级目录树。" +
        "严格返回 JSON 数组，每个节点必须包含 title,startIndex,endIndex,children。" +
        "children 也是数组，元素同结构但 children 置为空数组。" +
        "索引使用 0-based 且必须落在输入索引范围内。不要输出任何解释文本。",
    },
    {
      role: "user",
      content: JSON.stringify({
        title,
        blocks: indexedBlocks,
        outputExample: [
          {
            title: "一级目录示例",
            startIndex: 0,
            endIndex: 10,
            children: [{ title: "二级目录示例", startIndex: 0, endIndex: 4, children: [] }],
          },
        ],
      }),
    },
  ];

  let raw = "";
  try {
    raw = await deepseekChat(messages, { temperature: 0.1, maxTokens: 1600 });
  } catch {
    return [];
  }

  const parsed = parseJsonArray(raw);
  const normalized = normalizeLlmOutlineNodes(parsed, paragraphs.length - 1);
  if (normalized.length === 0) return [];

  const plans: SectionPlan[] = [];
  normalized.forEach((node, i) => {
    const topId = `llm-${i}`;
    plans.push({
      tempId: topId,
      parentTempId: null,
      title: node.title,
      startIndex: node.startIndex,
      endIndex: node.endIndex,
      level: 1,
    });

    node.children?.forEach((child, childIndex) => {
      plans.push({
        tempId: `${topId}-${childIndex}`,
        parentTempId: topId,
        title: child.title,
        startIndex: child.startIndex,
        endIndex: child.endIndex,
        level: 2,
      });
    });
  });

  return plans.filter((plan) => plan.startIndex <= plan.endIndex);
}

function buildFallbackSectionPlans(paragraphs: Paragraph[]): SectionPlan[] {
  const sections = segmentSections(paragraphs);
  const toc = buildTocTree(sections, paragraphs);

  return toc.map((node, index) => ({
    tempId: `fallback-${index}`,
    parentTempId: null,
    title: node.title,
    startIndex: node.startIndex,
    endIndex: node.endIndex,
    level: 1,
  }));
}

function getLeafSectionPlans(sections: SectionPlan[]): SectionPlan[] {
  const parentIds = new Set(
    sections
      .map((section) => section.parentTempId)
      .filter((value): value is string => Boolean(value)),
  );

  return sections.filter((section) => !parentIds.has(section.tempId));
}

function buildTocFromSectionPlans(
  sectionPlans: SectionPlan[],
  sectionIdByTemp: Map<string, string>,
  keywordsBySectionId: Map<string, { id: string; word: string }[]>,
): TOCNode[] {
  const nodesBySectionId = new Map<string, TOCNode>();

  for (const plan of sectionPlans) {
    const id = sectionIdByTemp.get(plan.tempId);
    if (!id) continue;
    nodesBySectionId.set(id, {
      id,
      title: plan.title,
      startIndex: plan.startIndex,
      endIndex: plan.endIndex,
      children: [],
      keywords: keywordsBySectionId.get(id) ?? [],
    });
  }

  const roots: TOCNode[] = [];
  for (const plan of sectionPlans) {
    const sectionId = sectionIdByTemp.get(plan.tempId);
    if (!sectionId) continue;

    const node = nodesBySectionId.get(sectionId);
    if (!node) continue;

    if (!plan.parentTempId) {
      roots.push(node);
      continue;
    }

    const parentId = sectionIdByTemp.get(plan.parentTempId);
    const parentNode = parentId ? nodesBySectionId.get(parentId) : undefined;
    if (!parentNode) {
      roots.push(node);
      continue;
    }
    parentNode.children.push(node);
  }

  const sortTree = (items: TOCNode[]) => {
    items.sort((a, b) => a.startIndex - b.startIndex || a.endIndex - b.endIndex);
    items.forEach((item) => sortTree(item.children));
  };
  sortTree(roots);

  return roots;
}

export function buildTocFromStoredSections(
  sections: Array<{
    id: string;
    parentSectionId: string | null;
    heading: string | null;
    startBlockIndex: number;
    endBlockIndex: number;
  }>,
  keywords: Array<{ id: string; sectionId: string; word: string }>,
): TOCNode[] {
  const keywordsBySection = new Map<string, { id: string; word: string }[]>();
  for (const kw of keywords) {
    const list = keywordsBySection.get(kw.sectionId) ?? [];
    list.push({ id: kw.id, word: kw.word });
    keywordsBySection.set(kw.sectionId, list);
  }

  const nodesById = new Map<string, TOCNode>();
  for (const section of sections) {
    const title = section.heading?.trim()
      ? section.heading.trim()
      : `段落 ${section.startBlockIndex + 1}-${section.endBlockIndex + 1}`;

    nodesById.set(section.id, {
      id: section.id,
      title,
      startIndex: section.startBlockIndex,
      endIndex: section.endBlockIndex,
      children: [],
      keywords: keywordsBySection.get(section.id) ?? [],
    });
  }

  const roots: TOCNode[] = [];
  for (const section of sections) {
    const node = nodesById.get(section.id);
    if (!node) continue;

    if (!section.parentSectionId) {
      roots.push(node);
      continue;
    }
    const parent = nodesById.get(section.parentSectionId);
    if (!parent) {
      roots.push(node);
      continue;
    }
    parent.children.push(node);
  }

  const sortTree = (items: TOCNode[]) => {
    items.sort((a, b) => a.startIndex - b.startIndex || a.endIndex - b.endIndex);
    items.forEach((item) => {
      item.keywords.sort((a, b) => a.word.localeCompare(b.word, "zh-CN"));
      sortTree(item.children);
    });
  };
  sortTree(roots);

  return roots;
}

export async function parseReferenceContent(input: {
  referenceId: string;
  title: string;
  text: string;
}) {
  const paragraphs = physicalChunk(input.text);
  if (paragraphs.length === 0) {
    throw new Error("EMPTY_DOCUMENT");
  }

  let tocSource: TocSource = "rule";
  let sectionPlans = buildRuleBasedSectionPlans(paragraphs);
  if (sectionPlans.length === 0) {
    const llmSections = await buildLlmSectionPlans(input.title, paragraphs);
    if (llmSections.length > 0) {
      tocSource = "llm";
      sectionPlans = llmSections;
    } else {
      tocSource = "fallback";
      sectionPlans = buildFallbackSectionPlans(paragraphs);
    }
  }

  if (sectionPlans.length === 0) {
    throw new Error("EMPTY_DOCUMENT");
  }

  await db.insert(textBlocksTable).values(
    paragraphs.map((block) => ({
      referenceId: input.referenceId,
      content: block.content,
      positionIndex: block.index,
    })),
  );

  const sectionIdByTemp = new Map<string, string>();
  const sortedSectionPlans = [...sectionPlans].sort((a, b) =>
    a.level - b.level || a.startIndex - b.startIndex || a.endIndex - b.endIndex
  );

  for (const section of sortedSectionPlans) {
    const parentSectionId = section.parentTempId
      ? sectionIdByTemp.get(section.parentTempId) ?? null
      : null;
    const [saved] = await db.insert(sectionsTable).values({
      referenceId: input.referenceId,
      parentSectionId,
      heading: section.title,
      startBlockIndex: section.startIndex,
      endBlockIndex: section.endIndex,
      level: section.level,
    }).returning({ id: sectionsTable.id });

    if (saved?.id) {
      sectionIdByTemp.set(section.tempId, saved.id);
    }
  }

  const sectionKeywords: { sectionId: string; word: string }[] = [];
  const leafSections = getLeafSectionPlans(sectionPlans);

  for (const section of leafSections) {
    const sectionBlocks = paragraphs
      .slice(section.startIndex, section.endIndex + 1)
      .map((block) => block.content);

    const sectionId = sectionIdByTemp.get(section.tempId);
    if (!sectionId) continue;

    const messages: ChatMessage[] = [
      {
        role: "system",
        content:
          "你是知识提取专家。请根据给定标题、章节名与文本块，输出严格的 JSON 数组，" +
          "每项包含 {\"word\":\"词汇\",\"reason\":\"提取理由\",\"score\":1-5}。" +
          "仅输出 JSON，不要多余文本。",
      },
      {
        role: "user",
        content: JSON.stringify({
          title: input.title,
          sectionTitle: section.title,
          blocks: sectionBlocks,
        }),
      },
    ];

    let raw: string;
    try {
      raw = await deepseekChat(messages, { temperature: 0.2 });
    } catch (err: any) {
      throw new Error(`LLM_ERROR: ${err?.message ?? "DeepSeek request failed"}`);
    }

    const parsedWords = parseKeywordJson(raw)
      .filter((item) => Number(item.score ?? 0) >= 3)
      .map((item) => item.word)
      .filter((word) => typeof word === "string" && word.trim().length > 0);

    const refinedWords = selectKeywords(parsedWords, sectionBlocks.join("\n"));
    for (const word of refinedWords) {
      sectionKeywords.push({
        sectionId,
        word: word.trim(),
      });
    }
  }

  const keywordRows = sectionKeywords.length > 0
    ? await db.insert(keywordsTable).values(
      sectionKeywords.map((kw) => ({
        sectionId: kw.sectionId,
        textBlockId: null,
        word: kw.word,
        status: "PENDING",
      })),
    ).returning({
      id: keywordsTable.id,
      sectionId: keywordsTable.sectionId,
      word: keywordsTable.word,
      status: keywordsTable.status,
    })
    : [];

  const keywordsBySectionId = new Map<string, { id: string; word: string }[]>();
  for (const row of keywordRows) {
    const list = keywordsBySectionId.get(row.sectionId) ?? [];
    list.push({ id: row.id, word: row.word });
    keywordsBySectionId.set(row.sectionId, list);
  }

  return {
    tocSource,
    keywords: keywordRows.map((k) => ({
      id: k.id,
      word: k.word,
      isSelected: k.status === "SELECTED",
      sectionId: k.sectionId,
    })),
    toc: buildTocFromSectionPlans(sectionPlans, sectionIdByTemp, keywordsBySectionId),
  };
}
