## 后端技术文档（artifacts/api-server）

### 1. 概览

- **名称**：`@workspace/api-server`
- **职责**：
  - 提供前端所需的 REST API（文档解析、关键词筛选与后续卡片流程接口）。
  - 作为中间层协调数据库（`@workspace/db`）、LLM 服务（DeepSeek/OpenAI 兼容接口）以及前端应用。
- **主要技术栈**：
  - Node.js + TypeScript
  - Web 框架：Express
  - 数据库访问：`@workspace/db`（Drizzle ORM + PostgreSQL）
  - 校验与类型：`zod`
  - LLM：DeepSeek（OpenAI 兼容 REST），通过 `DEEPSEEK_API_KEY` 配置
- **配置加载**：入口 `src/index.ts` 使用 `import "dotenv/config"` 自动读取 `artifacts/api-server/.env`。

### 2. 目录结构（后端包内）

- `artifacts/api-server/`
  - `src/routes/`：路由定义（`documents.ts`、`auth.ts`、`decks.ts`、`cards.ts`、`reviews.ts`、`analytics.ts`）
  - `src/utils/`：工具函数与通用逻辑（`physicalChunking.ts`、`toc-keywords.ts`）
  - `src/services/`：外部服务封装（`llm.ts`）
  - `src/middlewares/`：鉴权与通用中间件（`auth.ts`）
  - `src/tests/`：关键工具/流程的 Node 测试脚本

### 3. 文本物理切分与 Section 分段（physicalChunking）

- 文件：`artifacts/api-server/src/utils/physicalChunking.ts`
- 类型定义：
  - `Paragraph`：`{ index: number; content: string }`
  - `Section`：`{ id: number; startIndex: number; endIndex: number }`
  - `TOCNode`：`{ id: string; title: string; startIndex: number; endIndex: number; children: TOCNode[]; keywords: { id: string; word: string }[] }`

#### 3.1 `physicalChunk(cleanText: string): Paragraph[]`

- 标准化换行符（`
`/`` → `
`）。
- 按行切分，过滤空行或短文本（<5 字符）。
- 为每行分配自增 `index`，形成稳定的 `Paragraph[]`。

#### 3.2 `segmentSections(blocks: Paragraph[]): Section[]`

- 当前原型实现：每 4 段切分为一个 `Section`。
- `id` 为从 0 开始的自增整数。

### 4. TOC 构建：`buildTocTree`

- 函数签名：

```ts
export function buildTocTree(sections: Section[], blocks: Paragraph[]): TOCNode[]
```

- 当前行为：
  - 每个 `Section` 生成一个顶层 `TOCNode`。
  - 标题取 section 起始段落内容，超长截断至约 80 字符。
  - `keywords` 由分析接口填充。

### 5. LLM 集成与文档解析流程（DeepSeek）

- **客户端封装**：`artifacts/api-server/src/services/llm.ts`
  - 读取 `process.env.DEEPSEEK_API_KEY`
  - 基址：`https://api.deepseek.com/v1/chat/completions`
  - 默认模型：`deepseek-chat`

- **入口路由**：`POST /api/documents/analyze`（`src/routes/documents.ts`）
  - **流程**：
    1. `physicalChunk` → `segmentSections` 生成文本 blocks 与 sections
    2. 按 section 调用 DeepSeek，System Prompt 强制输出 JSON 数组：
       - 每项 `{ word, reason, score(1-5) }`
       - 过滤 `score < 3` 的词
    3. 写入数据库（SQL-new 结构）：
       - `documents`、`text_blocks`、`sections`
       - `keywords`：按 `section_id` 归档，字段 `status` 标记选择状态
    4. 构建 `toc`，把关键词按 section id 挂到对应 `TOCNode.keywords`
  - **输出**：
    - `keywords`（关键词列表，id 为 UUID 字符串）
    - `toc`（目录树，节点内 `keywords` 也使用 UUID）

#### 5.1 错误处理约定

- LLM 调用失败：返回 HTTP 502，`{ error: "LLM_ERROR", message: "..." }`
- 其他失败：返回 HTTP 500，`{ error: "ANALYZE_ERROR", message: "..." }`

### 6. 认证与会话（JWT + HTTP-only Cookie）

- **注册**：`POST /api/auth/register`（bcrypt 哈希）
- **登录**：`POST /api/auth/login`（bcrypt 校验）
- **会话**：`GET /api/auth/me`（`requireAuth`）
- **登出**：`POST /api/auth/logout`
- **Cookie**：`srs_token`，HTTP-only，`sameSite=lax`，30 天有效期
- **中间件**：`requireAuth` 解析 Cookie 内 JWT 并挂载 `req.user`

### 7. 数据隔离（按用户）

- `POST /api/documents/analyze`：写入 `documents.user_id`（来自 `req.user.userId`）
- `GET /api/documents`：仅返回当前用户的文档，按创建时间倒序
- `GET/PUT /api/documents/:id/keywords`：校验文档归属后才允许访问
- `GET /api/decks`：仅返回当前用户的卡片组树
- `POST /api/decks`：创建时强制绑定 `user_id`

### 8. 旧接口与新结构的过渡说明

- **SQL-new 结构已成为主结构**：`documents` / `text_blocks` / `sections` / `keywords` / `decks` / `flashcards`。
- **旧学习流接口已暂时停用**（返回 501）：
  - `/api/cards/*`、`/api/reviews/*`、`/api/analytics/*`
- **说明**：`/api/decks` 已按新结构恢复（GET/POST）。
- **原因**：旧表（`cards` / `review_logs` / 旧 `decks`）已与新的 UUID/section 结构不兼容，等待新的 flashcards/decks tree API 接入。

### 9. 测试

- `artifacts/api-server/src/tests/physicalChunking.test.ts`：覆盖文本切分、分段与 TOC 构建。
- `artifacts/api-server/src/tests/documents.test.ts`：覆盖 TOC 关键词挂载逻辑（UUID 关键词 ID）。

### 10. 环境变量（开发常用）

- `DATABASE_URL=postgresql://srs_user:srs_password@localhost:5432/srs_db`
- `DEEPSEEK_API_KEY=your_api_key_here`
- `PORT=4000`
- `JWT_SECRET=dev-secret-change-me`
