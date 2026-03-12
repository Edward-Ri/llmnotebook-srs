## 数据库技术文档（lib/db）

### 1. 概览

- **包名**：`@workspace/db`
- **职责**：为项目提供 PostgreSQL 连接池、Drizzle ORM 实例及所有表结构定义；配合 `drizzle-zod` 生成插入用 Zod schema，供 api-server 与脚本使用。
- **依赖**：`drizzle-orm`、`pg`、`drizzle-zod`、`zod`（v4）。

### 2. 连接与导出（`src/index.ts`）

- **环境变量**：`DATABASE_URL`（必填），缺省时抛出错误。
- **连接池**：`new pg.Pool({ connectionString: process.env.DATABASE_URL })`，导出为 `pool`。
- **ORM 实例**：`drizzle(pool, { schema })`，导出为 `db`；所有表定义在 `src/schema` 下，通过 `export * from "./schema"` 一并导出。
- **子路径导出**：`@workspace/db/schema` 指向 `./src/schema/index.ts`，仅导出 schema 与类型。

### 3. 表结构说明

#### 3.1 用户表（`src/schema/users.ts`）

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | serial | PK | 自增主键 |
| email | text | NOT NULL, UNIQUE | 邮箱 |
| password_hash | text | NOT NULL | bcrypt 哈希后的密码 |
| created_at | timestamp | NOT NULL, default now() | 创建时间 |

- **Zod**：`insertUserSchema`（插入时省略 id、createdAt），类型 `InsertUser`、`User`。

#### 3.2 文档表（`src/schema/documents.ts`）

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | serial | PK | 自增主键 |
| user_id | integer | FK → users.id, 可空 | 所属用户，未登录可为 null |
| title | text | NOT NULL, default '未命名文档' | 标题 |
| content | text | NOT NULL | 正文内容 |
| created_at | timestamp | NOT NULL, default now() | 创建时间 |

- **Zod**：`insertDocumentSchema`（插入时省略 id、createdAt），类型 `InsertDocument`、`Document`。

#### 3.3 关键词表（`src/schema/keywords.ts`）

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | serial | PK | 自增主键 |
| document_id | integer | NOT NULL, FK → documents.id | 所属文档 |
| word | text | NOT NULL | 关键词文本 |
| is_selected | boolean | NOT NULL, default false | 用户是否勾选参与生成卡片 |

- **Zod**：`insertKeywordSchema`（插入时省略 id），类型 `InsertKeyword`、`Keyword`。

#### 3.4 卡片表（`src/schema/cards.ts`）

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | serial | PK | 自增主键 |
| keyword_id | integer | NOT NULL, FK → keywords.id | 关联关键词 |
| front_content | text | NOT NULL | 正面（问题） |
| back_content | text | NOT NULL | 背面（答案） |
| status | text | NOT NULL, default 'pending_validation' | 状态：pending_validation / active / discarded |
| sm2_interval | integer | NOT NULL, default 1 | SM-2 间隔（天） |
| sm2_repetition | integer | NOT NULL, default 0 | SM-2 已复习次数 |
| sm2_efactor | real | NOT NULL, default 2.5 | SM-2 E-Factor |
| due_date | timestamp | NOT NULL | 下次复习日期 |

- **索引**：
  - `cards_due_date_idx`：`due_date`（加速待复习查询）
  - `cards_status_idx`：`status`（加速按状态筛选）
- **Zod**：`insertCardSchema`（插入时省略 id），类型 `InsertCard`、`Card`。

#### 3.5 复习日志表（`src/schema/reviewLogs.ts`）

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | serial | PK | 自增主键 |
| card_id | integer | NOT NULL, FK → cards.id | 被复习的卡片 |
| grade | integer | NOT NULL | 用户评分 0–3（完全遗忘～轻松） |
| created_at | timestamp | NOT NULL, default now() | 复习时间 |

- **Zod**：`insertReviewLogSchema`（插入时省略 id、createdAt），类型 `InsertReviewLog`、`ReviewLog`。

### 4. 表关系与数据流

- **users** ← **documents**（documents.user_id → users.id，可空）
- **documents** ← **keywords**（keywords.document_id → documents.id）
- **keywords** ← **cards**（cards.keyword_id → keywords.id）
- **cards** ← **review_logs**（review_logs.card_id → cards.id）

业务流程简述：
1. 用户注册/登录后，文档可关联 `user_id`。
2. 文档解析后插入 `documents` 与 `keywords`；用户选择关键词后，根据关键词生成记录插入 `cards`（status=pending_validation）。
3. 人工校验后，卡片 status 变为 `active` 或 `discarded`。
4. 复习时按 `cards.status=active` 且 `due_date<=now` 取卡片；每次复习写入一条 `review_logs`，并依 SM-2 更新卡片的 interval、repetition、efactor、due_date。

### 5. Schema 聚合（`src/schema/index.ts`）

- 通过 `export * from "./users"`、`"./documents"`、`"./keywords"`、`"./cards"`、`"./reviewLogs"` 统一导出所有表与 Zod schema，供 `db` 的 schema 选项和 api-server 使用。

### 6. 迁移与推送

- **Drizzle Kit**：使用 `drizzle.config.ts` 配置（需 `DATABASE_URL`）。
- **常用命令**：
  - `pnpm --filter @workspace/db run push`：将当前 schema 推送到数据库（开发环境常用）。
  - `pnpm --filter @workspace/db run push-force`：强制推送（谨慎使用）。
- 生产环境若使用迁移文件，需在项目中配置 Drizzle 的 migrate 脚本；当前文档以 push 为主。

### 7. 使用示例（api-server 内）

- 插入文档：`db.insert(documentsTable).values({...}).returning()`。
- 按文档查关键词：`db.select().from(keywordsTable).where(eq(keywordsTable.documentId, id))`。
- 更新卡片状态：`db.update(cardsTable).set({ status: "active", ... }).where(eq(cardsTable.id, id))`。
- 插入复习记录：`db.insert(reviewLogsTable).values({ cardId, grade })`。
- 统计与聚合：使用 `count()`、`gte`、`lte`、`and` 等 Drizzle 条件组合查询。
