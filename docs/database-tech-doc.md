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

### 3. 表结构说明（Drizzle 层）

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
| id | uuid | PK | 文档 ID（默认 `gen_random_uuid()`） |
| user_id | integer | FK → users.id, 可空 | 所属用户，未登录可为 null |
| title | varchar(255) | NOT NULL | 标题 |
| created_at | timestamp | NOT NULL, default now() | 创建时间 |
| updated_at | timestamp | NOT NULL, default now() | 更新时间 |

- **Zod**：`insertDocumentSchema`（插入时省略 id、createdAt），类型 `InsertDocument`、`Document`。

#### 3.3 关键词表（`src/schema/keywords.ts`）

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | serial | PK | 自增主键 |
| document_id | uuid | NOT NULL, FK → documents.id | 所属文档 |
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

> 以上 3.1–3.5 为当前 Drizzle schema 中仍在使用的“旧版学习流”表结构，其中 `documents` 已迁移为 uuid 主键，而 `cards/review_logs` 仍使用 serial 主键。

### 4. 阅读材料与 Flashcards（PostgreSQL 层）

本小节描述的是基于 PostgreSQL SQL 脚本的“阅读材料 + 章节 + 段落 + 关键词 + 树形 deck + flashcards”新结构，主要由以下 SQL 文件定义：

- `lib/db/sql/reading-materials.sql`
- `lib/db/sql/keywords-add.sql`
- `lib/db/sql/decks-tree-add.sql`
- `lib/db/sql/flashcards-add.sql`

#### 4.1 文档与段落：`documents` / `text_blocks`

定义位置：`lib/db/sql/reading-materials.sql`

- `documents`

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | uuid | PK, default gen_random_uuid() | 文档 ID |
| title | varchar(255) | NOT NULL | 文档标题 |
| created_at | timestamp | NOT NULL, default now() | 创建时间 |
| updated_at | timestamp | NOT NULL, default now() | 更新时间（有 trigger 自动维护） |

- `text_blocks`

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | uuid | PK, default gen_random_uuid() | 段落 ID |
| document_id | uuid | NOT NULL, FK → documents.id ON DELETE CASCADE | 所属文档 |
| content | text | NOT NULL | 段落文本 |
| position_index | int | NOT NULL, UNIQUE(document_id, position_index) | 文档内顺序索引 |

- **索引**：
  - `idx_text_blocks_document_id`：`document_id`

#### 4.2 章节结构：`sections`

定义位置：`lib/db/sql/reading-materials.sql`

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | uuid | PK, default gen_random_uuid() | section ID |
| document_id | uuid | NOT NULL, FK → documents.id ON DELETE CASCADE | 所属文档 |
| parent_section_id | uuid | NULL, FK → sections.id ON DELETE SET NULL | 父 section，为 NULL 表示根 |
| heading | varchar(255) | 可空 | 标题文本 |
| start_block_index | int | NOT NULL | 覆盖的起始 text_block 索引 |
| end_block_index | int | NOT NULL | 覆盖的结束 text_block 索引 |
| level | int | NOT NULL | 层级（1 为最高级） |

- **索引**：
  - `idx_sections_document_id`：`document_id`
  - `idx_sections_parent_section_id`：`parent_section_id`
  - `idx_sections_start_block_index`：`start_block_index`
  - `idx_sections_end_block_index`：`end_block_index`

> 说明：当前 API 层已经在 `artifacts/api-server/src/utils/physicalChunking.ts` 中提供了基于纯文本的物理切分与 Section 原型划分、TOC 构建工具（`physicalChunk` / `segmentSections` / `buildTocTree`），并在 `POST /api/documents/analyze` 中写入 `documents` / `text_blocks` / `sections`。  
> 关键词仍写入 Drizzle 的 `keywords`（按 `document_id` 归档），与 SQL 层 `keywords`（按 `section_id`）存在结构差异，后续可再统一。

#### 4.3 关键词：`keywords`

定义位置：`lib/db/sql/keywords-add.sql`

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | uuid | PK, default gen_random_uuid() | 关键词 ID |
| section_id | uuid | NOT NULL, FK → sections.id ON DELETE CASCADE | 所属 section |
| text_block_id | uuid | NULL, FK → text_blocks.id ON DELETE SET NULL | 关键词出现的段落，可选 |
| word | varchar(100) | NOT NULL | 关键词内容 |
| status | varchar(20) | NOT NULL, default 'PENDING' | 关键词状态 |

- **唯一约束**：
  - `UNIQUE(section_id, word)`：同一 section 内不允许重复 keyword。

- **索引**：
  - `idx_keywords_section_id`：`section_id`
  - `idx_keywords_text_block_id`：`text_block_id`
  - `idx_keywords_word`：`word`

#### 4.4 Deck 树结构：`decks`

定义位置：`lib/db/sql/decks-tree-add.sql`

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | uuid | PK, default gen_random_uuid() | deck ID |
| name | varchar(100) | NOT NULL | deck 名称 |
| parent_id | uuid | NULL, FK → decks.id ON DELETE SET NULL | 父 deck，为 NULL 表示根 deck |

- **索引**：
  - `idx_decks_parent_id`：`parent_id`

#### 4.5 学习卡片：`flashcards`

定义位置：`lib/db/sql/flashcards-add.sql`

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | uuid | PK, default gen_random_uuid() | flashcard ID |
| deck_id | uuid | NOT NULL, FK → decks.id ON DELETE RESTRICT | 卡片所属 deck |
| source_keyword_id | uuid | NULL, FK → keywords.id ON DELETE SET NULL | 来源关键词，可选 |
| source_text_block_id | uuid | NULL, FK → text_blocks.id ON DELETE SET NULL | 来源段落，可选 |
| front_content | text | NOT NULL | 正面内容（问题/提示） |
| back_content | text | NOT NULL | 背面内容（答案/解释） |
| created_at | timestamp | NOT NULL, default now() | 创建时间 |

- **索引**：
  - `idx_flashcards_deck_id`：`deck_id`
  - `idx_flashcards_source_keyword_id`：`source_keyword_id`
  - `idx_flashcards_source_text_block_id`：`source_text_block_id`

#### 4.6 关系与删除策略（概览）

- **Document → TextBlock**：`text_blocks.document_id`（NOT NULL，ON DELETE CASCADE）  
  删除文档会级联删除其所有段落。
- **Document → Section**：`sections.document_id`（NOT NULL，ON DELETE CASCADE）  
  删除文档会级联删除其所有章节。
- **Section → Section（树）**：`sections.parent_section_id`（NULL，ON DELETE SET NULL）  
  删除父 section 时，子 section 的 `parent_section_id` 置为 NULL。
- **Section → Keyword**：`keywords.section_id`（NOT NULL，ON DELETE CASCADE）  
  删除 section 时，其下所有关键词被删除。
- **TextBlock → Keyword（可选关联）**：`keywords.text_block_id`（NULL，ON DELETE SET NULL）  
  删除段落时，只清空对应关键词的 `text_block_id`。
- **Deck → Deck（树）**：`decks.parent_id`（NULL，ON DELETE SET NULL）  
  删除父 deck 时，子 deck 的 `parent_id` 置为 NULL。
- **Deck → Flashcard**：`flashcards.deck_id`（NOT NULL，ON DELETE RESTRICT）  
  若某 deck 下存在 flashcards，则不允许删除该 deck。
- **Keyword → Flashcard（可选关联）**：`flashcards.source_keyword_id`（NULL，ON DELETE SET NULL）  
  删除 keyword 时，仅清空 flashcards 的来源 keyword。
- **TextBlock → Flashcard（可选关联）**：`flashcards.source_text_block_id`（NULL，ON DELETE SET NULL）  
  删除段落时，仅清空 flashcards 的来源段落。

### 5. 表关系与数据流（汇总）

#### 5.1 旧版学习流（Drizzle schema）

- **users** ← **documents**（documents.user_id → users.id，可空）
- **documents** ← **keywords**（keywords.document_id → documents.id）
- **keywords** ← **cards**（cards.keyword_id → keywords.id）
- **cards** ← **review_logs**（review_logs.card_id → cards.id）

业务流程简述（旧版）：
1. 用户注册/登录后，文档可关联 `user_id`。
2. 文档解析后插入 `documents` 与 `keywords`；用户选择关键词后，根据关键词生成记录插入 `cards`（status=pending_validation）。
3. 人工校验后，卡片 status 变为 `active` 或 `discarded`。
4. 复习时按 `cards.status=active` 且 `due_date<=now` 取卡片；每次复习写入一条 `review_logs`，并依 SM-2 更新卡片的 interval、repetition、efactor、due_date。

#### 5.2 阅读材料与 Flashcards 流程（PostgreSQL 层）

- **documents** → **text_blocks**：一个文档拆分为多个有序段落（`position_index`）。
- **documents** → **sections**：文档按章节、层级组织（TOC 树）。
- **sections** → **keywords**：从章节中抽取关键词，可选绑定到具体 `text_blocks`。
- **decks**（树）用于组织学习卡片文件夹。
- **flashcards** 通过：
  - `deck_id` 归属某个 deck；
  - `source_keyword_id` 记录来源关键词（可选）；
  - `source_text_block_id` 记录来源段落（可选），支持溯源到具体上下文。

> 当前代码库中，新结构主要通过 SQL 脚本维护（`lib/db/sql/*`），后续可以在 Drizzle schema 中增加对应的表定义与类型，逐步迁移旧的 `cards` 流程。

### 6. Schema 聚合（`src/schema/index.ts`）

- 通过 `export * from "./users"`、`"./documents"`、`"./keywords"`、`"./cards"`、`"./reviewLogs"` 统一导出所有表与 Zod schema，供 `db` 的 schema 选项和 api-server 使用。

### 7. 迁移与推送

- **Drizzle Kit**：使用 `drizzle.config.ts` 配置（需 `DATABASE_URL`）。
- **常用命令**：
  - `pnpm --filter @workspace/db run push`：将当前 schema 推送到数据库（开发环境常用）。
  - `pnpm --filter @workspace/db run push-force`：强制推送（谨慎使用）。
- 生产环境若使用迁移文件，需在项目中配置 Drizzle 的 migrate 脚本；当前文档以 push 为主。

### 8. 使用示例（api-server 内）

- 插入文档：`db.insert(documentsTable).values({...}).returning()`。
- 按文档查关键词：`db.select().from(keywordsTable).where(eq(keywordsTable.documentId, id))`。
- 更新卡片状态：`db.update(cardsTable).set({ status: "active", ... }).where(eq(cardsTable.id, id))`。
- 插入复习记录：`db.insert(reviewLogsTable).values({ cardId, grade })`。
- 统计与聚合：使用 `count()`、`gte`、`lte`、`and` 等 Drizzle 条件组合查询。
