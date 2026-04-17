import { describe, expect, it, beforeEach } from "vitest";
import { runTick } from "./runTick";
import { getHistory, resetEngineStoreForTests } from "./store";

describe("runTick", () => {
  beforeEach(() => {
    resetEngineStoreForTests();
  });

  it("increments tick and updates weather/location when intervention is heavy rain", async () => {
    const result = await runTick({ intervention: "天降大雨" });

    expect(result.worldState.tick).toBe(1);
    expect(result.worldState.weather).toBe("storm");

    const hero = result.worldState.actors.find((actor) => actor.id === "hero");
    const villain = result.worldState.actors.find((actor) => actor.id === "villain");

    expect(hero?.location).toBe("covered_corridor");
    expect(villain?.location).toBe("archer_tower");

    expect(result.events).toHaveLength(4);
    expect(result.events.map((event) => event.type)).toEqual([
      "director_intervention",
      "intent_generated",
      "conflict_resolved",
      "state_updated",
    ]);
    const intentPayload = result.events[1]?.payload as {
      consistencyAssessments?: Array<{ actorId: string; score: number }>;
    };
    expect(intentPayload.consistencyAssessments).toBeDefined();
    expect(intentPayload.consistencyAssessments).toHaveLength(2);
    expect(intentPayload.consistencyAssessments?.every((item) => item.score >= 0 && item.score <= 100)).toBe(true);

    expect(getHistory()).toHaveLength(4);
  });

  it("throws when intervention is empty", async () => {
    await expect(runTick({ intervention: "" })).rejects.toThrow();
  });

  it("keeps state progression consistent across multiple ticks", async () => {
    const first = await runTick({ intervention: "双方开始试探" });
    const second = await runTick({ intervention: "神秘刺客出现" });
    const third = await runTick({ intervention: "天降大雨" });

    expect(first.worldState.tick).toBe(1);
    expect(second.worldState.tick).toBe(2);
    expect(third.worldState.tick).toBe(3);

    const hero = third.worldState.actors.find((actor) => actor.id === "hero");
    const villain = third.worldState.actors.find((actor) => actor.id === "villain");

    expect(hero).toBeDefined();
    expect(villain).toBeDefined();

    // Each tick consumes 10 energy in the current MVP.
    expect(hero?.energy).toBe(70);
    expect(villain?.energy).toBe(60);

    // With two non-rain rounds, both sides should have taken some damage.
    expect(hero?.hp).toBeLessThan(100);
    expect(villain?.hp).toBeLessThan(120);

    // 3 ticks * 4 events per tick.
    expect(getHistory()).toHaveLength(12);
  });
});
