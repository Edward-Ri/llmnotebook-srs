## 数据库重构与接入记录（2026-03-13 ~ 2026-03-15）

> 说明：本文件保留按日期的演进记录；**当前有效状态以 `backend-tech-doc.md` / `database-tech-doc.md` 为准**。

### 2026-03-13：SQL-new 主结构落地

#### 1. 表结构对齐

- 确认并接入：
  - `lib/db/sql/reading-materials.sql`
  - `lib/db/sql/keywords-add.sql`
  - `lib/db/sql/decks-tree-add.sql`
  - `lib/db/sql/flashcards-add.sql`
- 关键结构：
  - `keywords` 按 `section_id` 归档，带 `status`
  - `decks` 改为树结构（`parent_id`）
  - `flashcards` 归属 `deck_id`，可追溯来源 keyword/text block

#### 2. API 与类型统一

- OpenAPI/Zod/React Client ID 类型统一为 UUID string
- `selectedIds`、`keywordIds` 等数组参数全部改为 UUID 列表

#### 3. 文档解析重构

- `POST /api/documents/analyze` 按 SQL-new 写入 `text_blocks/sections/keywords`
- `toc` 节点挂载 UUID 关键词引用

---

### 2026-03-14：用户体系与数据隔离

#### 1. 用户与归属

- 新增 `users` 表（UUID 主键）
- `documents` / `decks` 增加 `user_id` 外键（`ON DELETE CASCADE`）

#### 2. 鉴权

- `register/login/me/logout` 接口完成 JWT + Cookie 会话
- 受保护资源按用户隔离访问

---

### 2026-03-15：复习链路与候选卡片恢复

#### 1. 复习

- `flashcards` 补齐 SM-2 字段：`repetition/interval/ease_factor/next_review_date`
- `review_logs` 接入 `user_id` + `card_id`
- `/api/reviews/due`、`/api/reviews/log` 恢复

#### 2. 候选卡片流程

- 新增 `card_candidates`
- 恢复：
  - `/api/cards/generate`
  - `/api/cards/pending`
  - `/api/cards/validate/batch`
  - `/api/cards/batch-assign-deck`
  - `/api/cards/batch`

#### 3. 统计与卡片组

- `/api/decks/:id` 恢复
- `/api/analytics/heatmap`、`/api/analytics/summary` 恢复

#### 4. 卡片生成质量优化（本次）

- `cards/generate` 改为关键词邻近上下文抽取
- 增加候选卡片过滤：长度、重复、问答相似度
- Prompt 强约束：单一概念、严格 JSON 输出

#### 5. 线上排错记录（本次）

- 现象：关键词选择后生成卡片返回 HTTP 500
- 根因：数据库缺失 `card_candidates` 表（日志：`relation "card_candidates" does not exist`）
- 处理：执行并确认
  - `lib/db/sql/card-candidates-add.sql`
  - `lib/db/sql/flashcards-sm2-add.sql`
  - `lib/db/sql/review-logs-add.sql`
