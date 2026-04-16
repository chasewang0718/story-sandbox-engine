import { beforeEach, describe, expect, it } from "vitest";
import { GET, POST } from "./route";
import { resetEngineStoreForTests } from "@/lib/engine/store";

describe("/api/tick route", () => {
  beforeEach(() => {
    resetEngineStoreForTests();
  });

  it("returns initial world state and empty events on GET", async () => {
    const response = await GET(new Request("http://localhost:3001/api/tick"));
    expect(response.status).toBe(200);

    const payload = (await response.json()) as {
      worldState: { tick: number; weather: string };
      recentEvents: unknown[];
    };

    expect(payload.worldState.tick).toBe(0);
    expect(payload.worldState.weather).toBe("clear");
    expect(payload.recentEvents).toEqual([]);
  });

  it("executes one tick and returns structured result on POST", async () => {
    const request = new Request("http://localhost:3001/api/tick", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intervention: "天降大雨" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const payload = (await response.json()) as {
      worldState: { tick: number; weather: string };
      events: Array<{ type: string }>;
    };

    expect(payload.worldState.tick).toBe(1);
    expect(payload.worldState.weather).toBe("storm");
    expect(payload.events).toHaveLength(4);
    expect(payload.events[0]?.type).toBe("director_intervention");
    expect(payload.events[3]?.type).toBe("state_updated");
  });

  it("returns 400 for invalid POST payload", async () => {
    const request = new Request("http://localhost:3001/api/tick", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intervention: "" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);

    const payload = (await response.json()) as { error?: string; details?: unknown[] };
    expect(payload.error).toBe("Invalid request body");
    expect(Array.isArray(payload.details)).toBe(true);
  });
});
