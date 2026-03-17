## Phase 6：复习来源回溯

> 对应开发流程 Phase 6（Milestone D）。本文件描述如何在复习阶段展示卡片的来源上下文（原文/笔记/Reference），以及从卡片反向跳转到对应的工作区。来源字段的数据结构参见 `01-data-foundation.md`。

---

### 1. 设计目标

- 在复习界面中提供「查看来源」能力：
  - 快速浏览与该卡相关的笔记要点与原文片段。
  - 必要时跳转回工作区详情页，定位到对应的 Reference 段落或 Notebook 块。
- 保持卡片正面/背面展示区域的纯净：来源信息只在用户主动点击时展开，不干扰记忆检验。

### 2. 不同来源组合的处理

- **仅原文来源**：
  - `source_reference_id` 非空，`source_text_block_id` 非空，`source_note_block_id` 为空。
  - 典型对应：关键词驱动生成、仅原文选区生成的卡片。

- **仅笔记来源**：
  - `source_note_block_id` 非空，`source_text_block_id` 可空。
  - 典型对应：从 Notebook 纯文本笔记块生成的卡片。

- **原文 + 笔记混合来源**：
  - `source_reference_id` 和 `source_note_block_id` 均非空。
  - 典型对应：引用型笔记块出卡，同时保留了原文来源信息。

- **无来源信息（旧数据或特殊情况）**：
  - 来源字段均为空。
  - UI 中隐藏「查看来源」按钮，或展示「此卡片无来源记录」提示。

### 3. 复习界面中的上下文展示

#### 3.1 基本体验

- 在 `/review` 页中，每张卡片增加一个「查看来源」按钮或图标。
- 点击后打开右侧/底部的上下文面板，展示：
  - 若存在 `source_note_block_id`：展示对应 `note_block.content`，标注「来自 Notebook」。
  - 若存在 `source_text_block_id`：展示对应 `text_blocks.content`，标注 Reference 标题与章节。
  - 若记录了 `selection_offset/length`：在原文片段中高亮选中部分。
  - 若存在 `source_reference_id`：显示 Reference 标题。

#### 3.2 UI 建议

- 上下文面板可以分区展示：
  - **笔记** 区域：展示来源笔记块。
  - **原文** 区域：展示来源原文段落。
  - **Reference 信息**：显示来源 Reference 标题。
- 可使用 `sheet.tsx`（侧栏面板）或 `collapsible.tsx`（折叠区域）实现。

### 4. 从卡片跳转回工作区

#### 4.1 行为设计

- 在上下文面板中为每个来源区域提供「跳转」入口：
  - 「在 Notebook 中查看」：跳转至 `materials/:documentId` 并激活对应 Notebook，滚动定位到对应 `note_block`。
  - 「在 Reference 中查看」：跳转到 `materials/:documentId`，左栏切换到对应 Reference，滚动定位到对应 `text_block`。若有选区信息，在该段落中高亮对应选区。

#### 4.2 技术要点

- 需要在前端为 `text_blocks` 与 `note_blocks` 渲染元素打上可定位的 DOM id：
  - `id="text-block-${textBlockId}"`
  - `id="note-block-${noteBlockId}"`
- 路由跳转时附带 URL query：
  - `/materials/:documentId?focusNoteBlock=:noteBlockId&notebook=:notebookId`
  - `/materials/:documentId?focusTextBlock=:textBlockId&reference=:referenceId`
- 页面加载后根据参数：
  - 自动切换到对应 Reference 或 Notebook。
  - 执行 `scrollIntoView` 定位到目标块。

### 5. API 支持

#### 5.1 方案 A（推荐）：后端聚合接口

- **Endpoint**：`GET /api/cards/:cardId/context`
- **响应**：

```ts
type CardContext = {
  document?: {
    id: string;
    title: string;
  };
  reference?: {
    id: string;
    title: string;
  };
  noteBlock?: {
    id: string;
    content: string;
    notebookId: string;
    notebookTitle: string;
  };
  textBlock?: {
    id: string;
    content: string;
    selectionOffset?: number;
    selectionLength?: number;
  };
};
```

前端通过该接口一次性获取上下文，不必多次请求。

#### 5.2 方案 B：前端自行组合

在现有卡片详情 API 中直接返回 `source_*` 字段，由前端根据 ID 调用 Notes/Reference/Document API 获取内容。

### 6. 兼容旧数据与迁移策略

- **旧卡片缺少来源字段**：Phase 1 中新增字段设为可空/有默认值，旧数据自动兼容。
- **是否需要数据迁移**：通常不强制。可以针对近期数据考虑离线脚本补充 `source_reference_id` 等字段，但非必需。

### 7. 可选扩展字段

以下字段已在 `01-data-foundation.md` 的 note_blocks 表中定义：

```text
- selection_offset   int   NULL   -- 选区在 text_block 中的起始偏移
- selection_length   int   NULL   -- 选区长度
```

用于在阅读详情页中精确高亮卡片来源选区。

### 8. 实现清单

1. 后端新增 `GET /api/cards/:cardId/context`（约 40–60 行）
2. 前端 `review.tsx` 增加「查看来源」按钮与上下文面板（约 100–150 行）
3. 前端 `material-detail.tsx` 增加 URL 定位参数处理（Reference/Notebook 切换 + scrollIntoView）
4. 在 `text_blocks` 与 `note_blocks` 渲染元素上添加 DOM id 属性
