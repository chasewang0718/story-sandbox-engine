import { DirectorEffects, directorEffectsSchema } from "./schema";

function containsAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

/**
 * Phase 2 minimal parser: converts director free text into structured effects.
 * This rule-based parser is deliberately simple and deterministic. It can be
 * replaced by LLM parsing in a later phase without changing runTick contracts.
 */
export function parseDirectorIntervention(intervention: string): DirectorEffects {
  const lowered = intervention.toLowerCase();
  const tags: DirectorEffects["tags"] = [];
  const targetActorIds: string[] = [];

  if (containsAny(lowered, ["雨", "storm", "rain", "雷", "snow", "雾", "fog"])) {
    tags.push("weather_shift");
  }
  if (containsAny(lowered, ["崩", "陷阱", "hazard", "lava", "毒雾", "塌方"])) {
    tags.push("hazard");
  }
  if (containsAny(lowered, ["刺客", "assassin", "暗杀"])) {
    tags.push("assassin");
  }
  if (containsAny(lowered, ["伏击", "ambush", "埋伏"])) {
    tags.push("ambush");
  }
  if (containsAny(lowered, ["恐慌", "士气", "morale", "谣言"])) {
    tags.push("morale_shock");
  }
  if (containsAny(lowered, ["援军", "reinforcement", "增援"])) {
    tags.push("reinforcement");
  }
  if (containsAny(lowered, ["仪式", "ritual", "献祭", "法阵"])) {
    tags.push("ritual");
  }

  if (containsAny(lowered, ["主角", "hero", "沈照"])) {
    targetActorIds.push("hero");
  }
  if (containsAny(lowered, ["反派", "villain", "殷墟"])) {
    targetActorIds.push("villain");
  }

  let intensity: DirectorEffects["intensity"] = "medium";
  if (containsAny(lowered, ["轻微", "mild", "小幅", "稍微"])) {
    intensity = "low";
  }
  if (containsAny(lowered, ["剧烈", "massive", "灾变", "强烈", "high"])) {
    intensity = "high";
  }

  return directorEffectsSchema.parse({
    tags: [...new Set(tags)],
    intensity,
    targetActorIds: [...new Set(targetActorIds)],
    notes: intervention.trim(),
  });
}
