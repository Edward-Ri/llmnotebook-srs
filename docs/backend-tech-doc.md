## 后端技术文档（artifacts/api-server）

### 1. 概览

- **名称**：`@workspace/api-server`
- **职责**：
  - 提供文档解析、卡片生成/校验、复习、统计、鉴权等 REST API
  - 协调数据库（`@workspace/db`）与 LLM（DeepSeek/OpenAI 兼容接口）
- **技术栈**：Node.js + TypeScript + Express + Drizzle ORM + PostgreSQL + zod
- **配置加载**：`src/index.ts` 通过 `import "dotenv/config"` 读取 `artifacts/api-server/.env`

### 2. 目录结构

- `src/routes/`：`documents.ts`、`auth.ts`、`decks.ts`、`cards.ts`、`reviews.ts`、`analytics.ts`
- `src/middlewares/`：鉴权中间件（`auth.ts`）
- `src/services/`：LLM 封装（`llm.ts`）
- `src/utils/`：文本切分、TOC、SM-2 等工具
- `src/tests/`：关键流程测试脚本

### 3. 启动与中间件

- `PORT` 为必填环境变量，未提供会直接抛错退出
- 全局中间件：`cors`、`express.json`、`cookie-parser`、`attachUser`
- 所有业务路由挂在 `/api`

### 4. 文档解析流程（`POST /api/documents/analyze`）

- 文件：`src/routes/documents.ts`
- 请求体：`{ documentId: uuid, text: string }`
- 前置条件：文档必须已由 `POST /api/documents` 创建，且归属当前用户
- 主流程：
  1. `physicalChunk` + `segmentSections` 进行段落与 section 切分
  2. 按 section 调用 DeepSeek 提取关键词（过滤 `score < 3`）
  3. 写入 `text_blocks`、`sections`、`keywords`
  4. 组装并返回 `toc` 与关键词列表（UUID）
- 错误约定：
  - LLM 异常：`502 { error: "LLM_ERROR", message }`
  - 其他异常：`500 { error: "ANALYZE_ERROR", message }`

### 5. 卡片生成与校验流程

#### 5.1 生成候选卡片（`POST /api/cards/generate`）

- 文件：`src/routes/cards.ts`
- 输入：`{ documentId, keywordIds[] }`
- 关键实现：
  - 对每个关键词只取“邻近上下文块”（`NEIGHBOR_WINDOW=1`）喂给 LLM
  - 强约束 Prompt：单一概念、严格 JSON、禁止输出额外文本
  - 结果二次过滤：长度限制、问答相似度过滤、去重、最多 4 张
  - 入库目标：`card_candidates`

#### 5.2 校验与入组

- `GET /api/cards/pending`：按用户（可选按 document）获取待校验候选
- `PUT /api/cards/validate/batch`：批量标记 `active` / `discarded`
- `PATCH /api/cards/batch-assign-deck`：把 `active` 候选写入 `flashcards` 并删除候选
- `POST /api/cards/batch`：直接批量写入 `flashcards`

### 6. 复习与统计

- `GET /api/reviews/due`：
  - 支持 `deckId` 组内过滤
  - 队列口径为 `New + Due`（`interval=0` 视为 New；`interval>0 且 next_review_date < 本地次日零点` 视为 Due）
  - 返回 `newCount / dueCount / todayReviewed`，并随机混排卡片队列
- `POST /api/reviews/log`：记录评分并更新 SM-2（`repetition/interval/easeFactor/nextReviewDate`）
- `GET /api/analytics/heatmap`：最近 365 天复习热力图（按本地时区分桶）
- `GET /api/analytics/summary`：总卡片、总复习、今日复习、待复习、留存率、连续天数、平均评分（按本地时区计算）
- `GET /api/decks`、`GET /api/decks/:id`：返回卡片组统计 `newCards / dueCards / reviewedToday`

#### 6.1 时区边界与统计口径

- 统一通过 `src/utils/timezone.ts` 处理时区偏移与本地日界线
- 支持从 Query/Header 读取 `tzOffsetMinutes`
- 前端约定请求头：`x-tz-offset-minutes`
- 日界线计算使用 UTC 安全算法，避免服务端时区导致的跨日错判

### 7. 认证与会话

- `POST /api/auth/register`、`POST /api/auth/login`：邮箱密码注册登录
- `POST /api/auth/guest`：创建访客用户（24h 过期）
- `GET /api/auth/me`：读取当前会话
- `POST /api/auth/logout`：清理会话；访客会被删除
- 会话来源：
  - 优先 Cookie：`srs_token`
  - 无 Cookie 时支持 `Authorization: Bearer <token>`（访客流）

### 8. 数据隔离

- 全部受保护接口通过 `requireAuth`，以 `req.user.id` 作为用户边界
- 关键接口均校验资源归属（documents/decks/cards/reviews）

### 9. 环境变量（开发常用）

- `DATABASE_URL=postgresql://srs_user:srs_password@localhost:5432/srs_db`
- `DEEPSEEK_API_KEY=your_api_key_here`
- `PORT=4000`
- `JWT_SECRET=dev-secret-change-me`

### 10. 测试

- `src/tests/physicalChunking.test.ts`
- `src/tests/documents.test.ts`
- `src/tests/textCleaner.test.ts`

### 11. 运维排错（本次问题）

- 若生成卡片时报 500 且日志含 `relation "card_candidates" does not exist`：
  - 说明数据库缺失迁移脚本 `lib/db/sql/card-candidates-add.sql`
- 建议同时补齐以下迁移，避免后续复习接口错误：
  - `lib/db/sql/flashcards-sm2-add.sql`
  - `lib/db/sql/review-logs-add.sql`

### 12. 近期更新（2026-03-15）

- 卡片生成上下文改为关键词邻域抽取，减少冗余上下文。
- 新增候选卡片结果过滤（长度/重复/相似度）提升可复习性。
- 鉴权链路补充访客模式与 Bearer Token 回退支持。
- 复习队列改为 `New + Due` 并补充 `newCount / dueCount / todayReviewed`。
- 统计与卡片组看板改为按本地时区计算，修复跨日边界导致的“今日数据缺失”问题。
