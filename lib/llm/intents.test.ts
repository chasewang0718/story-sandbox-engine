import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { generateActorIntent } from "./intents";
import { createInitialState } from "@/lib/engine/store";

describe("generateActorIntent", () => {
  const prevUse = process.env.USE_LLM_INTENTS;
  const prevKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    delete process.env.USE_LLM_INTENTS;
    delete process.env.OPENAI_API_KEY;
  });

  afterEach(() => {
    if (prevUse === undefined) delete process.env.USE_LLM_INTENTS;
    else process.env.USE_LLM_INTENTS = prevUse;
    if (prevKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = prevKey;
  });

  it("uses rule-based intents when LLM is disabled", async () => {
    const state = createInitialState("mainline");
    const hero = state.actors[0];
    const villain = state.actors[1];
    const intent = await generateActorIntent(hero, villain, "天降大雨");
    expect(intent.action).toBe("move");
    expect(intent.actorId).toBe("hero");
  });
});
