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

/**
 * Retry count after first failed LLM call.
 * 0 => no retry, 1 => one additional attempt.
 */
export function getIntentRetryCount(): number {
  const raw = process.env.AI_INTENT_RETRY_COUNT?.trim();
  if (!raw) {
    return 1;
  }

  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    return 1;
  }
  return parsed;
}
