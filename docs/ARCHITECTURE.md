# 剧情推演沙盒引擎 — 架构与方案总览

本文档固化项目的技术方案：包含**已实现能力**、**设计原则**与**规划中的方向**，便于对齐长期目标与迭代边界。

**分阶段实施路线与验收标准**见 **[IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)**。

---

## 一、产品愿景与核心目标

- **从「重体力码字」转向「高维沙盒推演」**：导演负责灵感与核心矛盾，系统负责可执行的因果与一致性。
- **摒弃「AI 群聊」**：采用 **中央状态机 + 严密回合制**（文字游戏 / 模拟引擎思路）。
- **状态驱动**：客观 **世界状态**（结构化数据）为推演真源；推演产出 **事件日志（骨架）**，与文学化 **扩写（血肉）** 分离（文思分离）。
- **信息隔离**：多角色在 **不对称信息** 下博弈，以产生戏剧性。
- **长期目标**：在导演干预下，尽量 **逼真、可长期自运转** 的世界；当世界观宏大、角色众多时，用 **分层仿真 + 事件驱动时间** 控制复杂度，而非全宇宙全精度实时积分。

---

## 二、总体架构原则（工程与逻辑）

### 1. 结构化输出 + 世界状态真源 + 分层结算

| 层次 | 作用 |
|------|------|
| **结构化输出（Zod）** | 将自然语言与模型输出约束为可解析对象，便于校验、路由与持久化。 |
| **世界状态真源** | 唯一权威快照；LLM 不直接当数据库；后果经 **结算层** 写入状态与事件日志。 |
| **分层结算** | 典型顺序：**导演干预解析 → 各角色意图（信息隔离）→ 裁判/规则合并 → 应用 delta → 提交新快照**。叙事文本不参与二次改数。 |

### 2. Genesis / 宪章（概念目标）

单一根对象（名称可换）同时承担：

- **逻辑宪法**：规则、体系、边界（版本化）。
- **初始世界状态** \(S(t_0)\)。
- **时间原点**：世界时钟起点。

后续状态由事件与结算从 \(S(t_0)\) 推出；重大改版通过版本或新时间线管理。

### 3. 大规模世界的复杂度控制

- **事件驱动时间轴**：未来事件队列 + `world_time`，避免对所有维度做连续小步积分。
- **状态分层**：Charter / 硬状态 / 软状态 / 叙事记忆（RAG）；回放与一致性主要锚定 **硬状态 + 事件日志**。
- **NPC LOD**：远景规则批处理、中景简单策略、近景/交汇点升高保真（含 LLM）。
- **导演不可见处的推进**：内部机制、排程事件、势力/NPC 策略（规则为主）；LLM 承担意图与语义缝隙，而非唯一动力源。

---

## 三、已实现技术栈（本仓库）

### 运行时与框架

- **Next.js（App Router）+ TypeScript**：导演控制台 UI、Route Handlers 作为 API。
- **默认端口 3001**：`npm run dev` 与 `npm run start` 均使用 `-p 3001`。
- **SSE**：`/api/stream` 向客户端推送推演事件。

### 引擎内核（当前以规则占位为主）

- **Zod**：`worldState`、`actorIntent`、`eventLog`、`directorInput`、分支输入等 schema。
- **`runTick`**：导演干预 → 双方意图 → 冲突结算 → 更新状态；事件携带 **`timelineLabel`**。
- **`store`**：进程内全局状态、事件历史、SSE 订阅；`createInitialState(timelineLabel)`；测试用 `resetEngineStoreForTests`。

### 持久化（可选 Supabase）

- **启用条件**：环境变量 `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`（仅服务端，勿暴露前端）。
- **迁移脚本**（按顺序执行）：
  - `supabase/sql/0001_engine_core.sql`：`world_states`、`event_logs`。
  - `supabase/sql/0002_event_logs_timeline.sql`：`event_logs.timeline_label`。
- **行为**：启用时 `GET/POST /api/tick` 读写数据库；未配置时回退内存模式。

### 时间线（分支 / 重演基础）

- **查询参数 / body**：`timeline` / `timelineLabel`。
- **`POST /api/timeline/branch`**：从指定时间线与 tick 分叉（需 Supabase）；tick 0 无快照时可用初始世界兜底。
- **SSE**：`?timeline=` 仅推送该分支事件。

### 测试

- **Vitest**，`vitest.config.ts` 配置 `@/` 路径别名。
- 覆盖引擎与关键 API 路由。

### 仓库与密钥

- **`.gitignore`**：忽略 `.env*`，但 **`!.env.example`** 可提交。
- **勿将** `.env.local`、service role 密钥提交到 Git。

---

## 四、API 摘要（当前实现）

| 接口 | 说明 |
|------|------|
| `GET /api/tick?timeline=` | 该时间线最新快照 + 最近事件 |
| `POST /api/tick` | `intervention`，可选 `timelineLabel`；推进一回合 |
| `GET /api/stream?timeline=` | 按时间线 SSE |
| `POST /api/timeline/branch` | 需 Supabase：从某 tick 分叉新时间线 |

---

## 五、规划与可选集成（尚未全部落地于代码路径）

下列与产品长期目标一致，**按需分阶段实现**：

| 方向 | 说明 |
|------|------|
| **Vercel AI SDK + LLM** | 导演自然语言 → 结构化干预；角色 → 结构化意图；裁判/扩写可分模型与管线。 |
| **Trigger.dev v3** | 长时推演、批量世界事件、摆脱 Serverless 单次请求超时（若控制台部署于 Vercel）。 |
| **Clerk** | B2B 身份与组织；与 Supabase **RLS + JWT** 桥接实现多租户隔离。 |
| **Langfuse** | Trace、Token、评估与人工评测。 |
| **Lemon Squeezy 等** | 支付与税务托管，与核心引擎解耦。 |
| **ComfyUI / RunPod / Replicate** | 重媒体异步任务，结果进 Storage。 |
| **LangGraph.js** | 非必须；复杂循环与 checkpoint 时再引入。 |

**已明确不纳入架构**：独立 **n8n** 作为业务编排（外部 Webhook 可直接由 Next API + 队列/Trigger 承接）。

---

## 六、业界经验（方法论）

- **分支叙事工具**（Ink / Yarn 等）：条件与变量驱动的状态机思维。
- **游戏与模拟**：事件驱动、行为树/效用 AI；大量 NPC 采用低保真后台。
- **LLM 编排框架**：解决调用顺序与重试，**不替代** Charter 与真源状态。
- **现实边界**：少有「单产品开箱即网文级 LLM 世界」的完全成熟方案；可行路径是 **规则与事件打底 + LLM 补语义 + 强状态与日志**。

---

## 七、模型选用原则（不绑定单一厂商）

- **分任务路由**：高频结构化调用可用较小/便宜模型；裁判、长篇一致性与扩写可用更强模型。
- **配置化**：通过环境变量或配置表指定 `MODEL_INTENT`、`MODEL_JUDGE`、`MODEL_PROSE` 等，避免写死模型 ID。
- **评测驱动**：在 Langfuse 或自建集上对比 JSON 合法率、逻辑违规与成本，定期调整。

---

## 八、风险与边界

- **全维度 × 全角色 × 全时** 的精确仿真不现实；「逼真」应定义为关键因果链一致且 **可回放**。
- **仅靠 LLM 推理**无法长期保证逻辑；**宪法/规则 + 状态真源**不可替代。
- **service_role** 泄露后必须在 Supabase 轮换密钥。

---

## 九、目录结构（扩展参考）

```text
app/
  api/
    stream/route.ts      # SSE
    tick/route.ts        # 状态查询与 Tick
    timeline/branch/route.ts
  page.tsx
lib/
  engine/
    schema.ts
    store.ts
    runTick.ts
    persistence.ts       # Supabase 读写与分叉
  supabase/
    client.ts
supabase/sql/            # 迁移脚本
docs/
  ARCHITECTURE.md        # 本文档
```

---

## 十、与 README 的关系

- **README.md**：安装、启动、API 速查、数据库初始化命令。
- **docs/ARCHITECTURE.md（本文）**：完整技术方案、原则与路线图，随迭代更新。
- **docs/IMPLEMENTATION_PLAN.md**：按阶段的实施方案、交付物与验收标准。
