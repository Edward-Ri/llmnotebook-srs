## 开发路线图与版本控制

> 本文件从整体视角汇总工作区 + Reference + 多 Notebook + 闪卡闭环的开发流程、Phase 依赖关系、里程碑、工作量预估与版本控制建议。各 Phase 的详细技术设计参见对应编号文档。

---

### 1. 总体策略

- **分阶段、可回滚**：每个 Phase 只引入一组相对独立的能力，控制改动半径。
- **优先打通最小闭环**：先实现「工作区 + Reference + Notebook + 手动出卡 + 复习」，再逐步增加 AI 辅助与高级能力。
- **数据结构向前兼容**：新增字段与表采用可空/默认值策略，避免破坏现有数据。
- **先地基后业务**：数据层变更一次性做完，避免反复迁移。

### 2. 开发流程与依赖关系

```
Phase 1（数据地基）  →  01-data-foundation.md
  ↓                      新增 references 表、修改 text_blocks/sections、
                         新增 note_pages/note_blocks、扩展 flashcards/card_candidates
Phase 2（后端 API）  →  02-notes-backend-api.md
  ↓                      Reference CRUD + 解析、Notebook CRUD、Note Block CRUD
Phase 3（前端工作区）  →  03-notebook-frontend.md
  ↓                      左右双栏布局、Reference 切换、多 Notebook 编辑区、
                         选区浮动工具栏 + 拖拽、底部卡片校验抽屉
                                        ★ Milestone A：可用的工作区
Phase 4（手动出卡）  →  04-manual-card-creation.md
  ↓                      通用卡片编辑弹窗、POST /api/cards/manual
                                        ★ Milestone B：最短闭环跑通
Phase 5（AI 辅助出卡）  →  05-ai-card-generation.md
  ↓                      选区 AI 出题、Q↔A 补全、文案润色
                                        ★ Milestone C：AI 增强体验
Phase 6（复习来源回溯）  →  06-review-context-traceability.md
                         上下文面板、跳转定位到 Reference/Notebook
                                        ★ Milestone D：完整回溯闭环
```

**依赖说明**：

- Phase 2 → Phase 1：所有 API 需要新表和新字段已存在。
- Phase 3 → Phase 2：前端调用 Reference API 和 Notes API。
- Phase 4 → Phase 3：选区出卡需要选区浮动工具栏和 Notebook 已存在。
- Phase 5 → Phase 4：AI 出卡复用 Phase 4 的通用卡片编辑弹窗与数据管线。
- Phase 6 → Phase 4/5：来源回溯需要前序阶段已正确写入 `source_*` / `generation_mode` 字段。

### 3. 里程碑与发布节奏

- **Milestone A（Phase 1–3 完成）**：
  工作区可用：用户可创建工作区、导入多份 Reference（各自独立解析）、创建多本 Notebook、边读边记、从原文选区/拖拽发送到笔记。可独立发布，收集双栏布局与选区交互体验反馈。

- **Milestone B（Phase 4 完成）**：
  最短闭环跑通：读 → 记 → 手动出卡 → 复习。建议在此节点做端到端测试。

- **Milestone C（Phase 5 完成）**：
  AI 增强体验上线：选区 AI 出题、Q↔A 补全、文案润色。

- **Milestone D（Phase 6 完成）**：
  完整闭环闭合：复习时可查看来源、跳回 Reference/Notebook。全部新功能就绪。

### 4. 工作量预估

- Phase 1（数据地基）：约 0.5–1 天（含迁移脚本）
- Phase 2（后端 API）：约 1.5–2 天（Reference 解析重构 + Notes CRUD）
- Phase 3（前端工作区）：约 3–4 天（双栏布局 + 选区交互 + 拖拽 + 底部抽屉）
- Phase 4（手动出卡）：约 2 天
- Phase 5（AI 辅助出卡）：约 2–3 天
- Phase 6（复习来源回溯）：约 1–2 天
- **合计：约 10–14 天**

### 5. 分支命名建议

- Phase 1–3：`feat/workspace-reference-notebook`
- Phase 4：`feat/manual-selection-cards`
- Phase 5：`feat/ai-card-generation`
- Phase 6：`feat/review-context-traceability`

### 6. 现有代码资产复用总表

**基础设施层（全局可用，无需修改）**：

- 鉴权体系：`AuthContext` + `requireAuth` 中间件 + `authedFetch` 封装
- LLM 服务：`deepseekChat`（`services/llm.ts`）
- ORM 与数据库连接：`@workspace/db` 的 `pool` / `db` / schema 导出
- 路由挂载机制：`routes/index.ts` 的 `router.use` 模式
- SQL 脚本管理：`lib/db/sql/` 下的增量脚本约定
- React Query 数据管理：`@tanstack/react-query`
- 统一请求封装：`authedFetch`

**UI 组件库（50+ 组件，按需引用）**：

- 布局类：`resizable.tsx`、`scroll-area.tsx`、`tabs.tsx`、`sheet.tsx`、`collapsible.tsx`
- 输入类：`textarea.tsx`、`input.tsx`、`select.tsx`、`switch.tsx`、`checkbox.tsx`
- 反馈类：`dialog.tsx`、`alert-dialog.tsx`、`popover.tsx`、`dropdown-menu.tsx`、`toast.tsx`
- 展示类：`card.tsx`、`badge.tsx`、`skeleton.tsx`、`spinner.tsx`、`progress.tsx`、`empty.tsx`
- 交互类：`button.tsx`、`tooltip.tsx`、`context-menu.tsx`

**业务逻辑层（部分复用，需适配）**：

- 解析流程：`physicalChunk` + `buildSections` + keyword extraction → 提取为 `referenceParser.ts`
- 候选卡片流水线：`card_candidates → validate → flashcards` 全套流程不变
- 卡片组管理：`useListDecks` / `useCreateDeck` 等 hooks
- SM-2 复习与统计链路：完全不受影响

**需要适配的模块**：

- `routes/documents.ts`：关键词查询 JOIN 路径需从 `sections.document_id` 改为 `sections.reference_id → references.document_id`
- `material-detail.tsx`：整体布局重构
- `dashboard.tsx`：列表展示适配工作区概念

### 7. 版本控制与发布建议

- 每个 Phase：独立功能分支 + 对应 PR，PR 描述中引用对应编号文档。
- 对重要的 Schema 变更在 `docs/database-tech-doc.md` 中同步补充。
- 若需做较大重构：先在本文件中新增章节描述目标与影响范围，再基于计划实现。
