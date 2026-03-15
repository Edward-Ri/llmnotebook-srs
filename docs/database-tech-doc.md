## 数据库技术文档（lib/db）

### 1. 概览

- **包名**：`@workspace/db`
- **职责**：提供 PostgreSQL 连接、Drizzle ORM 实例、Schema 定义与类型导出
- **核心依赖**：`drizzle-orm`、`pg`、`drizzle-zod`、`zod`

### 2. 连接与导出

- 入口：`lib/db/src/index.ts`
- 环境变量：`DATABASE_URL`（必填）
- 导出：
  - `pool`（`pg.Pool`）
  - `db`（`drizzle(pool, { schema })`）
  - 全量 schema（`export * from "./schema"`）
- `lib/db/src/schema/index.ts` 当前已导出：
  - `users/documents/textBlocks/sections/keywords/decks/flashcards/cardCandidates/reviewLogs`

### 3. Drizzle Schema（UUID 主结构）

#### 3.1 users

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | uuid | PK | 用户 ID |
| email | varchar(255) | UNIQUE, NOT NULL | 邮箱 |
| password_hash | varchar(255) | NOT NULL | 密码哈希 |
| created_at | timestamp | NOT NULL, default now() | 创建时间 |
| is_guest | boolean | NOT NULL, default false | 是否访客 |
| expires_at | timestamp | NULL | 访客过期时间 |

#### 3.2 documents

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | uuid | PK | 文档 ID |
| user_id | uuid | FK → users.id | 归属用户 |
| title | varchar(255) | NOT NULL | 标题 |
| created_at | timestamp | NOT NULL | 创建时间 |
| updated_at | timestamp | NOT NULL | 更新时间 |

#### 3.3 text_blocks

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | uuid | PK | 段落 ID |
| document_id | uuid | NOT NULL, FK → documents.id | 所属文档 |
| content | text | NOT NULL | 段落内容 |
| position_index | int | NOT NULL | 段落序号 |

#### 3.4 sections

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | uuid | PK | section ID |
| document_id | uuid | NOT NULL, FK → documents.id | 所属文档 |
| parent_section_id | uuid | NULL, FK → sections.id | 父 section |
| heading | varchar(255) | NULL | 标题 |
| start_block_index | int | NOT NULL | 起始块 |
| end_block_index | int | NOT NULL | 结束块 |
| level | int | NOT NULL | 层级 |

#### 3.5 keywords

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | uuid | PK | 关键词 ID |
| section_id | uuid | NOT NULL, FK → sections.id | 所属 section |
| text_block_id | uuid | NULL, FK → text_blocks.id | 关联段落（可空） |
| word | varchar(100) | NOT NULL | 关键词文本 |
| status | varchar(20) | NOT NULL, default 'PENDING' | 选择状态 |

#### 3.6 decks

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | uuid | PK | deck ID |
| user_id | uuid | FK → users.id | 归属用户 |
| name | varchar(100) | NOT NULL | 名称 |
| parent_id | uuid | NULL, FK → decks.id | 父节点 |

#### 3.7 flashcards

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | uuid | PK | 卡片 ID |
| deck_id | uuid | NOT NULL, FK → decks.id | 所属 deck |
| source_keyword_id | uuid | NULL, FK → keywords.id | 来源关键词 |
| source_text_block_id | uuid | NULL, FK → text_blocks.id | 来源段落 |
| front_content | text | NOT NULL | 正面 |
| back_content | text | NOT NULL | 背面 |
| repetition | int | NOT NULL, default 0 | SM-2 repetition |
| interval | int | NOT NULL, default 0 | SM-2 interval |
| ease_factor | real | NOT NULL, default 2.5 | SM-2 ease factor |
| next_review_date | timestamp | NOT NULL, default now() | 下次复习时间 |
| created_at | timestamp | NOT NULL, default now() | 创建时间 |

#### 3.8 review_logs

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | serial | PK | 记录 ID |
| user_id | uuid | FK → users.id | 用户 |
| card_id | uuid | NOT NULL, FK → flashcards.id | 卡片 |
| grade | int | NOT NULL | 评分 |
| created_at | timestamp | NOT NULL | 记录时间 |

#### 3.9 card_candidates

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | uuid | PK | 候选卡片 ID |
| user_id | uuid | FK → users.id | 用户 |
| document_id | uuid | NOT NULL, FK → documents.id | 来源文档 |
| keyword_id | uuid | NULL, FK → keywords.id | 来源关键词 |
| front_content | text | NOT NULL | 正面 |
| back_content | text | NOT NULL | 背面 |
| status | varchar(20) | NOT NULL, default 'pending_validation' | 候选状态 |
| created_at | timestamp | NOT NULL | 创建时间 |

### 4. SQL 脚本

初始化与增量脚本位于 `lib/db/sql/`：

- `reading-materials.sql`
- `keywords-add.sql`
- `decks-tree-add.sql`
- `flashcards-add.sql`
- `users-add.sql`
- `flashcards-sm2-add.sql`
- `review-logs-add.sql`
- `card-candidates-add.sql`

### 5. 关系与删除策略（摘要）

- `documents.user_id` / `decks.user_id` / `review_logs.user_id` / `card_candidates.user_id`：`ON DELETE CASCADE`
- `text_blocks.document_id` / `sections.document_id` / `keywords.section_id` / `card_candidates.document_id`：`ON DELETE CASCADE`
- `flashcards.deck_id`：`ON DELETE RESTRICT`
- `flashcards.source_keyword_id` / `flashcards.source_text_block_id` / `card_candidates.keyword_id`：`ON DELETE SET NULL`
- 树结构外键（`sections.parent_section_id`、`decks.parent_id`）：`ON DELETE SET NULL`

### 6. 本次问题相关校验

- 生成卡片依赖 `card_candidates` 表
- 复习接口依赖 `flashcards` 的 SM-2 字段 + `review_logs` 表
- 若缺失任一对象，会出现 500（典型报错：`relation "card_candidates" does not exist`）

### 7. 近期更新（2026-03-15）

- `schema/index.ts` 补充 `reviewLogs` 导出。
- 数据库已补齐 `card_candidates`、`review_logs` 与 `flashcards` 的 SM-2 字段迁移。
