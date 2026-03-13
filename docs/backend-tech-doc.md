## 后端技术文档（artifacts/api-server）

### 1. 概览

- **名称**：`@workspace/api-server`
- **职责**：
  - 提供前端所需的 REST API（文档解析、关键词筛选、卡片生成与校验、SM-2 复习、统计分析等）。
  - 作为中间层协调数据库（`@workspace/db`）、OpenAI/LLM 服务以及前端应用。
- **主要技术栈**：
  - Node.js + TypeScript
  - Web 框架：基于 Express/Fastify 风格的 HTTP 服务器（封装在 `artifacts/api-server` 内）
  - 数据库访问：`@workspace/db`（Drizzle ORM + PostgreSQL）
  - 校验与类型：`zod`

### 2. 目录结构（后端包内）

- `artifacts/api-server/`
  - `src/routes/`：路由定义（例如 `cards.ts`、`auth.ts`、`analytics.ts`）
  - `src/utils/`：后端使用的工具函数与通用逻辑
  - `src/tests/`：与关键工具/流程对应的 Node 测试脚本

本节重点补充今日新增的 **文本物理切分 + Section 分段 + TOC 构建** 相关工具。

### 3. 文本物理切分与 Section 分段（physicalChunking）

- 文件：`artifacts/api-server/src/utils/physicalChunking.ts`
- 类型定义：
  - `Paragraph`：
    - `{ index: number; content: string }`
    - 表示干净文本中的一段“物理段落”，`index` 为在当前文本中的序号。
  - `Section`：
    - `{ id: number; startIndex: number; endIndex: number }`
    - 表示一组连续段落构成的物理 section，索引用 `Paragraph.index`。
  - `TOCNode`：
    - `{ id: string; title: string; startIndex: number; endIndex: number; children: TOCNode[]; keywords: string[] }`
    - 表示前端/后端可共享的 TOC 树节点结构。

#### 3.1 `physicalChunk(cleanText: string): Paragraph[]`

- **输入**：原始长文本（可能包含 `\r\n`、`\r`、空行、很短的噪声行等）。
- **处理流程**：
  - 标准化换行符为 `\n`。
  - 按行拆分后逐行 `trim()`。
  - 过滤掉空行或长度过短（<5 字符）的行。
  - 为每条有效行分配自增的 `index`，并以 `Paragraph[]` 返回。
- **用途**：为 Section 划分与后续 TOC 构建提供稳定的“物理段落 blocks”。

#### 3.2 `segmentSections(blocks: Paragraph[]): Section[]`

- **输入**：由 `physicalChunk` 生成的 `Paragraph[]`。
- **当前实现（原型阶段）**：
  - 每 4 个段落划分为一个 `Section`：
    - 第 1 个 section：`[0, 3]`
    - 第 2 个 section：`[4, 7]`
    - 末尾不足 4 个时，最后一个 section 覆盖到 `blocks.length - 1`。
  - `id` 为从 0 开始自增的整数。
- **用途**：在尚未引入真实 heading/层级信息之前，先提供一种可预测的物理分段方式，便于原型阶段开发和实验。

### 4. TOC 构建：`buildTocTree`

- 函数签名：

```ts
export function buildTocTree(sections: Section[], blocks: Paragraph[]): TOCNode[]
```

- **当前行为（最小可用实现）**：
  - 遍历所有 `Section`，为每个 `Section` 创建一个 `TOCNode` 根节点。
  - 标题 `title`：
    - 优先取 `blocks[section.startIndex].content`，即该 section 第一个段落的文本。
    - 若超长，则截断到约 80 字符并加上省略号，避免在前端 TOC 视图中过长。
    - 若 blocks 为空或索引越界，则回退为占位标题 `Section ${section.id}`。
  - 区间：
    - `startIndex`：`section.startIndex`，不小于 0。
    - `endIndex`：`section.endIndex`，不超过 `blocks.length - 1`。
  - 树结构：
    - 目前阶段所有节点都放在顶层（`children: []`），相当于一个“扁平 TOC”，后续会根据 heading/level 引入真正的树形结构。
  - 关键词：
    - `keywords: []`，保留字段用于后续从标题和正文中提取关键词。

- **后续演进方向**：
  - 当 `Paragraph` 或上游段落模型中具备 `type: "heading"` 与 `level` 信息后，将替换当前的“每 4 段一组 + 扁平 TOC”方案：
    - 使用经典的基于栈的 heading 解析算法，根据 `level` 构建多层级 TOC 树。
    - 将 `TOCNode.startIndex` / `endIndex` 精细化到“一个标题所覆盖的段落区间”。
  - 与数据库层 `documents` / `text_blocks` / `sections` 表结构（见 `database-tech-doc.md` 第 4 章）打通，使 TOC 树与持久化数据一一对应。

### 5. 测试：`physicalChunking.test.ts`

- 文件：`artifacts/api-server/src/tests/physicalChunking.test.ts`
- 覆盖点：
  - `physicalChunk`：
    - 过滤空行与过短行。
    - 处理混合换行符（`\n` / `\r\n` / `\r`）。
  - `segmentSections`：
    - 空数组 → 空 sections。
    - 1–4 段 → 单一 section。
    - 更长文本的分段边界。
  - `buildTocTree`：
    - 每个 section 对应一个 `TOCNode` 根节点。
    - 标题取自 section 起始段落内容，区间与 `Section.startIndex` / `endIndex` 对齐。

> 以上内容对应的最新提交：`feat(api): add basic TOC tree builder`，分支：`feat/notebooklm-layout-and-auth`。

