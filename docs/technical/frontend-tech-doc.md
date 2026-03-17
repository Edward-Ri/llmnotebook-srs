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
  - 已实现旧版阅读材料闭环前端
  - 尚未进入 `docs/notes-and-flashcards/03-notebook-frontend.md` 的 Phase 3 前端接入

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
- 创建完成后跳转到 `/materials/:id`

#### 3.2 阅读材料详情页

- `material-detail.tsx`
- 当前页面仍基于旧流程设计：
  - 在页面内提交文本
  - 依赖 `POST /api/documents/analyze`
  - 使用 `GET /api/documents/:documentId/outline`
  - 使用 `PUT /api/documents/:documentId/keywords`
  - 使用 `POST /api/cards/generate`

#### 3.3 候选卡片校验

- `document-card-validation.tsx`
- 在材料详情页内完成：
  - `GET /api/cards/pending`
  - `PUT /api/cards/validate/batch`
  - `PATCH /api/cards/batch-assign-deck`

#### 3.4 总览、复习与分析

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

### 5. 当前前后端差异

后端已完成 Phase 1 / Phase 2，前端尚未同步到新模型。当前主要差异：

- 后端主解析入口已改为：
  - `POST /api/documents/:documentId/references`
- 后端 `POST /api/documents/analyze` 已废弃，返回 `410`
- 后端已具备：
  - Reference 列表 / outline / blocks 接口
  - Notebook / Note Block CRUD 接口
- 前端仍未接入：
  - Reference 切换器
  - 多 Notebook 面板
  - Reference 原文独立展示
  - Note Block 编辑、拖拽、重排

### 6. 当前状态判断

可以认为前端目前仍处于“Phase 2 之前的旧工作区详情流”，而后端已经进入 Phase 2。

因此本文件的结论是：

- 前端现有页面可继续作为旧 UI 参考
- 但它不能代表当前后端的真实主流程
- 下一步前端应直接按 `03-notebook-frontend.md` 做 Phase 3 接入，而不是继续围绕 `documents/analyze` 迭代

### 7. 本地开发

- 前端目录：`artifacts/srs-app`
- 本地启动：

```bash
pnpm dev
```

- 默认代理：
  - `/api -> http://localhost:4000`

### 8. 当前注意点

- 若直接运行当前前端并进入材料解析页，可能会命中后端已废弃的 `POST /api/documents/analyze`
- 在 Phase 3 开始前，前端技术文档应以“现状说明 + 待接入点”维护，而不是继续描述旧接口闭环
