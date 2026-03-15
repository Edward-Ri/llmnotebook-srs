## 本地开发一键启动指南

本指南用于本地最小化联调：数据库 + 后端 API + 前端 Web。

项目根目录：`/Users/edwardri/毕设项目/srs-ai&hci/srs-ai-hci`

---

## 1. 环境准备

- Node：建议 `20.x`
- 包管理器：`pnpm`
- 数据库：PostgreSQL（默认 `localhost:5432`）
- LLM：需要可用的 `DEEPSEEK_API_KEY`

```bash
cd "/Users/edwardri/毕设项目/srs-ai&hci/srs-ai-hci"
source ~/.nvm/nvm.sh 2>/dev/null || true
nvm use 20
```

首次或依赖变化时：

```bash
pnpm install --no-frozen-lockfile
```

---

## 2. 数据库准备

首次初始化（示例）：

```sql
CREATE DATABASE srs_db;
CREATE USER srs_user WITH PASSWORD 'srs_password';
GRANT ALL PRIVILEGES ON DATABASE srs_db TO srs_user;
```

建议按顺序执行以下增量脚本，避免运行时 500：

```bash
psql "$DATABASE_URL" -f lib/db/sql/flashcards-sm2-add.sql
psql "$DATABASE_URL" -f lib/db/sql/review-logs-add.sql
psql "$DATABASE_URL" -f lib/db/sql/card-candidates-add.sql
```

常用环境变量：

```bash
export DATABASE_URL="postgresql://srs_user:srs_password@localhost:5432/srs_db"
export DEEPSEEK_API_KEY="your_api_key_here"
export JWT_SECRET="dev-secret-change-me"
```

---

## 3. 启动后端（终端 A）

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

- 输出 `Server listening on port 4000`

---

## 4. 启动前端（终端 B）

```bash
cd "/Users/edwardri/毕设项目/srs-ai&hci/srs-ai-hci"
source ~/.nvm/nvm.sh 2>/dev/null || true
nvm use 20

cd artifacts/srs-app
pnpm dev
```

说明：当前 `vite.config.ts` 默认代理 `/api -> http://localhost:4000`，通常无需再设置 `API_TARGET`。

仅在后端端口变化时覆盖：

```bash
API_TARGET=http://localhost:<port> pnpm dev
```

---

## 5. 访问应用

- 前端：`http://localhost:5173/`
- 确保终端 A/B 都保持运行

---

## 6. 常见 500 排查

- 症状：关键词选择后“生成卡片”返回 500
- 后端日志若出现 `relation "card_candidates" does not exist`：
  - 执行 `lib/db/sql/card-candidates-add.sql`
- 为避免复习链路继续报错，建议同时执行：
  - `lib/db/sql/flashcards-sm2-add.sql`
  - `lib/db/sql/review-logs-add.sql`

可快速校验：

```bash
psql "$DATABASE_URL" -Atc "select to_regclass('public.card_candidates');"
psql "$DATABASE_URL" -Atc "select to_regclass('public.review_logs');"
```

---

## 7. 复习后统计为空排查

- 症状：
  - 复习完成后进入卡片组详情提示“无法加载卡片组详情”
  - Dashboard 的“今日已背诵”始终为 0
  - Analytics 热力图/总复习数无变化
- 排查建议：
  - 确认前端请求包含 `Authorization: Bearer <guest_token>`（访客模式）与 `x-tz-offset-minutes` 头
  - 确认前端未在页面跳转时触发自动登出（`beforeunload -> /api/auth/logout`）
  - 确认后端使用本地时区日界线进行统计（`reviews/decks/analytics` 统一走 `src/utils/timezone.ts`）
- 快速验证：
  - 先在 `/review` 完成 1 张卡片评分
  - 再访问 `/api/reviews/due`、`/api/decks/:id`、`/api/analytics/summary`，确认 `todayReviewed/reviewedToday/todayReviews` 有增量
