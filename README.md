## 剧情推演沙盒引擎（MVP）

完整技术方案见 **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)**；**分阶段实施方案与验收标准**见 **[docs/IMPLEMENTATION_PLAN.md](./docs/IMPLEMENTATION_PLAN.md)**。

这是一个最小可运行的剧情推演控制台，当前版本包含：

- 回合制 Tick 执行器（导演干预 -> 双方意图 -> 冲突结算 -> 状态更新）
- 强结构化输出（`Zod` schema）
- 导演控制台（`Next.js` App Router）
- 实时日志推送（`SSE`）

## 快速启动

1. 安装依赖：

```bash
npm install
```

2. 启动开发环境（默认端口 **3001**）：

```bash
npm run dev
```

生产构建并启动（同样默认 **3001**）：

```bash
npm run build
npm run start
```

3. 打开 [http://localhost:3001](http://localhost:3001)

## API

- `GET /api/tick?timeline=mainline`：按时间线加载最新快照与最近事件（默认 `mainline`）
- `POST /api/tick`：运行一个新回合
  - body: `{ "intervention": "天降大雨", "timelineLabel": "mainline" }`（`timelineLabel` 可选）
  - 也可配合 query：`POST /api/tick?timeline=mainline`
- `GET /api/stream?timeline=mainline`：按时间线订阅 SSE（只推送该分支事件）
- `POST /api/timeline/branch`（需 Supabase）：从某一 tick 分叉出新时间线
  - body: `{ "fromTimeline": "mainline", "atTick": 2, "newTimelineLabel": "my-branch" }`（名称可省略，自动生成）

## Supabase 持久化（可选启用）

当设置了 `SUPABASE_URL` 与 `SUPABASE_SERVICE_ROLE_KEY` 后：

- `GET /api/tick` 会优先从 `world_states`/`event_logs` 读取
- `POST /api/tick` 会在每个 Tick 后写入快照与事件日志

初始化数据库可执行：

```sql
-- 依次运行：
-- supabase/sql/0001_engine_core.sql
-- supabase/sql/0002_event_logs_timeline.sql
```

## LLM 意图生成（Phase 1，可选）

在 `.env.local` 中配置 `OPENAI_API_KEY`，并设置 `USE_LLM_INTENTS=true` 后，每个 Tick 会通过 **Vercel AI SDK** `generateObject` 按 `actorIntentSchema` 生成双方意图；默认模型为 `AI_MODEL_INTENT`（未设置时为 `gpt-4o-mini`）。未启用或未配置密钥时自动使用规则意图（便于本地与 CI）。

## 当前目录结构

```text
app/
  api/
    stream/route.ts
    tick/route.ts
    timeline/branch/route.ts
  page.tsx
docs/
  ARCHITECTURE.md
lib/
  engine/
    runTick.ts
    ruleBasedIntents.ts
    schema.ts
    store.ts
    persistence.ts
  llm/
    config.ts
    charter.ts
    intents.ts
  supabase/
    client.ts
```

## 下一步建议

详见 [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) 第五节。方向包括：LLM 结构化接入、Trigger.dev 长任务、Clerk + RLS、Langfuse、裁判规则库与可选 LangGraph 等。
