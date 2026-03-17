## 数据库技术文档（lib/db）

### 1. 概览

- 包名：`@workspace/db`
- 职责：提供 PostgreSQL 连接、Drizzle ORM 实例、Schema 定义与类型导出
- 入口：`lib/db/src/index.ts`
- 环境变量：`DATABASE_URL`

### 2. 当前数据层级

```text
documents（工作区容器）
├── references（导入材料）
│   ├── text_blocks
│   ├── sections
│   │   └── keywords
├── note_pages（多本 Notebook）
│   └── note_blocks
├── card_candidates
├── decks
│   └── flashcards
└── review_logs
```

### 3. 当前 Schema 导出

`lib/db/src/schema/index.ts` 当前导出：

- `users`
- `documents`
- `references`
- `notePages`
- `noteBlocks`
- `textBlocks`
- `sections`
- `keywords`
- `decks`
- `flashcards`
- `cardCandidates`
- `reviewLogs`

### 4. 核心表结构

#### 4.1 users

- `id uuid pk`
- `email varchar(255) unique not null`
- `password_hash varchar(255) not null`
- `created_at timestamp not null`
- `is_guest boolean not null default false`
- `expires_at timestamp null`

#### 4.2 documents

- `id uuid pk`
- `user_id uuid fk -> users.id`
- `title varchar(255) not null`
- `created_at timestamp not null`
- `updated_at timestamp not null`

文档当前语义是“工作区容器”，不再直接承载已解析文本。

#### 4.3 references

- `id uuid pk`
- `document_id uuid not null fk -> documents.id`
- `user_id uuid not null fk -> users.id`
- `title varchar(255) not null`
- `created_at timestamp not null`
- `updated_at timestamp not null`

每次导入一份材料，创建一条 reference。

#### 4.4 text_blocks

- `id uuid pk`
- `reference_id uuid not null fk -> references.id`
- `content text not null`
- `position_index int not null`

索引：

- `text_blocks_reference_id_idx`
- `text_blocks_reference_id_position_index_uq`

#### 4.5 sections

- `id uuid pk`
- `reference_id uuid not null fk -> references.id`
- `parent_section_id uuid null fk -> sections.id`
- `heading varchar(255) null`
- `start_block_index int not null`
- `end_block_index int not null`
- `level int not null`

索引：

- `sections_reference_id_idx`
- `sections_parent_section_id_idx`
- `sections_start_block_index_idx`
- `sections_end_block_index_idx`

#### 4.6 keywords

- `id uuid pk`
- `section_id uuid not null fk -> sections.id`
- `text_block_id uuid null fk -> text_blocks.id`
- `word varchar(100) not null`
- `status varchar(20) not null default 'PENDING'`

#### 4.7 note_pages

- `id uuid pk`
- `user_id uuid not null fk -> users.id`
- `document_id uuid not null fk -> documents.id`
- `title varchar(255) not null`
- `created_at timestamp not null`
- `updated_at timestamp not null`

索引：

- `note_pages_document_id_user_id_idx`

#### 4.8 note_blocks

- `id uuid pk`
- `page_id uuid not null fk -> note_pages.id`
- `user_id uuid not null fk -> users.id`
- `document_id uuid not null fk -> documents.id`
- `source_text_block_id uuid null fk -> text_blocks.id`
- `source_reference_id uuid null fk -> references.id`
- `content text not null`
- `block_type varchar(32) not null default 'text'`
- `position_index int not null`
- `selection_offset int null`
- `selection_length int null`
- `created_at timestamp not null`
- `updated_at timestamp not null`

索引：

- `note_blocks_page_id_position_index_idx`
- `note_blocks_document_id_user_id_idx`

#### 4.9 decks

- `id uuid pk`
- `user_id uuid fk -> users.id`
- `name varchar(100) not null`
- `parent_id uuid null fk -> decks.id`

#### 4.10 flashcards

- `id uuid pk`
- `deck_id uuid not null fk -> decks.id`
- `source_keyword_id uuid null fk -> keywords.id`
- `source_text_block_id uuid null fk -> text_blocks.id`
- `source_note_block_id uuid null fk -> note_blocks.id`
- `source_reference_id uuid null fk -> references.id`
- `generation_mode varchar(32) not null default 'keyword'`
- `front_content text not null`
- `back_content text not null`
- `repetition int not null default 0`
- `interval int not null default 0`
- `ease_factor real not null default 2.5`
- `next_review_date timestamp not null default now()`
- `created_at timestamp not null default now()`

#### 4.11 card_candidates

- `id uuid pk`
- `user_id uuid fk -> users.id`
- `document_id uuid not null fk -> documents.id`
- `keyword_id uuid null fk -> keywords.id`
- `source_note_block_id uuid null fk -> note_blocks.id`
- `source_reference_id uuid null fk -> references.id`
- `generation_mode varchar(32) not null default 'keyword'`
- `front_content text not null`
- `back_content text not null`
- `status varchar(20) not null default 'pending_validation'`
- `created_at timestamp not null`

#### 4.12 review_logs

- `id serial pk`
- `user_id uuid fk -> users.id`
- `card_id uuid not null fk -> flashcards.id`
- `grade int not null`
- `created_at timestamp not null`

### 5. 删除策略

- `documents.user_id` / `references.user_id` / `note_pages.user_id` / `note_blocks.user_id` / `decks.user_id` / `review_logs.user_id` / `card_candidates.user_id`
  - `ON DELETE CASCADE`
- `references.document_id` / `note_pages.document_id` / `note_blocks.document_id` / `card_candidates.document_id`
  - `ON DELETE CASCADE`
- `text_blocks.reference_id` / `sections.reference_id`
  - `ON DELETE CASCADE`
- `keywords.section_id`
  - `ON DELETE CASCADE`
- `note_blocks.page_id`
  - `ON DELETE CASCADE`
- `note_blocks.source_text_block_id` / `note_blocks.source_reference_id`
  - `ON DELETE SET NULL`
- `flashcards.source_keyword_id` / `flashcards.source_text_block_id` / `flashcards.source_note_block_id` / `flashcards.source_reference_id`
  - `ON DELETE SET NULL`
- `card_candidates.keyword_id` / `card_candidates.source_note_block_id` / `card_candidates.source_reference_id`
  - `ON DELETE SET NULL`
- `flashcards.deck_id`
  - `ON DELETE RESTRICT`
- `sections.parent_section_id` / `decks.parent_id`
  - `ON DELETE SET NULL`

### 6. SQL 脚本

当前增量脚本位于 `lib/db/sql/`：

- `reading-materials.sql`
- `keywords-add.sql`
- `decks-tree-add.sql`
- `flashcards-add.sql`
- `users-add.sql`
- `flashcards-sm2-add.sql`
- `review-logs-add.sql`
- `card-candidates-add.sql`
- `references-add.sql`
- `text-blocks-migrate-to-reference.sql`
- `sections-migrate-to-reference.sql`
- `note-pages-add.sql`
- `note-blocks-add.sql`
- `flashcards-notes-fields-add.sql`
- `card-candidates-notes-fields-add.sql`

### 7. 迁移说明

Phase 1 已完成的关键迁移：

- 为旧 `documents` 回填默认 `references`
- `text_blocks.document_id -> reference_id`
- `sections.document_id -> reference_id`
- 为 `flashcards` 与 `card_candidates` 增加 notes / reference 来源字段
- 前端与后端当前都默认这些迁移已经完成，不存在运行时自动迁移
- 若本地库未执行以下 SQL，会直接影响当前主流程：
  - `references-add.sql`
  - `text-blocks-migrate-to-reference.sql`
  - `sections-migrate-to-reference.sql`
  - `note-pages-add.sql`
  - `note-blocks-add.sql`

### 8. 当前注意点

- `card_candidates.document_id` 仍保留工作区级别归属，不改为 `reference_id`
- 后续若进入 Phase 4 / Phase 5，`flashcards.source_note_block_id`、`flashcards.source_reference_id`、`generation_mode` 会开始被实际写入并参与来源回溯
- 若本地仍是旧 schema，常见故障包括：
  - `创建 Notebook 失败`
  - `导入 Reference 失败`
  - 典型根因是缺少 `note_pages`、`references` 表或缺少 `reference_id` 迁移列
