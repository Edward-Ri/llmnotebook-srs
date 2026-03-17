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
- Phase 3 已完成最小可用前端接入。
- 当前分支：
  - `edwardli-notes-phase1-data-foundation`
  - `edwardli-notes-phase2-backend-api`
  - `edwardli-notes-phase3-frontend`

### 已知后续关注点

- `decks.ts` 与 `documents.ts` 当前的部分统计仍主要依赖 `sourceKeywordId -> sections -> references -> documents` 链路。
- 若后续出现仅写入 `sourceReferenceId`、不写入 `sourceKeywordId` 的卡片，相关统计可能需要增加 `sourceReferenceId` 优先的兜底逻辑。
- 下一阶段应进入 `04-manual-card-creation.md` 或继续补 Phase 3 交互细节。

### Phase 3：前端工作区已落地

- `materials/:id` 已重构为双栏工作区：
  - 左栏：Reference 列表、导入、原文 blocks、outline、关键词选择
  - 右栏：Notebook 列表、Note Block 编辑区
  - 底部：候选卡片校验抽屉
- 已新增前端本地 API 封装：
  - `artifacts/srs-app/src/lib/workspace-api.ts`
- 已新增组件：
  - `reference-import-dialog.tsx`
  - `reference-panel.tsx`
  - `notebook-panel.tsx`
  - `note-block-item.tsx`
  - `selection-toolbar.tsx`

### Phase 3：已实现交互

- 支持导入 Reference 并切换查看
- 支持新建 / 重命名 / 删除 Notebook
- 支持新建 text / heading 笔记块
- 支持编辑 / 删除 / 上移 / 下移笔记块
- 支持整段原文发送到 Notebook
- 支持将整段原文拖拽到 Notebook
- 支持单段落选区后通过浮动工具栏发送到 Notebook
- 支持 `quote` 块回跳原文来源

### Phase 3：提交记录

- `d558aab` `chore(frontend): add workspace api helpers`
- `65f2cb4` `feat(frontend): add reference workspace panel`
- `08ec8fb` `feat(frontend): add notebook panel and note block editing`
- `2e324a0` `refactor(frontend): rebuild material detail as phase3 workspace`
- `45fc014` `fix(frontend): update auth page mutation pending states`
- `fa1a521` `feat(frontend): add drag and drop from references to notebook`
- `7fc66ae` `feat(frontend): add selection toolbar for sending quotes to notebook`

### Phase 3：稳定性修复

- 修复工作区创建后详情页误报“找不到对应工作区”
- 修复 generated client 未带 cookie 导致的身份不一致问题
- 修复 Reference 导入在 LLM 不可用时整条失败的问题，改为关键词本地回退
- Notebook 创建失败时后端已返回更具体的 `message`

### Phase 3：提交记录（修复）

- `87807b7` `fix(frontend): stabilize workspace creation and detail loading`
- `e3e3d49` `fix(api): stabilize auth cookies and reference import fallback`

### Phase 1：迁移脚本修复

- 本地数据库按 `docs/technical/local-dev-quickstart.md` 执行迁移时，发现 `references` 作为 PostgreSQL 保留字导致 SQL 直接失败。
- 已修复以下 SQL 中对 `references` 表的引用写法，并统一补充更严格的本地执行方式：
  - `lib/db/sql/references-add.sql`
  - `lib/db/sql/text-blocks-migrate-to-reference.sql`
  - `lib/db/sql/sections-migrate-to-reference.sql`
  - `lib/db/sql/note-blocks-add.sql`
  - `lib/db/sql/flashcards-notes-fields-add.sql`
  - `lib/db/sql/card-candidates-notes-fields-add.sql`
  - `docs/technical/local-dev-quickstart.md`
- 本地数据库已重新执行并校验通过：
  - `references`
  - `note_pages`
  - `note_blocks`
  - `text_blocks.reference_id`
  - `sections.reference_id`
  - `flashcards.source_note_block_id`
  - `flashcards.source_reference_id`
  - `flashcards.generation_mode`
  - `card_candidates.source_note_block_id`
  - `card_candidates.source_reference_id`
  - `card_candidates.generation_mode`

### Phase 1：提交记录（迁移修复）

- `d43a4b0` `fix(db): correct phase1 postgres migration scripts`

### Phase 3.1：Notebook 富文本编辑器已落地

- 已给 `note_pages` 增加 `content_doc JSONB`，并补充 Drizzle schema：
  - `lib/db/sql/note-pages-content-doc-add.sql`
  - `lib/db/src/schema/notePages.ts`
- 已新增 Notebook 文档接口：
  - `GET /api/notebooks/:notebookId/doc`
  - `PUT /api/notebooks/:notebookId/doc`
- `GET /doc` 已支持从旧 `note_blocks` 一次性组装 Tiptap JSON，并回写 `content_doc`。
- 已新增前端文档级 API：
  - `getNotebookDoc()`
  - `saveNotebookDoc()`
- 右栏 Notebook 已从块级编辑重构为 Tiptap 富文本编辑器：
  - 支持自动保存
  - 支持标题内联编辑
  - 支持 `sourceBlockquote` 来源引用块渲染
  - 支持 Bubble Menu
  - 支持 Slash Command 第一版
- `notebook-panel.tsx` 已重构为：
  - 列表视图
  - 编辑器视图
- 已打通 `Reference -> NotebookEditor` 拖拽插入链路，支持插入 `sourceBlockquote`。

### Phase 3.1：本轮交互收敛

- 已移除原文段落上的“送到笔记”按钮，只保留拖拽入口。
- 已下线“选区发送到笔记”旧链路，并删除：
  - `artifacts/srs-app/src/components/selection-toolbar.tsx`
- 已清理 `material-detail.tsx` 中旧 `note_blocks` 页面层 handler，Notebook 主流程已基本脱离旧块级编辑模型。

### Phase 3.1：交互修复

- 修复原文区“只能拖整段、不能拖选中文本”的问题：
  - 取消整段卡片 `draggable`
  - 增加整段拖拽把手
  - 支持“框选文字后直接拖动”仅引用片段
- 修复 Slash Command “只能鼠标点选、不能键盘确认”的问题：
  - 支持 `ArrowUp`
  - 支持 `ArrowDown`
  - 支持 `Enter`
  - 支持 `Tab`
  - 支持 `Escape`
- 已优化编辑器内拖拽反馈：
  - 容器高亮
  - 插入线
  - 无法精确定位时提示“将追加到文末”
  - drop 后轻提示“已插入引用”

### Phase 3.1：提交记录

- `c6d03b4` `feat(db+api): add notebook document storage`
- `e376c83` `feat(frontend): add tiptap notebook editor core`
- `3b75dee` `refactor(frontend): restructure notebook panel as list and editor views`
- `82c3a09` `feat(frontend): integrate reference drag into notebook editor`
- `ec95a8f` `refactor(frontend): remove send-to-notebook button`
- `e24b7ce` `refactor(frontend): remove legacy note block handlers from workspace`
- `e1e843a` `feat(frontend): add slash command menu to notebook editor`
- `3335989` `feat(frontend): improve notebook editor drag feedback`
- `fa533a3` `refactor(frontend): remove selection-to-notebook legacy flow`
- `d338dc5` `fix(frontend): support dragging selected text from references`
- `9b239d5` `fix(frontend): support keyboard navigation in slash command menu`

### Phase 3.1：验证记录

- 已执行：
  - `pnpm run typecheck:libs`
  - `pnpm --filter @workspace/api-server run typecheck`
  - `pnpm --filter @workspace/srs-app run typecheck`
- 已验证：
  - `GET /api/healthz` 返回 `{"status":"ok"}`
  - `GET /api/notebooks/:id/doc` 可正确读取 Notebook 文档
  - `PUT /api/notebooks/:id/doc` 可正确保存并回读
  - 旧 `note_blocks` 可自动迁移为 `sourceBlockquote`
  - `note_pages.content_doc` 已实际落库
- 当前剩余验证重点主要是浏览器真实交互层：
  - 选区拖拽在真实页面中的稳定性
  - Slash Command 与输入法场景的兼容性

### 当前状态（更新）

- Phase 1 已完成，并已补齐本地 PostgreSQL 迁移修复。
- Phase 2 已完成。
- Phase 3 已完成。
- Phase 3.1 已完成主链路：
  - 文档级 Notebook 存储
  - Tiptap 编辑器
  - 自动保存
  - 列表/编辑器两级视图
  - Reference 拖拽引用
  - Slash Command 第一版
- 当前分支：
  - `v0.2-notebook-editor`

### 已知后续关注点（更新）

- 下一阶段可以转入 `04-manual-card-creation.md` 的手动出卡闭环。
- 若继续完善编辑器体验，优先级较高的是：
  - 引用块“查看来源 / 跳转来源”
  - 浏览器真实交互回归
  - Slash Command 在输入法下的兼容性
