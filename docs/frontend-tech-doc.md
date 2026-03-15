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
- `/validate`：候选卡片校验（`validate.tsx`）
- `/decks/:id`：卡片组详情（`deck-detail.tsx`）
- `/analytics`：学习分析（`analytics.tsx`）
- `/login`、`/register`：登录注册

#### 3.2 未挂载页面

- `src/pages/analyze.tsx` 仍在仓库中，但当前未在 `App.tsx` 注册路由。

### 4. 核心页面流转

#### 4.1 新建阅读材料（Notebook）

- 文件：`src/pages/material-new.tsx`
- 流程：
  1. `POST /api/documents` 创建文档
  2. `POST /api/documents/analyze`（请求体：`{ documentId, text }`）
  3. 成功后跳转 `/materials/:id`

#### 4.2 阅读材料详情

- 文件：`src/pages/material-detail.tsx`
- 能力：
  - 展示原文与关键词列表
  - 点击关键词本地选择
  - 提交时先 `PUT /api/documents/:id/keywords`，再 `POST /api/cards/generate`
  - 生成成功后跳转 `/validate?documentId=:id`

#### 4.3 卡片校验页

- 文件：`src/pages/validate.tsx`
- 数据来源：`GET /api/cards/pending?documentId=...`
- 提交流程：
  - `PUT /api/cards/validate/batch` 保存 keep/edit/discard
  - 若有卡片组分配：`PATCH /api/cards/batch-assign-deck`
- 当前行为：
  - 若没有待校验卡片，展示空状态并返回阅读材料
  - 若有 keep/edit 但未选择卡片组，不允许提交

#### 4.4 总览页

- 文件：`src/pages/dashboard.tsx`
- 拉取 `GET /api/documents` 与 `GET /api/decks`
- 支持删除阅读材料与卡片组
- 页面里保留了“开始今日复习”入口（`/review`），但该路由当前未注册，点击会进入 404（待清理）

### 5. 认证逻辑（AuthContext）

- 文件：`src/contexts/AuthContext.tsx`
- 优先通过 Cookie 会话访问 `/api/auth/me`
- `401` 时会自动尝试 `POST /api/auth/guest` 创建访客身份
- 访客 token 存在 `sessionStorage`，并通过 `Authorization: Bearer ...` 参与鉴权
- `beforeunload` 会触发 `/api/auth/logout`，访客账户会在后端清理

### 6. 与后端交互约定

- 关键词、文档、卡片、卡片组 ID 全部为 **UUID 字符串**
- `keywordId` 可为 `null`
- 生成卡片入口为 `POST /api/cards/generate`（候选卡片）

### 7. 本地开发与代理

- `vite.config.ts` 默认把 `/api` 代理到 `http://localhost:4000`
- 常规本地启动可直接执行：

```bash
pnpm dev
```

- 若后端不在 4000，可覆盖：

```bash
API_TARGET=http://localhost:<port> pnpm dev
```

### 8. 近期更新（2026-03-15）

- `material-detail` 增加“关键词选择 -> 生成候选卡片 -> 跳转校验页”闭环。
- `validate` 空数据场景改为明确空状态页，不再直接重定向。
- 文案更新为“批量生成并进入卡片校验”。
- 前端默认 API 代理从 `3000` 调整为 `4000`。
