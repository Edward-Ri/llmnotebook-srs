## 数据库与 API 接入记录（2026-03-13 ~ 2026-03-17）

> 说明：本文件保留按日期的演进记录；当前有效状态以 `docs/technical/backend-tech-doc.md` 与 `docs/technical/database-tech-doc.md` 为准。

### 2026-03-13

- 落地 SQL-new 主结构：
  - `reading-materials.sql`
  - `keywords-add.sql`
  - `decks-tree-add.sql`
  - `flashcards-add.sql`
- `keywords`、`decks`、`flashcards` 的 UUID 结构接入完成
- OpenAPI / Zod / React Client 的 ID 类型统一为 UUID string

### 2026-03-14

- 新增 `users`
- `documents` / `decks` 增加 `user_id`
- 完成 JWT + Cookie 鉴权
- 受保护资源开始按用户隔离

### 2026-03-15

- 补齐复习链路：
  - `flashcards` SM-2 字段
  - `review_logs`
- 恢复候选卡片链路：
  - `card_candidates`
  - `cards/generate`
  - `cards/pending`
  - `cards/validate/batch`
  - `cards/batch-assign-deck`
- 修复统计与时区边界问题

### 2026-03-17

#### Phase 1：数据地基

- 新增：
  - `references`
  - `note_pages`
  - `note_blocks`
- 迁移：
  - `text_blocks.document_id -> reference_id`
  - `sections.document_id -> reference_id`
- 扩展：
  - `flashcards.source_note_block_id`
  - `flashcards.source_reference_id`
  - `flashcards.generation_mode`
  - `card_candidates.source_note_block_id`
  - `card_candidates.source_reference_id`
  - `card_candidates.generation_mode`

#### Phase 2：后端 API

- 新增：
  - `references.ts`
  - `notes.ts`
  - `referenceParser.ts`
- 新接口：
  - `POST /api/documents/:documentId/references`
  - `GET /api/documents/:documentId/references`
  - `GET /api/references/:referenceId/outline`
  - `GET /api/references/:referenceId/blocks`
  - `DELETE /api/references/:referenceId`
  - `GET /api/documents/:documentId/notebooks`
  - `POST /api/documents/:documentId/notebooks`
  - `PATCH /api/notebooks/:notebookId`
  - `DELETE /api/notebooks/:notebookId`
  - `GET /api/notebooks/:notebookId/blocks`
  - `POST /api/notebooks/:notebookId/blocks`
  - `PATCH /api/notes/blocks/:blockId`
  - `DELETE /api/notes/blocks/:blockId`
  - `PATCH /api/notebooks/:notebookId/reorder`

#### 旧接口适配

- `documents`
- `cards`
- `decks`

均已改为通过 `references` 回到工作区，不再依赖 `text_blocks.document_id` 或 `sections.document_id`。

#### 废弃项

- `POST /api/documents/analyze` 已废弃，当前返回 `410`

#### 校验

- `pnpm run typecheck:libs` 通过
- `pnpm --filter @workspace/api-server run typecheck` 通过
- 本地 `GET /api/healthz` 返回 `{"status":"ok"}`
