## 前端技术文档（artifacts/srs-app）

### 1. 概览

- **名称**：`@workspace/srs-app`
- **职责**：提供 AI 记忆引擎的 Web 前端界面，覆盖：
  - 文档解析与关键词筛选
  - AI 生成卡片的人机协同校验
  - SM-2 间隔复习学习流程
  - 学习统计与可视化分析
  - 用户注册登录与会话管理展示

### 2. 技术栈与依赖

- **语言**：TypeScript + JSX
- **框架**：React
- **路由**：`wouter`
- **数据获取与缓存**：`@tanstack/react-query`
- **UI 与样式**：
  - Tailwind CSS
  - Radix UI 组件系列（Accordion、Dialog、Tooltip、Tabs 等）
  - 自定义 UI 组件封装在 `src/components/ui/*`
- **图表与动效**：
  - `framer-motion`：页面和组件动画
  - `recharts`：统计图表
  - `canvas-confetti`：学习完成动效
- **API 客户端**：`@workspace/api-client-react`
  - 由 OpenAPI + Orval 生成，基于 React Query 的请求 hooks，例如：
    - `useAnalyzeDocument`
    - `useUpdateKeywordSelections`
    - `useGenerateCards`
    - `useGetPendingCards`
    - `useValidateCardsBatch`
    - `useGetDueCards`
    - `useLogReview`
    - `useGetAnalyticsSummary`
    - `useGetHeatmapData`

### 3. 目录结构

- **根目录**
  - `package.json`：前端应用依赖与脚本
  - `vite.config.ts`：Vite 配置
  - `tsconfig.json`：该包的 TS 配置（继承根 `tsconfig.base.json`）

- **src/**
  - `main.tsx`：应用入口，挂载根组件
  - `App.tsx`：整体布局、路由与全局 Provider
  - `index.css`：全局样式（Tailwind 引导）
  - `contexts/AuthContext.tsx`：认证上下文
  - `pages/`：主要业务页面
    - `dashboard.tsx`：仪表盘首页
    - `analyze.tsx`：文档解析与关键词筛选
    - `validate.tsx`：双屏卡片校验
    - `review.tsx`：SM-2 复习流程
    - `analytics.tsx`：学习分析页
    - `not-found.tsx`：404 页面
  - `components/`
    - `app-sidebar.tsx`：侧边导航
    - `AuthModal.tsx` 等业务组件
    - `ui/*`：可复用的基础 UI（Button、Card、Table、Chart、Toast、Sidebar 等）
  - `hooks/`
    - `use-toast.ts`：全局消息提示逻辑
    - `use-mobile.tsx`：移动端相关行为

### 4. 应用初始化与路由

- **入口文件**：`src/main.tsx`
  - 调用 `createRoot` 将 `<App />` 渲染到 `#root`。
  - 引入 `./index.css` 作为全局样式入口。

- **根组件**：`src/App.tsx`
  - **全局 Provider**：
    - `QueryClientProvider` 注入 React Query 客户端，默认：
      - `retry: false`（不自动重试）
      - `refetchOnWindowFocus: false`（窗口聚焦不强制刷新）
    - `AuthProvider` 提供登录态上下文
    - `TooltipProvider` 提供 Tooltip 能力
    - `SidebarProvider` 提供侧边栏折叠/展开状态
  - **布局**：
    - 左侧为 `AppSidebar`（导航与入口）
    - 右侧为主内容区域：
      - 顶部在移动端显示 `SidebarTrigger` 折叠按钮
      - 中部通过 `Router` 渲染不同业务页面
      - 使用 CSS 变量 `--sidebar-width` 等控制布局宽度
  - **路由配置**（基于 `wouter`）：
    - `/` → `Dashboard`
    - `/analyze` → `Analyze`
    - `/validate` → `Validate`
    - `/review` → `Review`
    - `/analytics` → `Analytics`
    - 其他 → `NotFound`

### 5. 认证逻辑（AuthContext）

- 文件：`src/contexts/AuthContext.tsx`
- **数据结构**：
  - `AuthUser`：`{ id: number; email: string }`
  - `AuthContextValue`：
    - `user: AuthUser | null`
    - `loading: boolean`
    - `register(email, password): Promise<void>`
    - `logout(): Promise<void>`
- **核心逻辑**：
  - 组件挂载后调用 `/api/auth/me`（`credentials: "include"`）检查当前是否登录：
    - 响应 200：保存 `data.user`
    - 非 200 / 网络错误：视为未登录
  - `register`：
    - 调用 `POST /api/auth/register`，body 为 `{ email, password }`
    - 使用 HTTP-only Cookie 存储后端签发的 JWT
    - 成功后更新 `user`
  - `logout`：
    - 调用 `POST /api/auth/logout`
    - 清空 `user`
- **安全性**：
  - 前端不直接管理 JWT，只依赖 Cookie 和 `/auth/me` 接口，降低 XSS 直接窃取 token 的风险。

### 6. 核心业务页面

#### 6.1 仪表盘（Dashboard）

- 文件：`src/pages/dashboard.tsx`
- 使用 `useGetAnalyticsSummary` 获取统计摘要数据。
- UI 包含：
  - 顶部 Hero 区（背景图 + 鼓励语）
  - 三大操作卡片：
    - “解析新文档” → 跳转 `/analyze`
    - “校验待定卡片” → 跳转 `/validate`
    - “开始今日复习” → 跳转 `/review`，展示待复习卡片数量
  - “学习概况”统计卡片网格：待复习卡片数、连续学习天数、总掌握卡片及占比、记忆保持率。

#### 6.2 文档解析与关键词筛选（Analyze）

- 文件：`src/pages/analyze.tsx`
- **阶段拆分**：
  - **Stage 1：输入文本**（`stage === "input"`）
    - 提供标题输入框与大段文本输入区域。
    - 支持：
      - 手动粘贴文本
      - 拖拽 `.txt`/`.md` 文件至输入区域
      - 点击按钮选择本地文件
    - 点击“开始解析”调用 `useAnalyzeDocument`：
      - 向后端提交 `{ title: string, content: string }`
      - 后端保存 `documents` 记录并解析关键词，返回：
        - 文档 ID
        - 关键词列表
        - `toc` 目录树（包含每个 section 的关键词）
      - 前端使用 `enrichKeywords` 函数：
        - 统计关键词在文本中的出现次数
        - 截取包含关键词的上下文片段
  - **Stage 2：关键词筛选**（`stage === "keywords"`）
    - 双栏布局（NotebookLM/Notion 风格）：
      - 左侧：按段落分块渲染原文，段落带锚点，`HighlightedText` 负责高亮选中关键词。
      - 右侧：TOC 目录树（Radix Accordion），每个 section 展开后展示其关键词标签。
    - 交互：
      - 展开/点击某个目录节点时，左侧自动滚动到该 section 的起始段落。
      - 点击关键词标签可选中/取消选中，并同步高亮左侧文本。
    - 点击“确认选择，继续生成卡片”：
      - 使用 `useUpdateKeywordSelections` 提交用户的选择结果
      - 使用 `useGenerateCards` 触发 AI 生成卡片
      - 成功后 toast 提示生成数量并跳转 `/validate`
  - **Stage 3：生成卡片加载**（`stage === "generating"`）
    - 显示 Loading 动画和文案“AI 正在构思卡片…”，等待生成结果。

#### 6.3 双屏卡片校验（Validate）

- 文件：`src/pages/validate.tsx`
- 核心 hooks：
  - `useGetPendingCards`：获取所有状态为待校验的卡片
  - `useValidateCardsBatch`：提交批量校验结果
- UI 结构：
  - 顶部：进度信息与进度条（已处理数量 / 总数量）
  - 左侧卡片（只读）：
    - 展示当前卡片的关键词、问题（frontContent）、答案（backContent）
    - 用作“AI 原始输出”参考
  - 右侧卡片（可编辑）：
    - 可切换到编辑模式，编辑问题/答案文本
    - 底部操作按钮：
      - “丢弃”：标记为应删除
      - “完美，直接保留”：不修改内容，标记保留
      - “保存修改并保留”：提交编辑后的内容并标记保留
- 本地状态：
  - 使用 `validations: Record<number, { action, frontContent, backContent }>` 记录每张卡片的决策。
  - 当所有卡片都被决策后，展示“审查完毕”界面，点击“提交所有校验结果”调用 `useValidateCardsBatch`，批量提交到后端。

#### 6.4 间隔复习（Review）

- 文件：`src/pages/review.tsx`
- 核心 hooks：
  - `useGetDueCards`：获取当前应复习的卡片列表（由后端根据 SM-2 算法计算 `dueDate`）
  - `useLogReview`：记录一次复习结果与评分
- UI 行为：
  - 使用可翻转卡片（front/back）显示问答。
  - 前面：显示问题文本和“显示答案”按钮。
  - 翻转后：
    - 上部：再次显示问题
    - 中部：显示答案内容
    - 下部：4 个掌握程度按钮（0～3，对应完全遗忘到轻松记起），点击后调用 `useLogReview`：
      - 请求体包含 `cardId` 和 `grade`
      - 后端更新该卡片的 SM-2 状态并记录一条 `review_logs` 日志
      - 前端切换到下一张卡片
  - 完成所有卡片后：
    - 触发 `canvas-confetti` 粒子动画
    - 显示“今日复习已完成”提示页，引导用户返回首页。

#### 6.5 学习分析（Analytics）

- 文件：`src/pages/analytics.tsx`
- 数据来源：
  - `useGetAnalyticsSummary`：获取摘要统计（记忆保持率、活跃卡片数、历史总复习次数、最长连续学习天数等）
  - `useGetHeatmapData`：获取按日期聚合的复习次数数据
- 可视化：
  - 使用 `recharts` 绘制“复习活动趋势”柱状图（X 轴为日期，Y 轴为次数）。
  - 构造最近 30 天 GitHub 风格的热力图，根据每日复习次数，使用不同颜色深浅编码活动强度。

### 7. 与后端的交互约定

- 所有 API 调用统一通过 `@workspace/api-client-react` 提供的 hooks 完成：
  - 请求路径、请求方法、请求/响应类型完全由 OpenAPI 规范自动生成，避免前后端手写定义不一致。
- 会话保持：
  - 前端请求时 `credentials` 一律设为 `"include"`（见手写 fetch 的 AuthContext），保证 Cookie 携带。
  - React Query 负责缓存、错误状态与请求中状态管理。

### 8. 开发与构建

- **开发启动**：
  - 在仓库根目录安装依赖后执行：
    - `pnpm --filter @workspace/srs-app run dev`
  - 默认通过 Vite 在 `http://localhost:5173`（或 Replit 提供的端口）启动前端开发服务器。

- **生产构建**：
  - `pnpm --filter @workspace/srs-app run build`
  - 生成的静态文件可部署到任意静态托管平台，或通过反向代理与后端 `/api/*` 路由集成。
