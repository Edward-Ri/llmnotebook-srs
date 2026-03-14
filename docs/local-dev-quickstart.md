## 本地开发一键启动指南

本指南总结了在本地 **启动数据库、后端 API、前端 Web 应用** 的最小步骤，适用于日常开发调试。

项目根目录：`/Users/edwardri/毕设项目/srs-ai&hci/srs-ai-hci`

---

## 1. 环境准备

- **Node**: 使用 `nvm` 切到 Node 20（例如 20.20.1）
- **包管理器**: 必须使用 `pnpm`
- **数据库**: 本机已安装并启动 PostgreSQL，默认监听 `localhost:5432`
- **LLM**: 需要配置 `DEEPSEEK_API_KEY`

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

如使用 SQL 脚本初始化/迁移（新增）：

- `lib/db/sql/flashcards-sm2-add.sql`
- `lib/db/sql/review-logs-add.sql`
- `lib/db/sql/card-candidates-add.sql`

后端通过以下连接串访问数据库：

```bash
export DATABASE_URL="postgresql://srs_user:srs_password@localhost:5432/srs_db"
export DEEPSEEK_API_KEY="your_api_key_here"
export JWT_SECRET="dev-secret-change-me"
```

`.env` 位置：`artifacts/api-server/.env`（占位符已提供）：

```
DEEPSEEK_API_KEY=your_api_key_here
DATABASE_URL=postgresql://srs_user:srs_password@localhost:5432/srs_db
```

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
export DEEPSEEK_API_KEY="your_api_key_here"

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
API_TARGET=http://localhost:4000 pnpm dev
```

成功标志：

```text
VITE v7.3.x  ready in xxx ms
➜  Local:   http://localhost:5173/
```

> 注意：前端默认代理指向 `http://localhost:3000`，当前后端在 4000，必须显式设置 `API_TARGET`。

---

## 5. 在浏览器访问应用

保持 **终端 A（后端）** 和 **终端 B（前端）** 都在运行状态，然后在本机浏览器中访问：

```text
http://localhost:5173/
```

若页面正常加载且无构建时报错，即表示数据库、后端与前端已在本地成功联动运行。

---

## 6. 近期更新提示（2026-03-15）

- 复习系统（/api/reviews/*）、候选卡片流程（/api/cards/*）已恢复。
- 新增分析统计接口：/api/analytics/heatmap 与 /api/analytics/summary。
