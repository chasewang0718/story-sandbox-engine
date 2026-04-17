"use client";

import { useEffect, useMemo, useState } from "react";
import { directorEffectsSchema } from "@/lib/engine/schema";
import type { DirectorEffects, EventLog, WorldState } from "@/lib/engine/schema";

type BootPayload = {
  worldState: WorldState;
  recentEvents: EventLog[];
  timeline?: string;
};

const fallbackState: WorldState = {
  tick: 0,
  weather: "clear",
  scene: "abandoned watchtower",
  timelineLabel: "mainline",
  actors: [],
};

function parseDirectorEffectsFromEvent(event: EventLog): DirectorEffects | null {
  if (event.type !== "director_intervention") {
    return null;
  }

  const payloadRecord = event.payload as Record<string, unknown>;
  const candidate = payloadRecord.parsedEffects;
  const parsed = directorEffectsSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

const directorTagLabels: Record<string, string> = {
  weather_shift: "天气突变",
  hazard: "环境危害",
  assassin: "刺客介入",
  ambush: "伏击",
  morale_shock: "士气冲击",
  reinforcement: "援军",
  ritual: "仪式/法阵",
};

const intensityColors: Record<DirectorEffects["intensity"], string> = {
  low: "#22c55e",
  medium: "#f59e0b",
  high: "#ef4444",
};

export default function Home() {
  const [timeline, setTimeline] = useState("mainline");
  const [intervention, setIntervention] = useState("天降大雨");
  const [branchAtTick, setBranchAtTick] = useState(0);
  const [branchName, setBranchName] = useState("");
  const [state, setState] = useState<WorldState>(fallbackState);
  const [events, setEvents] = useState<EventLog[]>([]);
  const [running, setRunning] = useState(false);
  const [branching, setBranching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let eventSource: EventSource | null = null;

    void fetch(`/api/tick?timeline=${encodeURIComponent(timeline)}`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Failed to bootstrap engine state.");
        }
        const data = (await response.json()) as BootPayload;
        setState(data.worldState);
        setEvents(data.recentEvents);
      })
      .catch((reason) => {
        setError(reason instanceof Error ? reason.message : "Unknown bootstrap error.");
      });

    eventSource = new EventSource(`/api/stream?timeline=${encodeURIComponent(timeline)}`);
    eventSource.addEventListener("tick", (evt) => {
      const parsedEvent = JSON.parse((evt as MessageEvent).data) as EventLog;
      setEvents((previous) => [...previous.slice(-39), parsedEvent]);
      if (parsedEvent.type === "state_updated") {
        const nextState = parsedEvent.payload.worldState as WorldState | undefined;
        if (nextState) {
          setState(nextState);
        }
      }
    });

    eventSource.onerror = () => {
      setError("SSE disconnected.切换时间线或刷新页面可重连。");
      eventSource?.close();
    };

    return () => {
      eventSource?.close();
    };
  }, [timeline]);

  async function runTickAction() {
    if (!intervention.trim()) {
      setError("请输入本回合导演干预变量。");
      return;
    }

    setRunning(true);
    setError(null);
    try {
      const response = await fetch(`/api/tick?timeline=${encodeURIComponent(timeline)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intervention, timelineLabel: timeline }),
      });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Tick failed");
      }
      const payload = (await response.json()) as { worldState: WorldState };
      setState(payload.worldState);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unknown tick error.");
    } finally {
      setRunning(false);
    }
  }

  async function createBranchTimeline() {
    setBranching(true);
    setError(null);
    try {
      const response = await fetch("/api/timeline/branch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromTimeline: timeline,
          atTick: branchAtTick,
          newTimelineLabel: branchName.trim() || undefined,
        }),
      });
      const payload = (await response.json()) as { error?: string; newTimelineLabel?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Branch failed");
      }
      if (payload.newTimelineLabel) {
        setTimeline(payload.newTimelineLabel);
        setEvents([]);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unknown branch error.");
    } finally {
      setBranching(false);
    }
  }

  const aliveActors = useMemo(() => state.actors.filter((actor) => actor.hp > 0).length, [state.actors]);

  return (
    <main style={{ padding: "24px", display: "grid", gap: "16px", maxWidth: "980px", width: "100%", margin: "0 auto" }}>
      <h1>剧情推演沙盒引擎（MVP）</h1>
      <p>导演输入变量后，系统按 Tick 执行：意图生成、冲突结算、状态更新，并通过 SSE 实时回传日志。支持按时间线分支与回滚重演（需 Supabase）。</p>

      <section style={{ border: "1px solid #3f3f46", borderRadius: "8px", padding: "12px", display: "grid", gap: "8px" }}>
        <label htmlFor="timeline">当前时间线 ID</label>
        <input
          id="timeline"
          value={timeline}
          onChange={(event) => setTimeline(event.target.value.trim() || "mainline")}
          placeholder="mainline"
          style={{ padding: "8px", borderRadius: "8px", maxWidth: "420px" }}
        />
        <p style={{ fontSize: "13px", opacity: 0.85 }}>切换 ID 会加载该分支的最新快照（若数据库中不存在则从 tick 0 初始态开始）。</p>
      </section>

      <section style={{ border: "1px solid #3f3f46", borderRadius: "8px", padding: "12px", display: "grid", gap: "8px" }}>
        <label htmlFor="intervention">导演变量</label>
        <textarea
          id="intervention"
          rows={3}
          value={intervention}
          onChange={(event) => setIntervention(event.target.value)}
          placeholder="例：天降大雨，神秘刺客出现在塔顶"
          style={{ padding: "8px", borderRadius: "8px" }}
        />
        <button type="button" onClick={runTickAction} disabled={running} style={{ width: "160px", height: "36px" }}>
          {running ? "推演中..." : "运行 Tick"}
        </button>
        {error ? <p style={{ color: "#ef4444" }}>{error}</p> : null}
      </section>

      <section style={{ border: "1px solid #3f3f46", borderRadius: "8px", padding: "12px", display: "grid", gap: "8px" }}>
        <h2 style={{ fontSize: "16px" }}>从某一 Tick 分叉（新时间线）</h2>
        <p style={{ fontSize: "13px", opacity: 0.85 }}>
          在 Supabase 已配置且存在对应快照时，从指定 tick 复制世界状态与事件到新时间线。未持久化 tick 时可从 tick 0 分叉。
        </p>
        <label htmlFor="branchAtTick">源 Tick</label>
        <input
          id="branchAtTick"
          type="number"
          min={0}
          value={branchAtTick}
          onChange={(event) => setBranchAtTick(Number.parseInt(event.target.value, 10) || 0)}
          style={{ padding: "8px", borderRadius: "8px", maxWidth: "120px" }}
        />
        <label htmlFor="branchName">新时间线名称（可空，自动生成）</label>
        <input
          id="branchName"
          value={branchName}
          onChange={(event) => setBranchName(event.target.value)}
          placeholder="例如：mainline-rain-alt"
          style={{ padding: "8px", borderRadius: "8px", maxWidth: "420px" }}
        />
        <button type="button" onClick={createBranchTimeline} disabled={branching} style={{ width: "200px", height: "36px" }}>
          {branching ? "创建中..." : "创建分支"}
        </button>
      </section>

      <section style={{ border: "1px solid #3f3f46", borderRadius: "8px", padding: "12px", display: "grid", gap: "6px" }}>
        <h2>世界状态</h2>
        <p>
          Timeline: {state.timelineLabel} | Tick: {state.tick} | Scene: {state.scene} | Weather: {state.weather} | Alive
          Actors: {aliveActors}
        </p>
        <pre style={{ overflowX: "auto", background: "#111827", padding: "10px", borderRadius: "8px" }}>
          {JSON.stringify(state, null, 2)}
        </pre>
      </section>

      <section style={{ border: "1px solid #3f3f46", borderRadius: "8px", padding: "12px", display: "grid", gap: "6px" }}>
        <h2>实时事件流（最近 40 条）</h2>
        <div style={{ display: "grid", gap: "6px", maxHeight: "360px", overflowY: "auto" }}>
          {events.length === 0 ? <p>暂无事件</p> : null}
          {events.map((event, index) => {
            const parsedEffects = parseDirectorEffectsFromEvent(event);
            return (
              <article key={`${event.timestamp}-${index}`} style={{ padding: "8px", borderRadius: "8px", border: "1px solid #3f3f46" }}>
                <p>
                  <strong>
                    [{event.timelineLabel}] [Tick {event.tick}]
                  </strong>{" "}
                  {event.type}
                </p>
                <p>{event.summary}</p>
                {parsedEffects ? (
                  <div style={{ marginTop: "6px", padding: "8px", background: "#0f172a", borderRadius: "6px", fontSize: "12px", display: "grid", gap: "6px" }}>
                    <p>
                      <strong>结构化解析</strong> | 强度:
                      <span style={{ marginLeft: "6px", color: intensityColors[parsedEffects.intensity] }}>{parsedEffects.intensity}</span>
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      {parsedEffects.tags.length === 0 ? (
                        <span style={{ opacity: 0.8 }}>无标签</span>
                      ) : (
                        parsedEffects.tags.map((tag) => (
                          <span key={tag} style={{ background: "#1f2937", border: "1px solid #374151", borderRadius: "999px", padding: "2px 8px" }}>
                            {directorTagLabels[tag] ?? tag}
                          </span>
                        ))
                      )}
                    </div>
                    <p>目标角色: {parsedEffects.targetActorIds.length > 0 ? parsedEffects.targetActorIds.join(", ") : "未指定"}</p>
                    <p style={{ opacity: 0.85 }}>原始输入: {parsedEffects.notes}</p>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
