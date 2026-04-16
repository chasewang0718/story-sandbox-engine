/**
 * Phase 1: feature flag for LLM-generated actor intents.
 * When false or OPENAI_API_KEY is missing, rule-based intents are used (CI-safe).
 */
export function shouldUseLlmIntents(): boolean {
  if (process.env.USE_LLM_INTENTS !== "true") {
    return false;
  }
  if (!process.env.OPENAI_API_KEY?.trim()) {
    return false;
  }
  return true;
}

export function getIntentModelId(): string {
  return process.env.AI_MODEL_INTENT?.trim() || "gpt-4o-mini";
}
