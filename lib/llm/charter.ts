/**
 * Minimal world charter injected into intent prompts until Phase 3 (Genesis DB).
 * Replace or load from project settings later.
 */
export const DEFAULT_CHARTER_SUMMARY = [
  "世界观：高魔仙侠，战力与境界、资源与位置以世界状态为准；角色仅依据自己可见信息决策。",
  "行动类型仅限：observe | move | attack | defend | negotiate | use_item。",
  "输出必须符合给定 JSON schema；rationale 用简短中文说明动机。",
].join("\n");
