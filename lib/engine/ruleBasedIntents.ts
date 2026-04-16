import { Actor, ActorIntent, actorIntentSchema } from "./schema";

/**
 * Deterministic intent generation (Phase 0). Used when LLM is disabled or as fallback.
 */
export function generateIntentRuleBased(actor: Actor, target: Actor, intervention: string): ActorIntent {
  const text = intervention.toLowerCase();
  if (text.includes("大雨") || text.includes("rain")) {
    return actorIntentSchema.parse({
      actorId: actor.id,
      action: "move",
      targetLocation: actor.id === "hero" ? "covered_corridor" : "archer_tower",
      rationale: `${actor.name} seeks a covered position due to heavy rain.`,
    });
  }

  if (text.includes("刺客") || text.includes("assassin")) {
    return actorIntentSchema.parse({
      actorId: actor.id,
      action: "observe",
      rationale: `${actor.name} scans for hidden threats before committing.`,
    });
  }

  if (actor.energy < 35) {
    return actorIntentSchema.parse({
      actorId: actor.id,
      action: "defend",
      rationale: `${actor.name} conserves energy and reduces risk.`,
    });
  }

  return actorIntentSchema.parse({
    actorId: actor.id,
    action: "attack",
    targetActorId: target.id,
    rationale: `${actor.name} presses advantage against ${target.name}.`,
  });
}
