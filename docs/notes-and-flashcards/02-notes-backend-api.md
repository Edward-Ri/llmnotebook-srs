## Phase 2：Reference + Notes 后端 API

> 对应开发流程 Phase 2。本文件定义 Reference 管理（导入、列表、删除、解析）以及 Notebook 笔记相关的后端 REST API。数据结构参见 `01-data-foundation.md`。

---

### 1. Reference 管理 API

#### 1.1 路由挂载

- 新建 `artifacts/api-server/src/routes/references.ts`。
- 在 `routes/index.ts` 中挂载：`router.use("/references", referencesRouter)`。
- 工作区级别的 reference 接口挂在 documents 子路径下。

#### 1.2 导入新 Reference（含解析）

- **Endpoint**：`POST /api/documents/:documentId/references`
- **鉴权**：`requireAuth`，校验用户拥有该 document。
- **请求体**：

```ts
type ImportReferenceRequest = {
  title: string;
  text: string;
};
```

- **行为**：
  1. 在 `references` 表中插入一条记录。
  2. 执行解析流程（复用现有 `physicalChunk` + `buildSections` + keyword extraction 逻辑）：
     - 将文本拆分为段落，写入 `text_blocks`（`reference_id` 指向新 reference）。
     - 构建目录结构，写入 `sections`（`reference_id` 指向新 reference）。
     - 为叶子 section 提取关键词，写入 `keywords`。
  3. 返回完整的 reference 信息 + TOC + keywords。
- **响应**：

```ts
type ImportReferenceResponse = {
  reference: {
    id: string;
    documentId: string;
    title: string;
    createdAt: string;
  };
  tocSource: "rule" | "llm" | "fallback";
  toc: TOCNode[];
  keywords: { id: string; word: string; sectionId: string; isSelected: boolean }[];
};
```

> **重构说明**：现有 `POST /api/documents/analyze` 的核心解析逻辑（`documents.ts` L525-L708）应提取为共享函数 `parseReferenceContent(referenceId, text, docTitle)`，由此接口调用。原 `/api/documents/analyze` 可废弃或转为调用此接口的兼容层。

#### 1.3 列出工作区下所有 Reference

- **Endpoint**：`GET /api/documents/:documentId/references`
- **鉴权**：`requireAuth`，校验用户拥有该 document。
- **响应**：

```ts
type ListReferencesResponse = {
  references: {
    id: string;
    title: string;
    createdAt: string;
    textBlockCount: number;
    keywordCount: number;
  }[];
};
```

#### 1.4 获取单个 Reference 的目录与关键词

- **Endpoint**：`GET /api/references/:referenceId/outline`
- **鉴权**：`requireAuth`，需校验 `reference.user_id === req.user.id`。
- **行为**：查询该 reference 下的 sections 和 keywords，构建 TOC 树返回。
- **响应**：与现有 `GET /api/documents/:documentId/outline` 结构一致。

#### 1.5 获取 Reference 的原文段落

- **Endpoint**：`GET /api/references/:referenceId/blocks`
- **鉴权**：`requireAuth`。
- **响应**：

```ts
type ReferenceBlocksResponse = {
  blocks: {
    id: string;
    content: string;
    positionIndex: number;
  }[];
};
```

#### 1.6 删除 Reference

- **Endpoint**：`DELETE /api/references/:referenceId`
- **鉴权**：`requireAuth`，需校验归属。
- **行为**：硬删。由于 `ON DELETE CASCADE`，关联的 text_blocks、sections、keywords 自动清理。

#### 1.7 关键词选择与卡片生成

- 现有 `PUT /api/documents/:documentId/keywords` 接口需调整：关键词现在通过 sections → references 关联，查询时需 JOIN references 表。
- 现有 `POST /api/cards/generate` 接口基本不变，但内部查询路径需从 `sections.document_id` 改为 `sections.reference_id` → `references.document_id`。

---

### 2. Notebook 管理 API

#### 2.1 路由挂载

- 新建 `artifacts/api-server/src/routes/notes.ts`。
- 在 `routes/index.ts` 中挂载：`router.use("/notes", notesRouter)`。
- 工作区级别的 Notebook 接口挂在 documents 子路径下。

#### 2.2 列出工作区下所有 Notebook

- **Endpoint**：`GET /api/documents/:documentId/notebooks`
- **鉴权**：`requireAuth`，校验用户拥有该 document。
- **响应**：

```ts
type ListNotebooksResponse = {
  notebooks: {
    id: string;
    title: string;
    blockCount: number;
    createdAt: string;
    updatedAt: string;
  }[];
};
```

#### 2.3 创建新 Notebook

- **Endpoint**：`POST /api/documents/:documentId/notebooks`
- **鉴权**：`requireAuth`。
- **请求体**：

```ts
type CreateNotebookRequest = {
  title: string;
};
```

- **响应**：返回创建后的完整 NotePage 对象。

#### 2.4 更新 Notebook 标题

- **Endpoint**：`PATCH /api/notebooks/:notebookId`
- **鉴权**：`requireAuth`，需校验 `note_pages.user_id === req.user.id`。
- **请求体**：

```ts
type UpdateNotebookRequest = {
  title?: string;
};
```

#### 2.5 删除 Notebook

- **Endpoint**：`DELETE /api/notebooks/:notebookId`
- **鉴权**：`requireAuth`。
- **行为**：硬删。由于 `ON DELETE CASCADE`，关联的 note_blocks 自动清理。

---

### 3. Note Block CRUD API

#### 3.1 获取 Notebook 的全部笔记块

- **Endpoint**：`GET /api/notebooks/:notebookId/blocks`
- **鉴权**：`requireAuth`，需确保 `page.user_id === req.user.id`。
- **行为**：按 `position_index` 升序返回当前页全部块。
- **响应**：

```ts
type NoteBlock = {
  id: string;
  pageId: string;
  userId: string;
  documentId: string;
  sourceTextBlockId: string | null;
  sourceReferenceId: string | null;
  content: string;
  blockType: "text" | "quote" | "heading";
  positionIndex: number;
  selectionOffset: number | null;
  selectionLength: number | null;
  createdAt: string;
  updatedAt: string;
};
```

#### 3.2 新增笔记块

- **Endpoint**：`POST /api/notebooks/:notebookId/blocks`
- **鉴权**：`requireAuth`，需校验用户与 Notebook 归属。
- **用途**：
  - 从 Notebook 内部新建空白文本块。
  - 从原文「发送到笔记」或拖拽，创建引用块。
- **请求体**：

```ts
type CreateNoteBlockRequest = {
  content: string;
  blockType?: "text" | "quote" | "heading";
  sourceTextBlockId?: string | null;
  sourceReferenceId?: string | null;
  selectionOffset?: number | null;
  selectionLength?: number | null;
  insertAtIndex?: number | null;  // 指定插入位置；为空时追加到末尾
};
```

- **行为**：
  - 若提供 `insertAtIndex`：将该位置及之后的块的 `position_index` 各加 1，新块取 `insertAtIndex`。
  - 若未提供：取当前最大 `position_index + 1`。
  - 返回创建后的完整 NoteBlock。

#### 3.3 更新笔记块内容

- **Endpoint**：`PATCH /api/notes/blocks/:blockId`
- **鉴权**：`requireAuth`，需校验 `note_blocks.user_id === req.user.id`。
- **请求体**：

```ts
type UpdateNoteBlockRequest = {
  content?: string;
  blockType?: "text" | "quote" | "heading";
};
```

#### 3.4 删除笔记块

- **Endpoint**：`DELETE /api/notes/blocks/:blockId`
- **鉴权**：同上。
- **行为**：硬删。不强制重排其余块的 `position_index`。

#### 3.5 重排笔记块顺序

- **Endpoint**：`PATCH /api/notebooks/:notebookId/reorder`
- **鉴权**：`requireAuth`。
- **请求体**：

```ts
type ReorderNoteBlocksRequest = {
  blockIdsInOrder: string[];
};
```

- **行为**：根据数组顺序重写对应块的 `position_index`。

---

### 4. 鉴权与数据隔离

- 所有接口通过 `requireAuth` 中间件获取 `req.user.id`。
- Reference 接口通过 `references.user_id` 和 `references.document_id` 双重校验。
- Notes 接口通过 `note_pages.user_id` 和 `note_blocks.user_id` 校验。
- 对访客用户：行为与正式用户一致，遵循现有访客过期策略。

### 5. 错误码约定

- `404`：reference / notebook / note_block 不存在。
- `403`：资源归属校验失败（`user_id` 不匹配）。
- `400`：请求体校验失败（zod 校验不通过）。

### 6. 与卡片系统的预留集成点

- `note_blocks` 中保留 `source_text_block_id` 和 `source_reference_id`，便于后续：
  - 从笔记块反查原文和来源 reference。
  - 基于笔记块/原文上下文生成卡片。
- `flashcards` / `card_candidates` 中的 `source_note_block_id`、`source_reference_id`、`generation_mode` 字段由 Phase 4/5 的出卡接口负责写入。

### 7. 对现有接口的影响

以下接口需要适配 `text_blocks.reference_id` 和 `sections.reference_id` 的变更：

- `GET /api/documents/:documentId/keywords`：JOIN 路径改为 `keywords → sections → references`，增加 `WHERE references.document_id = :documentId`。
- `PUT /api/documents/:documentId/keywords`：同上。
- `POST /api/cards/generate`：内部查询 text_blocks 时改用 `reference_id`。
- `GET /api/documents/:documentId/outline`：可废弃或改为聚合所有 references 的 outline。
- `GET /api/documents`（列表）：原来拼接 text_blocks 内容的逻辑需改为通过 references → text_blocks 查询。

### 8. 实现清单

1. 新建 `artifacts/api-server/src/routes/references.ts`（约 200–250 行）
2. 新建 `artifacts/api-server/src/routes/notes.ts`（约 200–250 行）
3. 提取 `artifacts/api-server/src/services/referenceParser.ts`（从 documents.ts 中抽离解析逻辑）
4. 更新 `artifacts/api-server/src/routes/documents.ts`（调整关键词查询 JOIN 路径、废弃 /analyze）
5. 更新 `artifacts/api-server/src/routes/index.ts`（挂载新路由）
6. 为每个接口增加 zod 请求体校验
