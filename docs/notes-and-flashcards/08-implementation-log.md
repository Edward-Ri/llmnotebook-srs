## 实施日志

> 本文件用于持续记录 `docs/notes-and-flashcards` 各 Phase 的实际落地情况、校验结果与遗留事项。

---

## 2026-03-17

### Phase 1：数据地基已完成

- 已新增 `references`、`note_pages`、`note_blocks` 的 Drizzle schema 与 SQL 脚本。
- 已将 `text_blocks`、`sections` 的归属从 `document_id` 切换为 `reference_id`。
- 已为 `flashcards`、`card_candidates` 增加：
  - `source_note_block_id`
  - `source_reference_id`
  - `generation_mode`
- 已补齐对应迁移脚本，支持旧 `document` 数据平滑迁移到 `references`。

### Phase 1：提交记录

- `4753a26` `feat(db): add references table for workspace materials`
- `bcde6ee` `feat(db): add notebook pages and note blocks tables`
- `247e098` `refactor(db): migrate text blocks and sections to references`
- `430e172` `feat(db): extend card sources for notes and references`

### Phase 2：后端 API 已完成

- 已提取共享解析服务 `referenceParser`，将原 `documents/analyze` 的核心解析逻辑迁移为基于 `reference` 的实现。
- 已新增 Reference 路由：
  - `POST /api/documents/:documentId/references`
  - `GET /api/documents/:documentId/references`
  - `GET /api/references/:referenceId/outline`
  - `GET /api/references/:referenceId/blocks`
  - `DELETE /api/references/:referenceId`
- 已新增 Notebook / Note Block 路由：
  - `GET /api/documents/:documentId/notebooks`
  - `POST /api/documents/:documentId/notebooks`
  - `PATCH /api/notebooks/:notebookId`
  - `DELETE /api/notebooks/:notebookId`
  - `GET /api/notebooks/:notebookId/blocks`
  - `POST /api/notebooks/:notebookId/blocks`
  - `PATCH /api/notes/blocks/:blockId`
  - `DELETE /api/notes/blocks/:blockId`
  - `PATCH /api/notebooks/:notebookId/reorder`
- 已适配现有路由：
  - `documents`
  - `cards`
  - `decks`
- `POST /api/documents/analyze` 已废弃，返回 `410`，提示改用新的 Reference 导入接口。

### Phase 2：提交记录

- `7fae792` `refactor(api): extract reference parsing service`
- `70970ff` `feat(api): add reference management routes`
- `2f26adc` `feat(api): add notebook and note block routes`
- `911d4e3` `refactor(api): adapt existing routes to references and notes`

### 校验记录

- 已执行 `pnpm install --no-frozen-lockfile`，依赖安装成功。
- 已执行 `pnpm run typecheck:libs`，通过。
- 已执行 `pnpm --filter @workspace/api-server run typecheck`，最终通过。
- 已使用临时环境变量 `PORT=4000` 启动 `artifacts/api-server`。
- 已验证 `GET /api/healthz` 返回 `{"status":"ok"}`。

### 补充修复

- 修复 `artifacts/api-server/src/tests/documents.test.ts` 中的 `.ts` 扩展名导入问题。
- 提交记录：
  - `0c6f3ff` `fix(api-server): remove ts extension from test import`

### 当前状态

- Phase 1 已完成。
- Phase 2 已完成。
- 当前分支：
  - `edwardli-notes-phase1-data-foundation`
  - `edwardli-notes-phase2-backend-api`

### 已知后续关注点

- `decks.ts` 与 `documents.ts` 当前的部分统计仍主要依赖 `sourceKeywordId -> sections -> references -> documents` 链路。
- 若后续出现仅写入 `sourceReferenceId`、不写入 `sourceKeywordId` 的卡片，相关统计可能需要增加 `sourceReferenceId` 优先的兜底逻辑。
- 下一阶段应进入 `03-notebook-frontend.md` 的前端接入。
