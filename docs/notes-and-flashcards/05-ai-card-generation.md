## Phase 5：AI 辅助出卡与文案优化

> 对应开发流程 Phase 5（Milestone C）。本文件描述基于自由选区与 Notebook 内容的 AI 出题、Q/A 补全以及卡片文案优化能力，包括前端交互与后端 LLM 接口设计。

---

### 1. 概述

Phase 5 在 Phase 4 的通用卡片编辑弹窗基础上，增加以下 AI 辅助能力：

- **模式 A 增强**：关键词驱动生成增加可选参数（题型/文风/数量）。
- **模式 C**：自由选区 → AI 自动生成 Q/A。
- **模式 D**：用户写 Q（或 A）→ AI 补全另一侧。
- **通用文案优化**：对任何卡片内容执行简化/重写/翻译等操作。

所有模式最终通过 `POST /api/cards/manual` 或现有候选卡片接口写入统一流水线。

### 2. 模式 A 增强：关键词驱动（可选参数）

在现有 `POST /api/cards/generate` 接口基础上增加可选参数：

```ts
type GenerateCardsFromKeywordsRequest = {
  documentId: string;
  keywordIds: string[];
  maxCardsPerKeyword?: number;  // 默认 2
  style?: "concept" | "formula" | "application";
  tone?: "plain" | "academic" | "casual";
};
```

前端在左栏关键词选择完成后、调用接口之前，增加一个轻量配置面板：每个关键词最大卡片数、题型偏好、语言/文风偏好。

### 3. 模式 C：自由选区 → AI 自动生成 Q/A

#### 3.1 交互流程

1. 选中一段原文/笔记文本（左栏或右栏）。
2. 通过选区浮动工具栏选择「让 AI 帮我出题」。
3. 弹出对话框，用户可设置：
   - 难度：基础 / 进阶 / 挑战。
   - 题型：问答 / 填空 / 判断 / 应用题（初期可只支持问答）。
4. 提交后调用后端 LLM 出题接口，返回若干候选 Q/A。
5. 对话框中列表展示这些候选卡片，用户可逐个编辑与勾选，最后统一保存。

#### 3.2 后端接口

- **Endpoint**：`POST /api/cards/generate-from-selection`
- **请求体**：

```ts
type GenerateCardsFromSelectionRequest = {
  documentId?: string;
  referenceId?: string;
  sourceTextBlockId?: string | null;
  sourceNoteBlockId?: string | null;
  selectionText: string;
  difficulty?: "basic" | "intermediate" | "advanced";
  questionType?: "qa" | "cloze" | "true_false" | "application";
  maxCards?: number; // 默认 3
};
```

- **响应**：

```ts
type GenerateCardsFromSelectionResponse = {
  drafts: { front: string; back: string }[];
};
```

- 前端拿到 `drafts` 后在弹窗中展示，用户勾选并编辑后通过 `POST /api/cards/manual` 写入 `card_candidates`。
- `generation_mode = "selection_ai"`。

### 4. 模式 D：用户写 Q（或 A）→ AI 补全另一侧

#### 4.1 Q→A 模式

用户选中 Notebook 中的一段文字作为问题（front），选择「生成答案并出卡」。系统调用后端接口生成一个或多个答案候选（back），用户选择/修改后保存。

#### 4.2 A→Q 模式

用户已有一段解释（背面），希望 AI 反向生成一个更好的问题（正面）。交互类似，调用的接口为同一套。

#### 4.3 后端接口

- **Endpoint**：`POST /api/cards/complete-side`
- **请求体**：

```ts
type CompleteCardSideRequest = {
  mode: "q_to_a" | "a_to_q";
  documentId?: string;
  referenceId?: string;
  sourceTextBlockId?: string | null;
  sourceNoteBlockId?: string | null;
  knownText: string;
  style?: "plain" | "academic" | "concise";
};
```

- **响应**：

```ts
type CompleteCardSideResponse = {
  suggestions: string[];
};
```

- 前端在通用卡片编辑弹窗中使用该接口快速生成另一侧内容，允许用户选择/合并/编辑。
- `generation_mode` 对应 `"q_to_a"` 或 `"a_to_q"`。

### 5. 通用 AI 文案优化工具

无论卡片来自何种生成模式，都可以在卡片编辑阶段使用 AI 对 Q/A 文本做微调。

#### 5.1 能力列表

- **简化**：将长段落压缩成适合记忆的精炼描述或要点列表。
- **重写**：保持含义不变，优化表达方式（更清晰/更自然）。
- **翻译/双语**：在中英之间翻译，或生成双语版本。
- **调整难度**：将表述调整为更基础/更进阶。

#### 5.2 后端接口

- **Endpoint**：`POST /api/cards/refine-text`
- **请求体**：

```ts
type RefineTextRequest = {
  text: string;
  operation: "simplify" | "rewrite" | "translate_to_en" | "translate_to_zh" | "make_harder" | "make_easier";
};
```

- **响应**：

```ts
type RefineTextResponse = {
  refined: string;
};
```

#### 5.3 前端集成

在卡片编辑弹窗中为 front/back 输入框各提供一个「AI」图标按钮（使用 `dropdown-menu.tsx`），点击后弹出操作列表：简化 / 重写 / 翻译 / 调整难度 / 补全另一侧。

### 6. 生成模式标记

本阶段涉及的 `generation_mode` 取值：

- `"keyword"`：关键词驱动（增强版）。
- `"selection_ai"`：选区 AI 出题。
- `"q_to_a"`：用户写问题，AI 生成答案。
- `"a_to_q"`：用户写答案，AI 生成问题。

`generation_mode` 由前端在最终调用写入接口时显式传入。

### 7. 实现清单

1. 后端 `routes/cards.ts` 新增 `POST /api/cards/generate-from-selection`（约 40 行 + prompt 模板）
2. 后端 `routes/cards.ts` 新增 `POST /api/cards/complete-side`（约 40 行 + prompt 模板）
3. 后端 `routes/cards.ts` 新增 `POST /api/cards/refine-text`（约 30 行 + prompt 模板）
4. 前端 `card-editor-dialog.tsx` 扩展 AI 交互（约增加 100–150 行）
5. 设计 3 套 Prompt 模板（参照现有关键词出卡的约束风格）
