## 数据库技术文档（lib/db）

### 1. 概览

- **包名**：`@workspace/db`
- **职责**：提供 PostgreSQL 连接池、Drizzle ORM 实例及所有表结构定义；配合 `drizzle-zod` 生成插入用 Zod schema，供 api-server 与脚本使用。
- **依赖**：`drizzle-orm`、`pg`、`drizzle-zod`、`zod`（v4）。

### 2. 连接与导出（`src/index.ts`）

- **环境变量**：`DATABASE_URL`（必填），缺省时抛出错误。
- **连接池**：`new pg.Pool({ connectionString: process.env.DATABASE_URL })`，导出为 `pool`。
- **ORM 实例**：`drizzle(pool, { schema })`，导出为 `db`；所有表定义在 `src/schema` 下，通过 `export * from "./schema"` 一并导出。
- **子路径导出**：`@workspace/db/schema` 指向 `./src/schema/index.ts`，仅导出 schema 与类型。

### 3. Drizzle Schema（已与 SQL-new 对齐）

> 当前 Drizzle schema 已对齐 SQL-new 结构（UUID 主键、section/flashcard 关系）。旧表（`cards` / `review_logs` / 旧 `decks`）已从 schema 中移除。

#### 3.1 文档表（`src/schema/documents.ts`）

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | uuid | PK | 文档 ID（默认 `gen_random_uuid()`） |
| title | varchar(255) | NOT NULL | 标题 |
| created_at | timestamp | NOT NULL, default now() | 创建时间 |
| updated_at | timestamp | NOT NULL, default now() | 更新时间 |

- **说明**：已移除 `user_id` 关联，文档与用户解绑（鉴权流程后续再接回）。

#### 3.2 段落表（`src/schema/textBlocks.ts`）

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | uuid | PK | 段落 ID |
| document_id | uuid | NOT NULL, FK → documents.id | 所属文档 |
| content | text | NOT NULL | 段落文本 |
| position_index | int | NOT NULL | 文档内顺序索引 |

#### 3.3 章节表（`src/schema/sections.ts`）

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | uuid | PK | section ID |
| document_id | uuid | NOT NULL, FK → documents.id | 所属文档 |
| parent_section_id | uuid | NULL, FK → sections.id | 父 section |
| heading | varchar(255) | 可空 | 标题文本 |
| start_block_index | int | NOT NULL | 起始段落索引 |
| end_block_index | int | NOT NULL | 结束段落索引 |
| level | int | NOT NULL | 层级 |

#### 3.4 关键词表（`src/schema/keywords.ts`）

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | uuid | PK | 关键词 ID |
| section_id | uuid | NOT NULL, FK → sections.id | 所属 section |
| text_block_id | uuid | NULL, FK → text_blocks.id | 出现的段落（可选） |
| word | varchar(100) | NOT NULL | 关键词文本 |
| status | varchar(20) | NOT NULL, default 'PENDING' | 选择状态 |

#### 3.5 Deck 树结构（`src/schema/decks.ts`）

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | uuid | PK | deck ID |
| name | varchar(100) | NOT NULL | deck 名称 |
| parent_id | uuid | NULL, FK → decks.id | 父 deck |

#### 3.6 Flashcards（`src/schema/flashcards.ts`）

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | uuid | PK | flashcard ID |
| deck_id | uuid | NOT NULL, FK → decks.id | 所属 deck |
| source_keyword_id | uuid | NULL, FK → keywords.id | 来源关键词 |
| source_text_block_id | uuid | NULL, FK → text_blocks.id | 来源段落 |
| front_content | text | NOT NULL | 正面内容 |
| back_content | text | NOT NULL | 背面内容 |
| created_at | timestamp | NOT NULL, default now() | 创建时间 |

### 4. SQL-new 表结构（PostgreSQL 层）

SQL 层与 Drizzle 已对齐，主要脚本位于：

- `lib/db/sql/reading-materials.sql`
- `lib/db/sql/keywords-add.sql`
- `lib/db/sql/decks-tree-add.sql`
- `lib/db/sql/flashcards-add.sql`

> 以上脚本用于初始化新结构，并由后端 `POST /api/documents/analyze` 写入数据。

### 5. 关系与删除策略（概览）

- **Document → TextBlock**：`text_blocks.document_id`（ON DELETE CASCADE）
- **Document → Section**：`sections.document_id`（ON DELETE CASCADE）
- **Section → Section（树）**：`sections.parent_section_id`（ON DELETE SET NULL）
- **Section → Keyword**：`keywords.section_id`（ON DELETE CASCADE）
- **TextBlock → Keyword（可选）**：`keywords.text_block_id`（ON DELETE SET NULL）
- **Deck → Deck（树）**：`decks.parent_id`（ON DELETE SET NULL）
- **Deck → Flashcard**：`flashcards.deck_id`（ON DELETE RESTRICT）
- **Keyword → Flashcard（可选）**：`flashcards.source_keyword_id`（ON DELETE SET NULL）
- **TextBlock → Flashcard（可选）**：`flashcards.source_text_block_id`（ON DELETE SET NULL）

### 6. 旧表与兼容性

- 旧版 `cards` / `review_logs` / 旧 `decks` 已从 Drizzle schema 移除。
- 后端旧接口（`/api/cards/*`、`/api/reviews/*`、`/api/analytics/*`、`/api/decks/*`）当前返回 501，等待基于 SQL-new 的 flashcards/decks tree API 接入。
