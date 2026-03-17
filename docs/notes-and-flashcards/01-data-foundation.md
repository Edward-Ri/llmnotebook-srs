## Phase 1：数据地基

> 对应开发流程 Phase 1。本文件定义「工作区 + Reference + 多 Notebook + 闪卡来源扩展」所需的全部数据库结构变更，包括新增表与现有表的字段修改。所有变更一次性完成，为后续所有 Phase 打好基础。

---

### 0. 架构概览

改造后的数据层级关系：

```
documents（工作区容器）
├── references（导入的学习材料，每份独立解析）
│   ├── text_blocks（段落）
│   ├── sections（目录结构）
│   │   └── keywords（关键词）
│   └── ...
├── note_pages（多本 Notebook）
│   └── note_blocks（笔记块）
└── card_candidates / flashcards（卡片，工作区级别）
```

### 1. 新增表：references

```text
references
----------
- id              uuid        PK
- document_id     uuid        NOT NULL, FK → documents.id
- user_id         uuid        NOT NULL, FK → users.id
- title           varchar(255) NOT NULL
- created_at      timestamp   NOT NULL, default now()
- updated_at      timestamp   NOT NULL, default now()
```

- **设计要点**：
  - 每次用户在工作区中「导入新 Reference」就新增一行。
  - 解析流程（段落拆分 + 目录生成 + 关键词提取）绑定到该 reference。
  - `title` 用于在 UI 的 Reference 切换器中展示，初始值可为用户输入或从文本首行推断。
- **索引建议**：
  - `(document_id, user_id)` 组合索引，便于按工作区列出 references。

### 2. 修改现有表：text_blocks

```text
text_blocks（ALTER）
-----------
- document_id     → 替换为 reference_id
+ reference_id    uuid        NOT NULL, FK → references.id
```

- **变更说明**：
  - 原 `document_id` 列替换为 `reference_id`，text_block 直接关联到具体 reference。
  - 通过 `references.document_id` 可间接获取工作区级别关联。
- **索引调整**：
  - 原 `text_blocks_document_id_idx` → 改为 `text_blocks_reference_id_idx`。
  - 原 `text_blocks_document_id_position_index_uq` → 改为 `(reference_id, position_index)` 唯一索引。

### 3. 修改现有表：sections

```text
sections（ALTER）
--------
- document_id     → 替换为 reference_id
+ reference_id    uuid        NOT NULL, FK → references.id
```

- **变更说明**：
  - 原 `document_id` 列替换为 `reference_id`。
  - `parent_section_id` 关系不变（仍为 sections 表内自引用）。
- **索引调整**：
  - 原 `sections_document_id_idx` → 改为 `sections_reference_id_idx`。

### 4. 新增表：note_pages

```text
note_pages
----------
- id              uuid        PK
- user_id         uuid        NOT NULL, FK → users.id
- document_id     uuid        NOT NULL, FK → documents.id
- title           varchar(255) NOT NULL
- created_at      timestamp   NOT NULL, default now()
- updated_at      timestamp   NOT NULL, default now()
```

- **设计要点**：
  - 每个工作区（document）下可创建多本 Notebook，**不设 `(user_id, document_id)` 唯一索引**。
  - `title` 用于在 Notebook 选择器中展示，如 "课堂笔记"、"复习要点" 等。
- **索引建议**：
  - `(document_id, user_id)` 组合索引，便于按工作区列出 Notebooks。

### 5. 新增表：note_blocks

```text
note_blocks
-----------
- id                    uuid        PK
- page_id               uuid        NOT NULL, FK → note_pages.id
- user_id               uuid        NOT NULL, FK → users.id
- document_id           uuid        NOT NULL, FK → documents.id
- source_text_block_id  uuid        NULL, FK → text_blocks.id
- source_reference_id   uuid        NULL, FK → references.id
- content               text        NOT NULL
- block_type            varchar(32) NOT NULL, default 'text'
- position_index        int         NOT NULL
- selection_offset      int         NULL
- selection_length       int         NULL
- created_at            timestamp   NOT NULL, default now()
- updated_at            timestamp   NOT NULL, default now()
```

- **字段说明**：
  - `page_id`：所属 Notebook 页面。
  - `user_id` / `document_id`：冗余存储，便于查询与权限校验。写入时需确保与其 page 的值一致。
  - `source_text_block_id`：如为 `quote` 类型块，记录来源的 `text_blocks.id`，便于回溯原文。可为空，用于普通文本笔记。
  - `source_reference_id`：记录引用来源所属的 reference，便于 UI 展示「引自 Reference A · 第 N 段」。
  - `block_type`：预期值 `"text" | "quote" | "heading"` 等，便于前端按类型渲染不同样式。
  - `position_index`：表示块的顺序。允许间隙（如删除后不强制重排）。
  - `selection_offset` / `selection_length`：若用户选中部分文本（非整段）发送到笔记，记录选区在原 text_block 中的偏移和长度。

- **索引建议**：
  - `(page_id, position_index)` 组合索引，方便按顺序获取页面内所有块。
  - `(document_id, user_id)` 索引，便于按工作区/用户聚合查询。

### 6. 扩展现有表：flashcards

在现有 `flashcards` 表上新增以下字段：

```text
flashcards（ALTER ADD）
----------
+ source_note_block_id   uuid        NULL, FK → note_blocks.id
+ source_reference_id    uuid        NULL, FK → references.id
+ generation_mode        varchar(32) NOT NULL, DEFAULT 'keyword'
```

- `source_note_block_id`：记录卡片来源的笔记块（若从 Notebook 出卡），`ON DELETE SET NULL`。
- `source_reference_id`：记录卡片来源的 reference，`ON DELETE SET NULL`。
- `generation_mode`：标识生成模式，取值说明：
  - `"keyword"`：关键词驱动模式（默认值，兼容旧数据）。
  - `"selection_manual_front"`：选区作为背面、用户自拟正面。
  - `"selection_ai"`：选区作为上下文，由 AI 自动生成 Q/A。
  - `"q_to_a"`：用户写问题，AI 生成答案。
  - `"a_to_q"`：用户写答案，AI 生成问题。

> 现有字段 `source_keyword_id` 和 `source_text_block_id` 保持不变，与新增字段并存。

### 7. 扩展现有表：card_candidates

在现有 `card_candidates` 表上新增以下字段：

```text
card_candidates（ALTER ADD）
----------------
+ source_note_block_id   uuid        NULL, FK → note_blocks.id
+ source_reference_id    uuid        NULL, FK → references.id
+ generation_mode        varchar(32) NOT NULL, DEFAULT 'keyword'
```

- 字段含义与 `flashcards` 中的对应字段完全一致。
- `document_id` 保持为工作区级别 FK，不做变更。

### 8. 与现有 Schema 的关系与删除策略

- `references.document_id`：`ON DELETE CASCADE`（删除工作区时清理所有 reference）。
- `references.user_id`：`ON DELETE CASCADE`（用户被删除时清理）。
- `text_blocks.reference_id`：`ON DELETE CASCADE`（删除 reference 时清理段落）。
- `sections.reference_id`：`ON DELETE CASCADE`（删除 reference 时清理目录）。
- `note_pages.user_id`：`ON DELETE CASCADE`。
- `note_pages.document_id`：`ON DELETE CASCADE`（删除工作区时清理 Notebook）。
- `note_blocks.page_id`：`ON DELETE CASCADE`（删除 Notebook 时清理块）。
- `note_blocks.source_text_block_id`：`ON DELETE SET NULL`（原文块被删时保留笔记块，去除引用）。
- `note_blocks.source_reference_id`：`ON DELETE SET NULL`。
- `flashcards.source_note_block_id` / `card_candidates.source_note_block_id`：`ON DELETE SET NULL`。
- `flashcards.source_reference_id` / `card_candidates.source_reference_id`：`ON DELETE SET NULL`。

### 9. 数据迁移策略

针对现有数据的平滑迁移：

1. **为每个现有 document 创建一条 reference**：`INSERT INTO references (document_id, user_id, title) SELECT id, user_id, title FROM documents`。
2. **迁移 text_blocks**：新增 `reference_id` 列，通过 document_id 关联到刚创建的 reference，然后删除 `document_id` 列。
3. **迁移 sections**：同理，新增 `reference_id` 列后删除 `document_id` 列。
4. 迁移脚本一次性执行，包含在同一个事务中。

### 10. 实现清单

1. 新建 `lib/db/src/schema/references.ts`
2. 新建 `lib/db/src/schema/notePages.ts`
3. 新建 `lib/db/src/schema/noteBlocks.ts`
4. 更新 `lib/db/src/schema/textBlocks.ts`（`document_id` → `reference_id`）
5. 更新 `lib/db/src/schema/sections.ts`（`document_id` → `reference_id`）
6. 更新 `lib/db/src/schema/flashcards.ts`（增加 `sourceNoteBlockId`、`sourceReferenceId`、`generationMode`）
7. 更新 `lib/db/src/schema/cardCandidates.ts`（同上）
8. 更新 `lib/db/src/schema/index.ts`（增加新表导出）
9. 新建 `lib/db/sql/references-add.sql`
10. 新建 `lib/db/sql/text-blocks-migrate-to-reference.sql`
11. 新建 `lib/db/sql/sections-migrate-to-reference.sql`
12. 新建 `lib/db/sql/note-pages-add.sql`
13. 新建 `lib/db/sql/note-blocks-add.sql`
14. 新建 `lib/db/sql/flashcards-notes-fields-add.sql`
15. 新建 `lib/db/sql/card-candidates-notes-fields-add.sql`
