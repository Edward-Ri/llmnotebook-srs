## 本地开发一键启动指南

本指南总结了在本地 **启动数据库、后端 API、前端 Web 应用** 的最小步骤，适用于日常开发调试。

项目根目录：`/Users/edwardri/毕设项目/srs-ai&hci/srs-ai-hci`

---

## 1. 环境准备

- **Node**: 使用 `nvm` 切到 Node 20（例如 20.20.1）
- **包管理器**: 必须使用 `pnpm`
- **数据库**: 本机已安装并启动 PostgreSQL，默认监听 `localhost:5432`

在任意新终端中先执行：

```bash
cd "/Users/edwardri/毕设项目/srs-ai&hci/srs-ai-hci"
source ~/.nvm/nvm.sh 2>/dev/null || true
nvm use 20
```

如需重新安装依赖（一般只在依赖有变更或首次克隆时需要）：

```bash
pnpm install --no-frozen-lockfile
```

---

## 2. 数据库准备（PostgreSQL）

仅第一次需要执行以下 SQL，在本机 PostgreSQL 中创建库和用户：

```sql
CREATE DATABASE srs_db;
CREATE USER srs_user WITH PASSWORD 'srs_password';
GRANT ALL PRIVILEGES ON DATABASE srs_db TO srs_user;
```

后端及 Drizzle/ORM 通过以下连接串访问数据库：

```bash
export DATABASE_URL="postgresql://srs_user:srs_password@localhost:5432/srs_db"
```

### 文本材料相关表：`documents` 与 `text_blocks`

- `documents` 表代表一篇阅读材料或文档。
- `text_blocks` 表代表该文档拆分后的「文本块」，用于精细化分析与排序：
  - **一对多关系**：一行 `documents` 可以关联多行 `text_blocks`（`text_blocks.document_id` 外键指向 `documents.id`，并配置了 `ON DELETE CASCADE`，删除文档会自动删除其下所有文本块）。
  - **顺序语义**：`text_blocks.position_index` 表示文本块在文档中的顺序，从 0 或 1 开始连续递增（实际起始值由上游切分逻辑决定，但必须在同一文档内保持严格单调递增以反映真实顺序）。
  - **唯一性约束**：同一文档内 `(document_id, position_index)` 组合是唯一的，数据库层会拒绝插入或更新到重复的 `position_index`，以保证单个文档的块顺序不会出现「两块占用同一位置」的情况。

开发时如果需要根据顺序读取某个文档的所有文本块，应按 `position_index` 升序查询指定 `document_id` 的所有 `text_blocks` 记录。

---

## 3. 启动后端 API（终端 A）

在一个终端窗口中：

```bash
cd "/Users/edwardri/毕设项目/srs-ai&hci/srs-ai-hci"
source ~/.nvm/nvm.sh 2>/dev/null || true
nvm use 20

export DATABASE_URL="postgresql://srs_user:srs_password@localhost:5432/srs_db"
export PORT=4000
export JWT_SECRET="dev-secret-change-me"

cd artifacts/api-server
pnpm dev
```

成功标志：

- 终端输出类似：`Server listening on port 4000`
- 没有出现 `DATABASE_URL must be set` 等数据库配置错误

保持该终端运行，不要关闭。

---

## 4. 启动前端 Web 应用（终端 B）

在另一个终端窗口中：

```bash
cd "/Users/edwardri/毕设项目/srs-ai&hci/srs-ai-hci"
source ~/.nvm/nvm.sh 2>/dev/null || true
nvm use 20

cd artifacts/srs-app
pnpm dev
```

成功标志：

- 终端输出类似：

  ```text
  VITE v7.3.x  ready in xxx ms
  ➜  Local:   http://localhost:5173/
  ```

如果此时后端未启动，会在终端看到 `http proxy error: /api/... ECONNREFUSED`，属于正常保护行为，启动后端即可恢复。

---

## 5. 在浏览器访问应用

保持 **终端 A（后端）** 和 **终端 B（前端）** 都在运行状态，然后在本机浏览器中访问：

```text
http://localhost:5173/
```

若页面正常加载且无构建时报错，即表示数据库、后端与前端已在本地成功联动运行。

