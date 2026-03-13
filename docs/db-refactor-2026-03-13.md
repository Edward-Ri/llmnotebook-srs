## 2026-03-13 数据库重构日志

### 1. 新增 PostgreSQL 表（SQL 脚本层）

- **阅读材料相关 SQL 文件**：`lib/db/sql/reading-materials.sql`（今日回顾、确认结构）
- **新增表：keywords**
  - 文件：`lib/db/sql/keywords-add.sql`
  - 作用：存储从 `sections` 中抽取的关键词，可选关联到具体 `text_blocks`。
  - 关键结构与约束：
    - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
    - `section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE`
    - `text_block_id UUID NULL REFERENCES text_blocks(id) ON DELETE SET NULL`
    - `word VARCHAR(100) NOT NULL`
    - `status VARCHAR(20) NOT NULL DEFAULT 'PENDING'`
    - `UNIQUE (section_id, word)`
  - 索引：
    - `idx_keywords_section_id(section_id)`
    - `idx_keywords_text_block_id(text_block_id)`
    - `idx_keywords_word(word)`

- **新增表：decks（树形 deck 结构）**
  - 文件：`lib/db/sql/decks-tree-add.sql`
  - 作用：管理复习卡片文件夹，支持自关联树形结构。
  - 关键结构与约束：
    - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
    - `name VARCHAR(100) NOT NULL`
    - `parent_id UUID NULL REFERENCES decks(id) ON DELETE SET NULL`
  - 索引：
    - `idx_decks_parent_id(parent_id)`

- **新增表：flashcards（学习卡片）**
  - 文件：`lib/db/sql/flashcards-add.sql`
  - 作用：存储与 deck/keyword/text_block 关联的学习卡片。
  - 关键结构与约束：
    - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
    - `deck_id UUID NOT NULL REFERENCES decks(id) ON DELETE RESTRICT`
    - `source_keyword_id UUID NULL REFERENCES keywords(id) ON DELETE SET NULL`
    - `source_text_block_id UUID NULL REFERENCES text_blocks(id) ON DELETE SET NULL`
    - `front_content TEXT NOT NULL`
    - `back_content TEXT NOT NULL`
    - `created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP`
  - 索引：
    - `idx_flashcards_deck_id(deck_id)`
    - `idx_flashcards_source_keyword_id(source_keyword_id)`
    - `idx_flashcards_source_text_block_id(source_text_block_id)`

### 2. 关系与删除策略调整（概览）

- **Section ↔ Keyword**
  - 一个 section 下可以有多个 keywords（`keywords.section_id`）。
  - 删除 section 时，级联删除其所有 keywords（`ON DELETE CASCADE`）。
  - 同一 section 内 `word` 不可重复（`UNIQUE(section_id, word)`）。

- **TextBlock ↔ Keyword / Flashcard（可选关联）**
  - `keywords.text_block_id`、`flashcards.source_text_block_id` 均为可选外键。
  - 删除 text_block 时，这两列分别 `SET NULL`，保留关键词与卡片本身。

- **Deck 树结构与 Flashcard**
  - `decks.parent_id` 自关联，`ON DELETE SET NULL`，删除父 deck 时子 deck 成为新的根。
  - `flashcards.deck_id` 使用 `ON DELETE RESTRICT`，如果 deck 下存在卡片，不允许删除该 deck。

- **Keyword ↔ Flashcard（可选关联）**
  - `flashcards.source_keyword_id` 为可选外键，删除 keyword 时 `SET NULL`，保留卡片。

### 3. 文档更新

- **更新文件**：`docs/database-tech-doc.md`
  - 将原有基于 Drizzle、int/serial 主键的旧学习流结构标注为“旧版”。
  - 新增第 4 章《阅读材料与 Flashcards（PostgreSQL 层）》：
    - 详细说明 `documents` / `text_blocks` / `sections` / `keywords` / `decks` / `flashcards` 的字段、索引、外键与删除策略。
  - 在第 5 章增加“阅读材料与 Flashcards 流程（PostgreSQL 层）”，描述新的 ER 关系与数据流。

### 4. Git 提交与分支

- 相关提交（示例）：
  - `feat(db): add keywords and decks sql tables`
  - `feat(db): add flashcards table`
- 当前分支：`feat/notebooklm-layout-and-auth`（已推送至远端 `origin`）。

### 5. API 层与文本切分 / Section 工具更新

- 新增后端工具文件：`artifacts/api-server/src/utils/physicalChunking.ts`
  - `physicalChunk(cleanText: string): Paragraph[]`
    - 将原始长文本按行进行“物理切分”，过滤掉过短/空行，为后续 Section 划分与 TOC 构建提供基础 `blocks`。
  - `segmentSections(blocks: Paragraph[]): Section[]`
    - 目前按固定窗口（每 4 个段落一组）生成物理 `sections`，用于原型阶段的段落分段。
  - `buildTocTree(sections: Section[], blocks: Paragraph[]): TOCNode[]`
    - 基于 `sections` 和 `blocks` 生成最小可用的 TOC 树结构：暂时为“每个 section 一个根节点，标题取自该 section 第一个段落内容”的实现，为后续引入更精细的 heading/level 解析算法打基础。
- 对应测试：`artifacts/api-server/src/tests/physicalChunking.test.ts`
  - 覆盖文本物理切分、Section 分段，以及 `buildTocTree` 的基础行为，保证日志中描述的行为在代码中有可回归的测试。
  - 相关提交：`feat(api): add basic TOC tree builder`
