## 前端技术文档（artifacts/srs-app）

### 1. 概览

- **名称**：`@workspace/srs-app`
- **职责**：提供 AI 记忆引擎的 Web 前端界面，覆盖：
  - 文档解析与关键词筛选
  - AI 生成卡片的人机协同校验（部分旧流转）
  - 学习统计与可视化分析（旧流转）
  - 用户注册登录与会话管理展示

> 说明：后端已迁移到 SQL-new 结构，旧的 cards/reviews/analytics 接口暂时返回 501，前端对应页面处于“占位/待迁移”状态；`/decks` 与 `/documents` 已按新结构可用。

### 2. 技术栈与依赖

- **语言**：TypeScript + JSX
- **框架**：React
- **路由**：`wouter`
- **数据获取与缓存**：`@tanstack/react-query`
- **UI 与样式**：
  - Tailwind CSS
  - Radix UI 组件（Accordion、Dialog、Tooltip、Tabs 等）
  - 自定义 UI 组件封装在 `src/components/ui/*`
- **图表与动效**：
  - `framer-motion`
  - `recharts`
  - `canvas-confetti`
- **API 客户端**：`@workspace/api-client-react`（OpenAPI + Orval 生成）

### 3. 目录结构

- **根目录**
  - `package.json`：前端应用依赖与脚本
  - `vite.config.ts`：Vite 配置
  - `tsconfig.json`：该包的 TS 配置（继承根 `tsconfig.base.json`）

- **src/**
  - `main.tsx`：应用入口
  - `App.tsx`：整体布局、路由与全局 Provider
  - `index.css`：全局样式
  - `contexts/AuthContext.tsx`：认证上下文
  - `pages/`：主要业务页面
    - `dashboard.tsx`
    - `analyze.tsx`
    - `validate.tsx`
    - `analytics.tsx`
    - `material-new.tsx` / `material-detail.tsx`
    - `deck-detail.tsx`
    - `not-found.tsx`

### 4. 核心页面与状态说明

#### 4.1 文档解析与关键词筛选（Analyze）

- 文件：`src/pages/analyze.tsx`
- **Stage 1：输入文本**
  - 支持粘贴/拖拽 `.txt`/`.md`
  - 调用 `useAnalyzeDocument`（`POST /api/documents/analyze`）
- **Stage 2：关键词筛选（双栏）**
  - 左侧：原文分段 + 高亮（`HighlightedText`）
  - 右侧：TOC 树（Radix Accordion）
  - 关键词 ID 为 UUID 字符串（与后端一致）
- **关键联动**：
  - 展开章节 → 左侧滚动定位
  - 点击关键词 → 高亮与选中状态同步

#### 4.2 总览面板（Dashboard）

- 文件：`src/pages/dashboard.tsx`
- 拉取 `GET /api/documents` 与 `GET /api/decks` 渲染“我的文档列表 / 我的卡片组列表”
- 新建材料与卡片组创建后，使用 `setLocation` 跳转至详情页

#### 4.3 新建阅读材料（Notebook 风格）

- 文件：`src/pages/material-new.tsx`
- 使用 `useAnalyzeDocument` 提交内容，成功后跳转 `/materials/:id`。

#### 4.4 阅读材料详情

- 文件：`src/pages/material-detail.tsx`
- 展示阅读材料原文与关键词徽章列表（关键词 ID 为 UUID）。

#### 4.5 旧流程页面（待迁移）

- `validate.tsx` / `analytics.tsx` / `deck-detail.tsx`
- `review.tsx` 已从路由中移除（统一入口调整为专属详情页）。
- 旧的 `cards/reviews/analytics` API 当前返回 501，相关页面需迁移到新的 flashcards/decks tree API 后才能恢复。

### 5. 认证逻辑（AuthContext）

- 文件：`src/contexts/AuthContext.tsx`
- 通过 `/api/auth/me` 获取当前用户；使用 HTTP-only Cookie 维持会话。
- `AuthUser`：`{ id: string; email: string }`

### 6. 与后端的交互约定

- API 全部通过 `@workspace/api-client-react` hooks 调用。
- 关键词、文档、卡片等 ID 在新结构下均为 **UUID 字符串**。

### 7. 本地开发与代理

- 前端默认代理：`vite.config.ts` 中 `API_TARGET` 为空时指向 `http://localhost:3000`。
- **后端当前运行在 4000 端口时，需要显式指定**：

```bash
API_TARGET=http://localhost:4000 pnpm dev
```

- 否则前端会请求错误的后端端口，导致 404/500 与日志缺失。
