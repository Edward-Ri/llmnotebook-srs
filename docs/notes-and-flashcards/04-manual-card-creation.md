## Phase 4：手动选区出卡

> 对应开发流程 Phase 4（Milestone B）。本文件描述用户从原文或笔记中自由选择内容、手动创建闪卡的交互设计与后端接口，完成后「阅读 → 笔记 → 出卡 → 复习」最短闭环跑通。

---

### 1. 模式定位

本阶段实现**模式 B：自由选区 → 选区作为背面内容，用户自拟正面**。

这是在现有关键词驱动生成之外，增加的第一种用户可控出卡方式。其特点是：

- 用户完全掌控卡片内容，不依赖 LLM。
- 选区来源可以是阅读材料原文（左栏 Reference 段落），也可以是 Notebook 笔记块（右栏）。
- 所有卡片最终汇入现有「候选卡片 → 校验 → 入组」统一流水线。

### 2. 来源与入口

- **来源**：
  - 阅读材料原文（左栏当前 Reference 的 text_blocks）。
  - Notebook 笔记块内容（右栏当前 Notebook）。

- **入口交互**（三种，递进实现）：
  - **段落/块级**（最小实现）：在每个原文段落和笔记块旁增加「从此内容生成卡片」按钮。
  - **选区浮动工具栏**（Phase 3 已实现）：用户选中文字后弹出的 Popover 中增加「从此出卡」按钮。
  - **拖拽到底部抽屉**（增强，可选）：将选区拖拽到底部抽屉的「新卡片」区域。

### 3. 通用卡片编辑弹窗

新建组件 `card-editor-dialog.tsx`，基于现有 `dialog.tsx` + `textarea.tsx` + `select.tsx` 组装。

- **弹窗字段**：
  - 输入框：**正面内容（front）** —— 初始为空，由用户填写问题/提示。
  - 输入框：**背面内容（back）** —— 默认填入选中的文本内容，用户可编辑。
  - 下拉：选择目标 Deck（复用 `useListDecks`，可预选为与当前工作区相关的 Deck）。
  - 开关：是否直接入组，或先作为候选卡片。

- **预留 AI 扩展位**：
  - Props 接口需为 Phase 5 的 AI 按钮预留位置（如 `onAiGenerate?`、`onAiRefine?` 等回调）。

- **用户操作流程**：
  1. 选中内容 → 打开弹窗。
  2. 填写/编辑正面与背面。
  3. 点击「保存为候选卡片」或「直接加入卡组」。

### 4. 后端接口：手动创建卡片

在现有 `routes/cards.ts` 中新增：

- **Endpoint**：`POST /api/cards/manual`
- **请求体**：

```ts
type CreateManualCardRequest = {
  documentId?: string;
  referenceId?: string;
  sourceTextBlockId?: string;
  sourceNoteBlockId?: string;
  front: string;
  back: string;
  deckId?: string;
  asCandidate?: boolean;
};
```

- **行为**：
  - 若 `asCandidate === true`（默认）：
    - 写入 `card_candidates`，附带 `generation_mode = "selection_manual_front"`。
    - 同时写入 `source_reference_id`、`source_note_block_id`（若有）。
  - 若 `asCandidate === false` 且提供了 `deckId`：
    - 直接写入 `flashcards`，SM-2 字段以默认值初始化。
  - 始终记录 `source_document_id` / `source_reference_id` / `source_text_block_id` / `source_note_block_id`（可空）。

### 5. 现有关键词模式回顾

现有关键词驱动生成模式保持不变：

- 入口：左栏 TOC 区的关键词选择流程。
- 接口：`POST /api/cards/generate`。
- 行为：输入 `{ documentId, keywordIds[] }`，后端基于关键词邻近上下文调用 LLM 生成候选 Q/A 卡片，写入 `card_candidates`。

> 该模式将在 Phase 5 中做轻量增强（控制每个关键词生成数量、题型偏好等）。

### 6. 生成模式标记

写入卡片时需设置统一的 `generation_mode` 字段，由前端在调用 `POST /api/cards/manual` 时显式传入：

- `"selection_manual_front"`：本阶段的手动出卡模式。
- `"keyword"`：现有关键词模式（默认值）。

### 7. 实现清单

1. 新建 `artifacts/srs-app/src/components/card-editor-dialog.tsx`（约 150–200 行）
2. 后端 `artifacts/api-server/src/routes/cards.ts` 新增 `POST /api/cards/manual` 路由（约 40–60 行）
3. 在选区浮动工具栏（`selection-toolbar.tsx`）中增加「从此出卡」按钮
4. 在 `notebook-panel.tsx` 笔记块旁增加「从此内容生成卡片」按钮
5. （可选）实现选区级浮层交互（`mouseup` + `getSelection` + Popover）
