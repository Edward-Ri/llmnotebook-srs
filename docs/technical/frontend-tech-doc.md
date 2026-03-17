## 前端技术文档（artifacts/srs-app）

### 1. 概览

- 包名：`@workspace/srs-app`
- 技术栈：
  - React
  - TypeScript
  - `wouter`
  - `@tanstack/react-query`
  - Tailwind CSS
  - Radix UI
- 当前定位：
  - 已完成 Phase 3 的最小可用工作区前端
  - `materials/:id` 已改造成 `Reference + Notebook + 候选卡片校验抽屉` 的双栏工作区

### 2. 当前已注册路由

- `/`
- `/dashboard`
- `/materials/new`
- `/materials/:id`
- `/review`
- `/decks/:id`
- `/analytics`
- `/login`
- `/register`

未挂载页面：

- `src/pages/analyze.tsx`
- `src/pages/validate.tsx`

### 3. 当前前端能力

#### 3.1 工作区创建

- `material-new.tsx`
- 通过 `POST /api/documents` 创建工作区
- 创建完成后立即写入 React Query 缓存，再跳转到 `/materials/:id`
- 已修复“刚创建就进入详情页时误报找不到工作区”的问题

#### 3.2 阅读材料详情页

- `material-detail.tsx`
- 当前页面已改为 Phase 3 工作区：
  - 左栏：Reference 列表、导入弹窗、原文 blocks、outline、关键词选择
  - 右栏：Notebook 列表、Note Block 编辑区
  - 底部：候选卡片校验 `Sheet`
- 已接入接口：
  - `GET /api/documents/:documentId/references`
  - `POST /api/documents/:documentId/references`
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
  - `PUT /api/documents/:documentId/keywords`
  - `POST /api/cards/generate`

#### 3.3 候选卡片校验

- `document-card-validation.tsx`
- 通过底部抽屉在工作区页内完成：
  - `GET /api/cards/pending`
  - `PUT /api/cards/validate/batch`
  - `PATCH /api/cards/batch-assign-deck`

#### 3.4 Notebook 编辑能力

- 已支持：
  - 新建 Notebook
  - 重命名 Notebook
  - 删除 Notebook
  - 新建 text / heading 笔记块
  - 编辑、删除、上移、下移笔记块
  - `quote` 块来源回跳到左侧原文

#### 3.5 原文到笔记的发送方式

- 已支持三种方式：
  - 点击段落右侧“📋 送到笔记”
  - 将整段原文拖拽到右侧 Notebook
  - 在单段落内选区后，通过浮动工具栏发送到 Notebook
- 选区发送当前会写入：
  - `sourceReferenceId`
  - `sourceTextBlockId`
  - `selectionOffset`
  - `selectionLength`

#### 3.6 总览、复习与分析

- `dashboard.tsx`
- `review.tsx`
- `deck-detail.tsx`
- `analytics.tsx`

### 4. 认证与请求封装

- `AuthContext.tsx`
  - Cookie 会话优先
  - `401` 时回退到 `POST /api/auth/guest`
- `authed-fetch.ts`
  - 自动附加 `Authorization: Bearer`
  - 自动附加 `x-tz-offset-minutes`
  - 默认 `credentials: "include"`
- `api-client-react/customFetch`
  - 已补 `credentials: "include"`
  - 避免 generated hooks 与手写 `authedFetch` 的身份不一致

### 5. 当前前后端差异

后端已完成 Phase 1 / Phase 2，前端已完成 Phase 3 的最小接入。当前主要差异：

- 已完成：
  - Reference 切换器
  - 多 Notebook 面板
  - Reference 原文独立展示
  - Note Block 编辑与排序
  - 整段拖拽到 Notebook
  - 单段落选区浮动工具栏
- 尚未完成：
  - 跨段落选区
  - 从笔记直接出卡
  - 精确插入位置拖放
  - 更完整的移动端交互优化

### 6. 当前状态判断

可以认为前端当前已经进入 Phase 3，但仍是“最小可用版本”，不是最终交互形态。

因此本文件的结论是：

- 当前 `materials/:id` 已经代表后端的真实主流程
- 后续应围绕 Phase 4 / Phase 5 的“手动出卡 / AI 出卡”继续演进
- 不应再回到 `documents/analyze` 的旧单页解析流

### 7. 本地开发

- 前端目录：`artifacts/srs-app`
- 本地启动：

```bash
pnpm dev
```

- 默认代理：
  - `/api -> http://localhost:4000`

### 8. 当前注意点

- 若数据库未执行 Phase 1 SQL，工作区页常见现象包括：
  - 新建 Notebook 失败
  - 导入 Reference 失败
- 当前 Notebook 创建、Reference 导入、拖拽、选区发送都依赖：
  - `references`
  - `note_pages`
  - `note_blocks`
  - `text_blocks.reference_id`
  - `sections.reference_id`
