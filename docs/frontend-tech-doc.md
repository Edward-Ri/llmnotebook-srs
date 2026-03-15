## 前端技术文档（artifacts/srs-app）

### 1. 概览

- **名称**：`@workspace/srs-app`
- **职责**：提供 AI 记忆引擎 Web 前端，覆盖：
  - 阅读材料创建与解析
  - 关键词选择与候选卡片生成
  - 候选卡片校验并入组
  - 复习统计与可视化分析
  - 用户注册登录与访客会话

> 说明：后端已对齐 SQL-new + UUID 结构，`cards/reviews/analytics/decks/documents` 相关接口已可用。

### 2. 技术栈与依赖

- **语言**：TypeScript + JSX
- **框架**：React
- **路由**：`wouter`
- **数据层**：`@tanstack/react-query` + `@workspace/api-client-react`
- **样式与组件**：Tailwind CSS + Radix UI + 自定义 `src/components/ui/*`
- **动效/图表**：`framer-motion`、`recharts`、`canvas-confetti`

### 3. 路由与页面

#### 3.1 `App.tsx` 已注册路由

- `/`、`/dashboard`：总览面板（`dashboard.tsx`）
- `/materials/new`：新建阅读材料（`material-new.tsx`）
- `/materials/:id`：阅读材料详情（`material-detail.tsx`）
- `/review`：间隔复习（`review.tsx`）
- `/decks/:id`：卡片组详情（`deck-detail.tsx`）
- `/analytics`：学习分析（`analytics.tsx`）
- `/login`、`/register`：登录注册

#### 3.2 未挂载页面

- `src/pages/analyze.tsx` 仍在仓库中，但当前未在 `App.tsx` 注册路由。
- `src/pages/validate.tsx` 当前未在 `App.tsx` 注册路由（候选卡片校验能力已内嵌到阅读材料详情页）。

### 4. 核心页面流转

#### 4.1 新建阅读材料（Notebook）

- 文件：`src/pages/material-new.tsx`
- 流程：
  1. `POST /api/documents` 创建文档
  2. 成功后跳转 `/materials/:id`
- 说明：
  - 标题输入框默认留空，用户可自行输入标题
  - 若直接创建（未输入标题），前后端统一使用默认标题 `未命名阅读材料`
  - 未登录用户会先刷新鉴权状态并创建访客身份，随后允许创建阅读材料

#### 4.2 阅读材料详情

- 文件：`src/pages/material-detail.tsx`
- 能力：
  - 在页面内粘贴/上传文本并调用 `POST /api/documents/analyze` 完成解析
  - 调用 `GET /api/documents/:documentId/outline` 拉取目录树（含章节关键词）
  - 左侧按段落展示原文，右侧按目录章节展示关键词（不再平铺随机标签）
  - 点击目录节点可滚动定位到原文段落，点击关键词本地选择
  - 提交时先 `PUT /api/documents/:id/keywords`，再 `POST /api/cards/generate`
  - 生成成功后在当前页面内进入候选卡片校验区（不再跳转独立 `/validate` 路由）

#### 4.3 卡片校验页

- 主实现：`src/components/document-card-validation.tsx`（嵌入 `material-detail.tsx`）
- 数据来源：`GET /api/cards/pending?documentId=...`
- 提交流程：
  - `PUT /api/cards/validate/batch` 保存 keep/edit/discard
  - 对 keep/edit 的卡片统一执行 `PATCH /api/cards/batch-assign-deck` 分配到所选卡片组
- 当前行为：
  - 若没有待校验卡片，展示空状态并提示先生成候选卡片
  - 若有 keep/edit 但未选择卡片组，不允许提交

#### 4.4 总览页

- 文件：`src/pages/dashboard.tsx`
- 拉取 `GET /api/documents` 与 `GET /api/decks`
- 支持删除阅读材料与卡片组
- 卡片组卡片展示 `New / Due / 今日已背诵` 三类统计，并支持直接进入组内复习（`/review?deckId=...`）

### 5. 认证逻辑（AuthContext）

- 文件：`src/contexts/AuthContext.tsx`
- 优先通过 Cookie 会话访问 `/api/auth/me`
- `401` 时会自动尝试 `POST /api/auth/guest` 创建访客身份
- 访客 token 存在 `sessionStorage`，并通过 `Authorization: Bearer ...` 参与鉴权
- 不再在 `beforeunload` 自动登出，避免页面跳转导致会话被误清理

### 6. 统一请求约定（authedFetch）

- 文件：`src/lib/authed-fetch.ts`
- 对前端手写 `fetch` 统一封装：
  - 自动附加 `Authorization: Bearer <guest_token>`（访客模式）
  - 自动附加 `x-tz-offset-minutes`（本地时区偏移）
  - 默认 `credentials: "include"`
- 目前 `review/deck-detail/analytics/material-new/material-detail/dashboard` 相关手写请求已切换到该封装

### 7. 与后端交互约定

- 关键词、文档、卡片、卡片组 ID 全部为 **UUID 字符串**
- `keywordId` 可为 `null`
- 关键词对象可能包含 `sectionId`（用于目录分组渲染）
- 生成卡片入口为 `POST /api/cards/generate`（候选卡片）

### 8. 本地开发与代理

- `vite.config.ts` 默认把 `/api` 代理到 `http://localhost:4000`
- 常规本地启动可直接执行：

```bash
pnpm dev
```

- 若后端不在 4000，可覆盖：

```bash
API_TARGET=http://localhost:<port> pnpm dev
```

### 9. 近期更新（2026-03-15）

- 候选卡片校验能力从独立 `/validate` 页面收敛到 `material-detail` 页内闭环。
- 新建阅读材料支持访客态创建（未登录用户可直接体验，退出后由访客清理机制回收数据）。
- 新建页标题策略更新：用户可留空标题创建，默认名称统一为 `未命名阅读材料`。
- 新建阅读材料页标题栏改为极简输入样式，仅保留“输入阅读材料标题”入口。
- `/review` 路由已注册并接入真实复习流程。
- 复习页翻转交互修复：分离入场动画与 `rotateY` 翻面动画，避免“显示答案”无响应。
- 复习完成页改为 SPA 路由跳转，修复复习后会话被误清理导致的数据丢失感知问题。
- 分析页接入失败态展示，避免接口异常时误显示为“0 统计”。
- 阅读材料详情页恢复目录树交互：按章节展示关键词并支持目录到原文段落定位。
- 前端接入 `GET /api/documents/:documentId/outline`，替代单纯平铺关键词展示方式。
