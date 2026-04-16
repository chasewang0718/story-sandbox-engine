# 剧情推演沙盒引擎 — 实施方案

本文档依据 [ARCHITECTURE.md](./ARCHITECTURE.md) 制定**分阶段、可交付、可验收**的实施路线。原则：**先打通「自然语言 → 结构化 → 真源状态」闭环，再扩租户、长任务与大规模世界**。

---

## 0. 基线（已完成）

| 内容 | 说明 |
|------|------|
| 回合引擎 | `runTick`、Zod schema、内存 `store` |
| API | `/api/tick`、`/api/stream`、`/api/timeline/branch` |
| 持久化 | Supabase：`world_states`、`event_logs` + `timeline_label` |
| 测试 | Vitest 覆盖引擎与关键路由 |
| 文档 | `docs/ARCHITECTURE.md` |

**本计划从 Phase 1 起为新增工作。**

---

## 阶段总览（依赖顺序）

```text
Phase 1  LLM 接入（意图/可选导演解析）— 核心闭环
    ↓
Phase 2  分层结算强化（规则优先 + 裁判 LLM 可选）
    ↓
Phase 3  Genesis / 作品维度（宪章 + 初态 + 时间原点）
    ↓
Phase 4  可观测性（Langfuse）
    ↓
Phase 5  长任务（Trigger.dev，可选按部署形态启动）
    ↓
Phase 6  多租户（Clerk + Supabase RLS）
    ↓
Phase 7  事件驱动世界与 NPC LOD（规模化）
```

---

## Phase 1：LLM 接入（Vercel AI SDK + 结构化输出）

**目标**：在**不破坏**现有无密钥开发体验的前提下，让「角色意图」可由模型生成，并严格落在 Zod 内。

### 1.1 交付物

- 依赖：`ai` 及至少一家 Provider（如 `@ai-sdk/openai`）。
- 模块建议：
  - `lib/llm/client.ts`：统一创建 model（读环境变量）。
  - `lib/llm/intents.ts`：`generateActorIntent(...)` 使用 `generateObject` + `actorIntentSchema`。
- 环境变量（写入 `.env.example`，勿提交密钥）：
  - `OPENAI_API_KEY`（或按 Provider 命名）
  - `AI_MODEL_INTENT`（默认小模型，高频）
- **特性开关**：`USE_LLM_INTENTS=true|false`；为 `false` 或未配置密钥时，**回退当前规则意图**（保证 CI/本地测试稳定）。

### 1.2 改造点

- `lib/engine/runTick.ts`：在 `generateIntent` 处分支——规则 vs LLM。
- Prompt 输入：**仅**包含该角色**可见**字段（从 `WorldState` 中裁剪），并注入**极简**世界观摘要（可先硬编码一段 `charterSummary` 常量，Phase 3 再外置）。

### 1.3 验收标准

- `npm run test` 全绿（无 API Key 时走规则路径）。
- 配置 Key 且 `USE_LLM_INTENTS=true` 时，意图为合法 JSON，且能通过 `actorIntentSchema.parse`。
- 单次 Tick 失败（网络/429）有**明确错误**或降级策略，不污染世界状态。

### 1.4 风险与对策

| 风险 | 对策 |
|------|------|
| 成本与延迟 | 默认小模型；限长上下文；缓存同 tick 只调两次（主/反） |
| 输出漂移 | 强 schema + 失败重试一次 + 回退规则 |

**预估体量**：2–4 个工作日（含联调与测试桩）。

---

## Phase 2：分层结算强化（导演解析 + 裁判）

**目标**：导演自然语言先变为**结构化干预**（可与意图并行简化），冲突结算**规则优先**，语义缝隙由**裁判 LLM** 输出**结构化 delta**。

### 2.1 交付物

- Zod：`directorEffectsSchema`（首版可极小：标签 + 强度 + 作用对象 id 列表）。
- `lib/llm/director.ts`：`parseDirectorIntervention(text, stateSummary) -> schema`（`generateObject`）。
- `lib/engine/resolve.ts`：拆分 **代码裁判** 与 **LLM 裁判** 入口；合并为**唯一** `Resolution`（数值 delta、flag）。
- `runTick` 顺序固定：**解析（可选 LLM）→ 意图 → 结算 → 写状态**。

### 2.2 验收标准

- 无 Key 时：导演句仍参与规则关键词分支（与现逻辑兼容）或仅记录原文事件。
- 有 Key 时：解析结果可持久化到 `event_logs.payload` 便于审计。

**预估体量**：3–5 个工作日。

---

## Phase 3：Genesis / 作品维度

**目标**：单一根对象绑定：**宪章摘要 + 初始世界 + 时间原点**，并与 `timeline`/`project` 关联。

### 3.1 数据层

- 新表（示例命名，可调整）：
  - `projects`：`id`、`slug`、`title`、`charter_json`（规则与叙述分区）、`initial_world_state jsonb`、`world_epoch_start`（时间原点）、`schema_version`。
- 迁移：`supabase/sql/0003_projects_genesis.sql`。
- `world_states` / `event_logs` 增加 `project_id`（UUID，可空过渡）或要求新数据必带。

### 3.2 应用层

- `GET/POST /api/tick` 支持 `projectId`（或从 `timeline` 映射），加载对应 Genesis 初始化或接续最新快照。
- 控制台：可选下拉「作品」，无 UI 时可用 query 参数。

### 3.3 验收标准

- 同一 Supabase 实例可并存**两套**完全不同初始世界与宪章，互不覆盖。
- 分叉 API 在**同一 project** 内仍按 `timeline_label` 工作。

**预估体量**：3–6 个工作日（含迁移与回归测试）。

---

## Phase 4：Langfuse 全链路追踪

**目标**：每次 Tick 可追溯：解析 → 各意图 → 裁判 → 写库；可看 Token 与延迟。

### 4.1 交付物

- `lib/observability/langfuse.ts`：可选初始化（无 Key 则 no-op）。
- 在 `runTick` 或 API 层包裹 span，**trace id** 与 `timeline`、`tick`、`project_id` 关联。

### 4.2 验收标准

- 本地无 Langfuse Key 时零影响。
- 配置后可在 Langfuse UI 看到完整树状 Trace。

**预估体量**：1–3 个工作日。

---

## Phase 5：Trigger.dev（长任务与批处理）

**目标**：多 Tick 连续推演、批量「世界推进」不阻塞 HTTP，不受 Serverless 超时限制（若部署在 Vercel 等）。

### 5.1 交付物

- Trigger.dev 项目与任务定义：`runStoryTickJob`（参数：`projectId`、`timeline`、`intervention` 或批指令）。
- Next API：由「同步 Tick」改为「触发任务 + 轮询/SSE 读进度」（可保留同步路径作开发用）。

### 5.2 验收标准

- 单次任务可配置执行多步 Tick，中断可恢复或幂等重试（设计 `run_id` + `tick` 幂等键）。

**预估体量**：5–10 个工作日（视 Trigger 学习与部署环境而定）。

---

## Phase 6：Clerk + Supabase RLS（多租户）

**目标**：B2B 组织隔离；服务端以用户/组织上下文访问数据。

### 6.1 交付物

- Clerk 集成 Next.js；JWT 模板含 `org_id`。
- Supabase RLS：`projects`、`world_states`、`event_logs` 等按 `org_id` 隔离。
- 弃用或限制广域 `service_role` 在前端的任何暴露；服务端 Route 使用 **user JWT + Supabase** 或 **服务端仅 service role + 应用层校验 org**（二选一，需安全评审）。

### 6.2 验收标准

- 用户 A 无法读写用户 B 组织数据（自动化测试或手工清单）。

**预估体量**：5–12 个工作日（与安全策略强相关）。

---

## Phase 7：事件驱动世界 + NPC LOD（规模化）

**目标**：时间轴自行推进；大量 NPC 不全时全精度。

### 7.1 交付物

- 表：`future_events`（`execute_at`、`project_id`、`timeline`、`payload`、状态）。
- 调度：Trigger 或定时任务「消费队列 → 应用 delta → 写日志」。
- 文档化 **LOD 策略**（规则批处理 / 交汇升维），代码先实现**最小**远景批处理（如每日汇总资源）。

### 7.2 验收标准

- 可在无导演输入时推进「世界时间」并产生可追溯事件（可配置关闭）。

**预估体量**：迭代制，首版 2–4 周量级。

---

## 跨阶段非功能要求（全程遵守）

- **幂等**：同一 `project + timeline + tick` 重复提交不重复写冲突数据（或显式拒绝）。
- **密钥**：仅服务端；轮换流程写入运维说明。
- **评测**：Phase 1 起维护小型「黄金场景」JSON 或脚本，用于回归意图与结算合法性。

---

## 文档维护

- 完成每一阶段后，更新本文件对应阶段的**状态**（未开始 / 进行中 / 已完成）与**实际选型**（如最终模型名、表名）。
- 与 [ARCHITECTURE.md](./ARCHITECTURE.md) 冲突时，以**代码与迁移脚本**为准，并回写架构文档。

---

## 建议的第一个迭代（最小闭环）

仅实施 **Phase 1 全量 + Phase 2 中「导演解析」的极简 schema 占位**（可先不接裁判 LLM），即可在演示环境展示：

**自然语言导演输入 → 结构化意图 → 规则/混合结算 → Supabase 持久化 → SSE 展示**。

其余阶段按业务优先级并行评估（例如先 Phase 6 若强依赖多租户，或先 Phase 5 若强依赖长推演）。
