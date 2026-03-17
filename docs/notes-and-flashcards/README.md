## 工作区 + Reference + 多 Notebook 闪卡闭环 — 技术文档索引

本目录包含「工作区容器 + 多 Reference 独立解析 + 多 Notebook 笔记 + 多模式闪卡生成 + 来源回溯」完整功能的技术设计文档，按开发顺序编号。

---

### 文档列表

| 编号 | 文件 | Phase | 内容概述 |
|------|------|-------|---------|
| 01 | `01-data-foundation.md` | Phase 1 | 新增 references 表；修改 text_blocks/sections 指向 reference；新增 note_pages（多 Notebook）/ note_blocks；扩展 flashcards/card_candidates 字段 |
| 02 | `02-notes-backend-api.md` | Phase 2 | Reference CRUD + 解析 API；Notebook CRUD；Note Block CRUD；现有接口适配 |
| 03 | `03-notebook-frontend.md` | Phase 3 | 工作区详情页左右双栏布局；Reference 切换 + 原文展示；多 Notebook 编辑区；选区浮动工具栏 + 拖拽到笔记；底部候选卡片校验抽屉 |
| 04 | `04-manual-card-creation.md` | Phase 4 | 手动选区出卡、通用卡片编辑弹窗与 POST /api/cards/manual 接口 |
| 05 | `05-ai-card-generation.md` | Phase 5 | AI 辅助出卡（选区出题、Q↔A 补全、文案优化）与 LLM 接口 |
| 06 | `06-review-context-traceability.md` | Phase 6 | 复习阶段来源回溯（Reference/Notebook）与跳转定位 |
| 07 | `07-development-roadmap.md` | 全局 | 开发路线图、依赖关系、里程碑、工作量与版本控制建议 |
| 08 | `08-implementation-log.md` | 全局 | 长期维护的实施日志：记录各 Phase 的实际落地、校验结果与遗留事项 |
| 03.1 | `03.1-notebook-editor-refactor.md` | Phase 3.1 | Notebook 富文本编辑器重构：Tiptap 选型、数据模型变更、Notion 风格交互、分阶段实施 |
| 03.2 | `03.2-reference-panel-redesign.md` | Phase 3.2 | Reference 面板布局重构：三区布局、可收缩来源侧边栏、全宽阅读区、内嵌关键词、浮动操作条、右侧校验面板 |

### 里程碑

- **Milestone A**（Phase 1–3）：可用的工作区——多 Reference 导入解析 + 多 Notebook 边读边记 + 选区/拖拽交互
- **Milestone A+**（Phase 3.1）：Notebook 体验升级——Notion 风格富文本块编辑器 + 右栏两级导航
- **Milestone A++**（Phase 3.2）：阅读体验优化——三区布局 + 可收缩侧边栏 + 全宽阅读区 + 右侧校验面板
- **Milestone B**（Phase 4）：最短闭环——读 → 记 → 手动出卡 → 复习
- **Milestone C**（Phase 5）：AI 增强体验
- **Milestone D**（Phase 6）：完整回溯闭环

### 当前阶段

Phase 1–3 已完成。当前应优先实施 **Phase 3.1（Notebook 编辑器重构）** 和 **Phase 3.2（Reference 面板布局重构）**，完成后进入 Phase 4。
