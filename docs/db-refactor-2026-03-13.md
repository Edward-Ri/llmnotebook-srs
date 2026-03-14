## 2026-03-13 数据库重构日志

### 1. SQL-new 表结构确认与对齐

- 阅读材料相关 SQL 脚本（已确认）：
  - `lib/db/sql/reading-materials.sql`
  - `lib/db/sql/keywords-add.sql`
  - `lib/db/sql/decks-tree-add.sql`
  - `lib/db/sql/flashcards-add.sql`
- 关键新增/确认表：`keywords` / `decks` / `flashcards`
  - `keywords` 以 `section_id` 归档，并新增 `status` 字段（`PENDING/SELECTED`）
  - `decks` 变为树形结构（`parent_id`）
  - `flashcards` 以 `deck_id` 归属，并可关联 `source_keyword_id`/`source_text_block_id`

### 2. Drizzle Schema 与 API 类型统一

- Drizzle schema 已对齐 SQL-new：
  - `documents` 去除 `user_id`
  - `keywords` 使用 UUID + `section_id` + `status`
  - 新增 `flashcards` schema
  - `decks` 切换为 UUID + `parent_id`
- OpenAPI + Zod + React Client 全量更新为 UUID 类型：
  - `Keyword.id`、`TOCKeyword.id`、`Document.id`、`Deck.id`、`Card.id` 等全部改为 UUID string
  - `UpdateKeywordSelectionsBody.selectedIds`、`GenerateCardsRequest.keywordIds` 等改为 UUID string[]

### 3. 文档解析接口（DeepSeek）

- `POST /api/documents/analyze` 重构为 SQL-new 结构写入：
  - `documents` / `text_blocks` / `sections`
  - `keywords` 写入 `section_id` 维度
- DeepSeek 输出为 JSON 数组，过滤 `score < 3`
- `toc` 节点包含关键词列表（UUID）

### 4. 旧接口停用（过渡期）

- `/api/cards/*`、`/api/reviews/*`、`/api/analytics/*`、`/api/decks/*` 暂停使用（返回 501）
- 等待 flashcards + decks tree API 重新接入后恢复前端流转

### 5. 配置与开发修订

- `artifacts/api-server/.env` 仅保留占位：
  - `DEEPSEEK_API_KEY=your_api_key_here`
  - `DATABASE_URL=postgresql://srs_user:srs_password@localhost:5432/srs_db`
- 前端本地代理需要显式设置：
  - `API_TARGET=http://localhost:4000 pnpm dev`

### 6. 相关文档更新

- `docs/backend-tech-doc.md`
- `docs/database-tech-doc.md`
- `docs/frontend-tech-doc.md`
- `docs/local-dev-quickstart.md`

---

## 2026-03-14 用户体系与数据隔离

### 1. 用户表与关联

- 新增 `users` 表（UUID 主键、email 唯一、password_hash）
- `documents` / `decks` 新增 `user_id` 外键（ON DELETE CASCADE）

### 2. 鉴权与会话

- `POST /api/auth/register` / `POST /api/auth/login` 实现 bcrypt + JWT
- 使用 HTTP-only Cookie `srs_token` 保存会话
- `GET /api/auth/me` 依赖 `requireAuth`

### 3. 数据隔离

- `GET /api/documents` / `GET /api/decks` 返回当前用户数据
- `POST /api/documents/analyze` / `POST /api/decks` 强制绑定 `user_id`
