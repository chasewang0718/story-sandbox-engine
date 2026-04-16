import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { Actor, ActorIntent, actorIntentSchema } from "@/lib/engine/schema";
import { generateIntentRuleBased } from "@/lib/engine/ruleBasedIntents";
import { DEFAULT_CHARTER_SUMMARY } from "./charter";
import { getIntentModelId, shouldUseLlmIntents } from "./config";

function visibleSelf(actor: Actor): Record<string, unknown> {
  return {
    id: actor.id,
    name: actor.name,
    hp: actor.hp,
    energy: actor.energy,
    location: actor.location,
    inventory: actor.inventory,
    hostility: actor.hostility,
  };
}

function visibleOpponent(target: Actor): Record<string, unknown> {
  return {
    id: target.id,
    name: target.name,
    location: target.location,
    hostility: target.hostility,
  };
}

/**
 * Calls OpenAI with structured output. Enforces actorId matches the acting character.
 */
export async function generateActorIntentWithLlm(
  actor: Actor,
  target: Actor,
  intervention: string,
  charterSummary: string = DEFAULT_CHARTER_SUMMARY,
): Promise<ActorIntent> {
  const model = openai(getIntentModelId());

  const prompt = [
    charterSummary,
    "",
    `你是角色「${actor.name}」，id 必须为：${actor.id}`,
    `你自己的状态：${JSON.stringify(visibleSelf(actor))}`,
    `你掌握的对手公开信息：${JSON.stringify(visibleOpponent(target))}`,
    "",
    `导演本回合干预（自然语言）：${intervention}`,
    "",
    "根据以上信息，选择本回合行动（action 必须在允许枚举内）。",
    `若使用 move，可填 targetLocation；若 attack，应填 targetActorId 为「${target.id}」；若 use_item 填 itemName。`,
  ].join("\n");

  const { object } = await generateObject({
    model,
    schema: actorIntentSchema,
    prompt,
  });

  return actorIntentSchema.parse({
    ...object,
    actorId: actor.id,
  });
}

/**
 * Phase 1 entry: LLM when enabled and configured, otherwise rule-based.
 * On LLM failure, falls back to rules so a tick never corrupts state.
 */
export async function generateActorIntent(
  actor: Actor,
  target: Actor,
  intervention: string,
  charterSummary: string = DEFAULT_CHARTER_SUMMARY,
): Promise<ActorIntent> {
  if (!shouldUseLlmIntents()) {
    return generateIntentRuleBased(actor, target, intervention);
  }

  try {
    return await generateActorIntentWithLlm(actor, target, intervention, charterSummary);
  } catch (error) {
    console.error("[story-sandbox-engine] LLM intent failed, using rules:", error);
    return generateIntentRuleBased(actor, target, intervention);
  }
}
