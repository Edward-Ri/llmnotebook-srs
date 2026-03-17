## 后端技术文档（artifacts/api-server）

### 1. 概览

- 包名：`@workspace/api-server`
- 职责：
  - 提供工作区、Reference、Notebook、卡片、复习、统计、认证等 REST API
  - 协调数据库（`@workspace/db`）与 DeepSeek LLM
- 技术栈：Node.js + TypeScript + Express + Drizzle ORM + PostgreSQL + zod
- 配置加载：`src/index.ts` 通过 `import "dotenv/config"` 读取 `artifacts/api-server/.env`

### 2. 当前目录结构

- `src/routes/`
  - `documents.ts`
  - `references.ts`
  - `notes.ts`
  - `cards.ts`
  - `decks.ts`
  - `reviews.ts`
  - `analytics.ts`
  - `auth.ts`
- `src/services/`
  - `llm.ts`
  - `referenceParser.ts`
- `src/middlewares/`
  - `auth.ts`
- `src/utils/`
  - `physicalChunking.ts`
  - `toc-keywords.ts`
  - `sm2.ts`
  - `timezone.ts`

### 3. 启动与中间件

- 必填环境变量：
  - `DATABASE_URL`
  - `PORT`
  - `JWT_SECRET`
  - `DEEPSEEK_API_KEY`
- 全局中间件：
  - `cors`
  - `express.json`
  - `express.urlencoded`
  - `cookie-parser`
  - `attachUser`
- 所有业务路由统一挂载在 `/api`

### 4. 数据模型视角

当前后端已经完成 Phase 1 与 Phase 2 的服务层接入，核心层级为：

```text
documents（工作区）
├── references（导入材料）
│   ├── text_blocks
│   ├── sections
│   └── keywords
├── note_pages（多本 Notebook）
│   └── note_blocks
└── card_candidates / flashcards
```

### 5. Reference 解析与材料接口

#### 5.1 创建工作区

- `POST /api/documents`
- 用途：创建工作区容器，不再直接承载解析文本

#### 5.2 导入并解析 Reference

- `POST /api/documents/:documentId/references`
- 请求体：`{ title, text }`
- 主流程：
  1. 写入 `references`
  2. 调用 `referenceParser.parseReferenceContent`
  3. 对文本执行：
     - `physicalChunk`
     - 规则优先目录生成
     - LLM 两级目录补全
     - fallback 分段目录
     - 叶子 section 关键词提取
  4. 写入 `text_blocks / sections / keywords`
  5. 返回 `reference + toc + keywords + tocSource`

#### 5.3 Reference 读取接口

- `GET /api/documents/:documentId/references`
- `GET /api/references/:referenceId/outline`
- `GET /api/references/:referenceId/blocks`
- `DELETE /api/references/:referenceId`

#### 5.4 废弃接口

- `POST /api/documents/analyze` 已废弃
- 当前返回 `410`
- 新入口统一为 `POST /api/documents/:documentId/references`

### 6. Notebook 与 Note Block 接口

#### 6.1 Notebook

- `GET /api/documents/:documentId/notebooks`
- `POST /api/documents/:documentId/notebooks`
- `PATCH /api/notebooks/:notebookId`
- `DELETE /api/notebooks/:notebookId`

#### 6.2 Note Block

- `GET /api/notebooks/:notebookId/blocks`
- `POST /api/notebooks/:notebookId/blocks`
- `PATCH /api/notes/blocks/:blockId`
- `DELETE /api/notes/blocks/:blockId`
- `PATCH /api/notebooks/:notebookId/reorder`

#### 6.3 当前约束

- 所有 Notes 接口都通过 `req.user.id` 校验归属
- `source_text_block_id` 与 `source_reference_id` 会校验是否属于当前工作区
- 插入块时支持：
  - 末尾追加
  - 指定 `insertAtIndex`
  - 指定位置后的块顺延

### 7. 现有工作区接口适配

以下旧接口已适配到 `references` 数据模型：

- `GET /api/documents`
  - 工作区内容改为 `documents -> references -> text_blocks` 聚合
- `GET /api/documents/:documentId/outline`
  - 返回工作区下所有 references 的聚合目录
- `GET /api/documents/:documentId/keywords`
- `PUT /api/documents/:documentId/keywords`
  - 查询路径改为 `keywords -> sections -> references -> documents`

### 8. 卡片、复习与统计

#### 8.1 候选卡片生成

- `POST /api/cards/generate`
- 输入：`{ documentId, keywordIds }`
- 当前实现：
  - 先通过 `keywords -> sections -> references -> documents` 找到关键词所属 reference
  - 再按 `reference_id` 拉取 `text_blocks`
  - 对每个关键词取邻近上下文块（`NEIGHBOR_WINDOW = 1`）
  - LLM 输出严格 JSON
  - 结果做长度、相似度、重复过滤
  - 写入 `card_candidates`

#### 8.2 候选卡片校验与入组

- `GET /api/cards/pending`
- `PUT /api/cards/validate/batch`
- `PATCH /api/cards/batch-assign-deck`
- `POST /api/cards/batch`

#### 8.3 复习与统计

- `GET /api/reviews/due`
- `POST /api/reviews/log`
- `GET /api/analytics/heatmap`
- `GET /api/analytics/summary`
- `GET /api/decks`
- `GET /api/decks/:id`

`decks/:id` 的文档来源回溯已改为：

```text
flashcards -> keywords -> sections -> references -> documents
```

### 9. 认证与会话

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/guest`
- `GET /api/auth/me`
- `POST /api/auth/logout`

会话来源：

- 优先 Cookie：`srs_token`
- 无 Cookie 时支持 `Authorization: Bearer <token>`

### 10. 测试与校验

- 测试文件：
  - `src/tests/physicalChunking.test.ts`
  - `src/tests/documents.test.ts`
  - `src/tests/textCleaner.test.ts`
- 已验证：
  - `pnpm --filter @workspace/api-server run typecheck` 通过
  - 本地 `GET /api/healthz` 返回 `{"status":"ok"}`

### 11. 当前注意点

- 当前前端尚未进入 Phase 3，仍有旧页面依赖被废弃的 `POST /api/documents/analyze`
- `documents.ts` / `decks.ts` 的部分统计主要依赖 `sourceKeywordId -> sections -> references -> documents`
- 若后续卡片只写 `sourceReferenceId`、不写 `sourceKeywordId`，建议补 `sourceReferenceId` 优先的统计兜底逻辑
