## Phase 3：工作区前端交互

> 对应开发流程 Phase 3（Milestone A）。本文件描述工作区详情页的整体布局改造，包含 Reference 管理（左栏）、多 Notebook 编辑区（右栏）、选区到笔记的交互设计以及候选卡片校验的底部抽屉。后端 API 参见 `02-notes-backend-api.md`，数据结构参见 `01-data-foundation.md`。

---

### 1. 目标与定位

- **核心目标**：
  - 将 `materials/:id` 页面改造为「工作区」视图，支持多份 Reference + 多本 Notebook 的双栏布局。
  - 用户可在左栏阅读原文、选择关键词、生成卡片；在右栏管理多本 Notebook、整理笔记。
  - 提供优雅的选区到笔记交互（浮动工具栏 + 拖拽）。
- **协调原则**：
  - 关键词选择和卡片生成是 per-reference 的工作流，留在左栏完成。
  - Notebook 是持续性的笔记工作区，独占右栏。
  - 候选卡片校验统一在底部抽屉（Sheet）中完成。

### 2. 核心使用场景

- **场景 A：导入并阅读 Reference**
  用户在工作区中导入一份或多份学习材料，每份独立解析，左栏可切换查看。

- **场景 B：边读边记**
  用户在左栏阅读原文，选中关键段落或片段，通过浮动工具栏或拖拽发送到右栏 Notebook。

- **场景 C：关键词驱动出卡**
  用户在左栏 TOC 区选择关键词，点击「生成候选卡片」，在底部抽屉中校验。

- **场景 D：从笔记出卡**
  用户在右栏 Notebook 中整理好笔记后，点击笔记块旁的「出卡」按钮生成卡片。

### 3. 页面布局

改造 `artifacts/srs-app/src/pages/material-detail.tsx`，桌面端采用左右双栏 + 底部抽屉：

```
┌─────────────────────────────────────────────────────────────┐
│  工作区标题 · 返回按钮 · 「导入新 Reference」按钮            │
├──────────────────────────────┬──────────────────────────────┤
│  左栏（~60%）                │  右栏（~40%）                │
│                              │                              │
│  ┌─ Reference 切换器 ──────┐│  ┌─ Notebook 选择器 ────────┐│
│  │ [Ref A] [Ref B] [+ 导入]││  │ [笔记1] [笔记2] [+ 新建] ││
│  └──────────────────────────┘│  └──────────────────────────┘│
│                              │                              │
│  ┌─ 原文段落 ──────────────┐│  ┌─ 笔记块列表 ────────────┐│
│  │ 段落 1          [📋]    ││  │ ▎ 引用块 (quote)         ││
│  │ 段落 2          [📋]    ││  │   📎 引自 Ref A · 第3段   ││
│  │ 段落 3          [📋]    ││  │                            ││
│  │ ...                      ││  │ 文本块 (text)             ││
│  └──────────────────────────┘│  │ 标题块 (heading)          ││
│                              │  │ ...                        ││
│  ┌─ TOC + 关键词 ──────────┐│  │                            ││
│  │ 第一章                   ││  │ [+ 新建笔记块]             ││
│  │   [关键词A] [关键词B]    ││  └──────────────────────────┘│
│  │ 第二章                   ││                              │
│  │   [关键词C] [关键词D]    ││                              │
│  └──────────────────────────┘│                              │
│                              │                              │
│  已选 3 个关键词             │                              │
│  [生成候选卡片] [校验卡片]   │                              │
├──────────────────────────────┴──────────────────────────────┤
│  底部抽屉（Sheet，点击「校验卡片」后滑出）                    │
│  ┌──────────────────────────────────────────────────────────┐│
│  │  候选卡片列表 · 通过/编辑/删除                             ││
│  └──────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

- 使用现有 `resizable.tsx` 实现左右两栏宽度可拖拽调节。
- 底部抽屉使用现有 `sheet.tsx` 组件，方向设为 bottom。

### 4. 左栏：Reference 管理与原文展示

#### 4.1 Reference 切换器

- 工作区顶部显示已导入的 Reference 列表，以 Tab 或横向滚动按钮呈现。
- 末尾提供「+ 导入新 Reference」按钮，点击弹出导入 Dialog。
- 切换 Reference 时，下方原文段落和 TOC/关键词同步更新。

#### 4.2 导入 Reference Dialog

- 基于现有 `dialog.tsx` 组件。
- 表单字段：标题（输入框）+ 文本内容（textarea，支持粘贴和拖拽 .txt/.md 文件）。
- 提交后调用 `POST /api/documents/:documentId/references`，解析完成后 Dialog 关闭，左栏自动切换到新 Reference。

#### 4.3 原文段落展示

- 按 `position_index` 升序渲染当前 Reference 的 text_blocks。
- 每个段落元素设置 `id="text-block-${textBlockId}"`，便于后续定位跳转。
- 每段右侧显示轻量「📋」图标按钮，点击后将整段发送到当前 Notebook 末尾。
- 支持文本选区交互（详见第 6 节）。

#### 4.4 TOC + 关键词区

- 展示当前 Reference 的 sections 层级结构（复用现有 outline 渲染逻辑）。
- 每个 section 内嵌关键词 Badge（可点选切换选中状态）。
- 点击 section 标题滚动到对应原文段落。

#### 4.5 底部工具条

- 显示已选关键词数量。
- 「生成候选卡片」按钮：选中关键词后可用，调用现有卡片生成接口。
- 「校验候选卡片」按钮：打开底部抽屉。

### 5. 右栏：多 Notebook 编辑区

#### 5.1 Notebook 选择器

- 顶部显示当前工作区下所有 Notebook，以下拉菜单或 Tab 呈现。
- 末尾提供「+ 新建 Notebook」按钮，点击弹出简单输入框（输入标题后创建）。
- 切换 Notebook 时，下方笔记块列表同步更新。
- Notebook 标题可直接点击编辑（inline edit）。

#### 5.2 笔记块列表

- 按 `position_index` 升序渲染当前 Notebook 的 note_blocks。
- 每个块根据 `block_type` 渲染不同样式。

#### 5.3 笔记块类型

- **文本块（text）**：用于自由书写。点击进入编辑模式（textarea），`Ctrl/Cmd+Enter` 保存，`Esc` 取消。
- **引用块（quote）**：从原文发送过来的内容。UI 样式：
  - 左侧带主题色竖线（`border-l-2 border-primary`）。
  - 内容为引用的原文文本，斜体/灰底区分。
  - 底部显示来源标签：「📎 引自 [Reference 标题] · 第 N 段」，可点击跳转回左栏对应段落。
- **标题块（heading）**：用于构建 Notebook 内部层次结构。

#### 5.4 块的增删与排序

- **新增**：底部「+ 新建笔记块」按钮，默认创建 text 类型空块。
- **删除**：每个块右上角提供删除图标，弹出轻量确认对话框（`alert-dialog.tsx`）。
- **排序**：通过「上移/下移」按钮调整 `position_index`。拖拽排序可作为后续优化。

#### 5.5 空状态

当 Notebook 中没有块时，显示文案「还没有笔记，试试从左侧选一段内容拖放到这里」，同时整个区域作为 drop zone 高亮。

### 6. 选区到笔记：浮动工具栏 + 拖拽

用户在左栏原文中选中文字后，有两条路径将内容发送到右栏 Notebook，互为补充。

#### 6.1 路径 A：选区浮动工具栏（主要方式，触屏/桌面通用）

- **触发**：用户在左栏原文段落中选中文字，`mouseup` 后检测 `getSelection()` 非空。
- **展示**：在选区上方弹出 Popover 浮动工具栏，按钮包括：
  - 「发送到笔记」—— 将选中文本作为 quote 块追加到当前 Notebook 末尾。
  - 「从此出卡」—— 预留 Phase 4/5 的手动/AI 出卡入口。
- **关闭**：点击外部、选区消失、或鼠标移开时自动关闭。
- **实现要点**：
  - 监听左栏原文容器的 `mouseup` 事件。
  - 通过 `window.getSelection()` 获取选中文本和 Range 对象。
  - 计算 Range 的 `getBoundingClientRect()` 定位 Popover。
  - 复用现有 `popover.tsx` 组件。
  - 记录来源元数据：`referenceId`、`textBlockId`（根据选区所在段落的 DOM id 解析）、`selectionOffset`、`selectionLength`。

#### 6.2 路径 B：拖拽到笔记区（Power User 快捷方式，仅桌面端）

- **触发**：用户选中文字后按住拖拽。
- **拖拽预览**：使用 `dataTransfer.setDragImage()` 生成带引号样式的紧凑卡片预览。
- **拖拽数据**：通过 `dataTransfer.setData()` 携带 JSON 元数据：

```ts
type DragPayload = {
  type: "reference-selection";
  text: string;
  referenceId: string;
  textBlockId: string;
  selectionOffset: number;
  selectionLength: number;
};
```

- **Drop Zone**（右栏 Notebook 编辑区）：
  - `onDragEnter` / `onDragOver`：计算鼠标 Y 坐标与现有 note_blocks 的位置关系，在最近的两个块之间显示蓝色插入线（`h-0.5 bg-primary rounded-full`，带动画）。
  - `onDragLeave`：隐藏插入线。
  - `onDrop`：在插入线位置创建新的 quote note_block，调整后续块的 `positionIndex`。
- **空 Notebook**：整个编辑区高亮为 drop zone，显示「拖放到此处创建笔记」。

#### 6.3 降级策略

- **移动端/触屏**：拖拽不可用，纯依赖选区浮动工具栏。
- **无选区时**：每个段落右侧保留轻量「📋」图标按钮，点击后将整段发送到 Notebook 末尾。

### 7. 底部抽屉：候选卡片校验

- 基于现有 `sheet.tsx` 组件，方向设为 `bottom`，高度约占视口 60%。
- 点击左栏「校验候选卡片」按钮后滑出。
- 内容复用现有 `DocumentCardValidation` 组件逻辑，调整查询为工作区级别（可按 Reference 筛选）。
- 校验完毕后可手动收起（点击遮罩或关闭按钮）。

### 8. 权限与数据隔离

- Reference 与 Notebook 必须与当前登录用户强绑定。
- 所有接口通过 `requireAuth` 获取 `user.id`，查询与写入时均校验 `user_id`。
- 对访客用户：行为与正式用户一致，遵循现有访客过期策略。

### 9. 非目标（本阶段不做）

- 不提供 Notion 级别的块系统（数据库视图、复杂嵌套块、多列布局等）。
- 不在本阶段支持跨工作区的全局 Notebook 聚合视图。
- 不在本阶段实现拖拽排序 Notebook 内的块（使用上移/下移按钮代替）。
- 窄屏/移动端的 Tab 切换布局作为后续优化。

### 10. 实现清单

1. 改造 `artifacts/srs-app/src/pages/material-detail.tsx`（左右双栏布局 + 底部抽屉）
2. 新建 `artifacts/srs-app/src/components/reference-panel.tsx`（左栏：Reference 切换器 + 原文 + TOC）
3. 新建 `artifacts/srs-app/src/components/reference-import-dialog.tsx`（导入 Reference 弹窗）
4. 新建 `artifacts/srs-app/src/components/notebook-panel.tsx`（右栏：Notebook 选择器 + 笔记块编辑区）
5. 新建 `artifacts/srs-app/src/components/selection-toolbar.tsx`（选区浮动工具栏）
6. 新建 `artifacts/srs-app/src/components/note-block-item.tsx`（笔记块渲染组件，按类型区分样式）
7. 在原文段落渲染中增加拖拽支持（draggable + dragstart 数据封装）
8. 在 Notebook 编辑区增加 drop zone 逻辑（onDragOver 插入线 + onDrop 创建块）
