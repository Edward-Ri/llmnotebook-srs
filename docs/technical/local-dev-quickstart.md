## 本地开发指南

本指南用于本地最小化联调：数据库 + 后端 API + 前端 Web。

### 1. 环境准备

- Node：建议 `20.x`
- 包管理器：`pnpm`
- 数据库：PostgreSQL
- LLM：需要可用的 `DEEPSEEK_API_KEY`

项目根目录：

```bash
cd "/Users/edwardri/个人项目/srs-ai-hci"
```

首次安装或依赖变化后：

```bash
pnpm install --no-frozen-lockfile
```

### 2. 数据库准备

示例环境变量：

```bash
export DATABASE_URL="postgresql://srs_user:srs_password@localhost:5432/srs_db"
export JWT_SECRET="dev-secret-change-me"
export DEEPSEEK_API_KEY="your_api_key_here"
```

首次初始化后，建议按顺序执行以下脚本：

```bash
psql "$DATABASE_URL" -f lib/db/sql/users-add.sql
psql "$DATABASE_URL" -f lib/db/sql/keywords-add.sql
psql "$DATABASE_URL" -f lib/db/sql/decks-tree-add.sql
psql "$DATABASE_URL" -f lib/db/sql/flashcards-add.sql
psql "$DATABASE_URL" -f lib/db/sql/flashcards-sm2-add.sql
psql "$DATABASE_URL" -f lib/db/sql/review-logs-add.sql
psql "$DATABASE_URL" -f lib/db/sql/card-candidates-add.sql
psql "$DATABASE_URL" -f lib/db/sql/references-add.sql
psql "$DATABASE_URL" -f lib/db/sql/text-blocks-migrate-to-reference.sql
psql "$DATABASE_URL" -f lib/db/sql/sections-migrate-to-reference.sql
psql "$DATABASE_URL" -f lib/db/sql/note-pages-add.sql
psql "$DATABASE_URL" -f lib/db/sql/note-blocks-add.sql
psql "$DATABASE_URL" -f lib/db/sql/flashcards-notes-fields-add.sql
psql "$DATABASE_URL" -f lib/db/sql/card-candidates-notes-fields-add.sql
```

### 3. 启动后端

```bash
cd artifacts/api-server
PORT=4000 pnpm dev
```

成功标志：

- 输出 `Server listening on port 4000`

快速健康检查：

```bash
curl -sS http://127.0.0.1:4000/api/healthz
```

预期响应：

```json
{"status":"ok"}
```

### 4. 启动前端

```bash
cd artifacts/srs-app
pnpm dev
```

默认代理：

- `/api -> http://localhost:4000`

若后端端口变化，可覆盖：

```bash
API_TARGET=http://localhost:<port> pnpm dev
```

### 5. 类型检查

构建工作区库包：

```bash
pnpm run typecheck:libs
```

检查后端：

```bash
pnpm --filter @workspace/api-server run typecheck
```

### 6. 当前接口现状

- 后端主解析入口：
  - `POST /api/documents/:documentId/references`
- `POST /api/documents/analyze` 已废弃
- 后端已提供：
  - Reference 管理接口
  - Notebook / Note Block 管理接口
- 当前前端已完成 Phase 3 的最小接入：
  - 工作区双栏
  - Reference 导入与切换
  - Notebook CRUD
  - 原文拖拽 / 选区发送到 Notebook
  - 候选卡片底部抽屉校验

### 7. 常见问题

#### 7.1 后端启动失败：缺少 `PORT`

- 现象：
  - 启动时报 `PORT environment variable is required but was not provided`
- 处理：
  - 显式传入 `PORT=4000`

#### 7.2 生成卡片时报 `card_candidates` 不存在

- 处理：
  - 执行 `lib/db/sql/card-candidates-add.sql`

#### 7.3 Phase 2 之后仍使用旧前端解析流

- 现象：
  - 材料详情页调用 `POST /api/documents/analyze`
  - 后端返回 `410`
- 原因：
  - 前端代码或缓存仍停留在旧流程
- 处理：
  - 后续按 `docs/notes-and-flashcards/03-notebook-frontend.md` 接入新的 Reference / Notebook 流程

#### 7.4 创建 Notebook 失败

- 常见现象：
  - 点击“新建 Notebook”后 toast 提示创建失败
- 首先检查：
  - 数据库是否执行过 `lib/db/sql/note-pages-add.sql`
- 典型根因：
  - `note_pages` 表不存在
  - `documents` / `users` 相关前置表或触发器缺失
- 处理：
  - 按本文件第 2 节顺序执行 Phase 1 SQL

#### 7.5 导入 Reference 失败

- 常见现象：
  - 导入弹窗提交后 toast 提示导入失败
- 首先检查：
  - 数据库是否执行过：
    - `lib/db/sql/references-add.sql`
    - `lib/db/sql/text-blocks-migrate-to-reference.sql`
    - `lib/db/sql/sections-migrate-to-reference.sql`
- 当前说明：
  - 即使未配置 `DEEPSEEK_API_KEY`，关键词提取也会走本地回退
  - 因此持续失败时，应优先怀疑数据库 schema 不完整，而不是 LLM 配置
