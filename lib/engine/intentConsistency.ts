import { Actor, ActorIntent } from "./schema";

export type IntentConsistencyAssessment = {
  actorId: string;
  score: number;
  reasons: string[];
};

function clampScore(score: number): number {
  if (score < 0) return 0;
  if (score > 100) return 100;
  return score;
}

/**
 * Phase 2 minimal consistency evaluator:
 * estimates whether intent aligns with actor personality signals.
 */
export function evaluateIntentConsistency(actor: Actor, intent: ActorIntent): IntentConsistencyAssessment {
  let score = 70;
  const reasons: string[] = [];
  const aggression = actor.psychology.traits.aggression ?? 50;
  const cautious = actor.psychology.traits.cautious ?? 50;
  const empathy = actor.psychology.traits.empathy ?? 50;
  const control = actor.psychology.motives.control ?? 50;
  const justice = actor.psychology.motives.justice ?? 50;

  if (intent.action === "attack") {
    score += Math.floor((aggression - cautious) / 8);
    if (aggression > cautious) {
      reasons.push("高攻击倾向支持主动进攻。");
    } else {
      reasons.push("谨慎高于攻击倾向，进攻决策偏激进。");
    }
    if (justice > 65) {
      score += 4;
      reasons.push("较高正义动机支持直接压制威胁。");
    }
  }

  if (intent.action === "defend") {
    score += Math.floor((cautious - aggression) / 8);
    reasons.push("防守动作与谨慎特质相关。");
  }

  if (intent.action === "negotiate") {
    score += Math.floor((empathy - aggression) / 8);
    reasons.push("协商动作受同理心与低攻击倾向支持。");
  }

  if (intent.action === "observe") {
    score += Math.floor(cautious / 20);
    reasons.push("观察动作符合风险控制策略。");
  }

  if (intent.action === "move" && actor.energy < 30) {
    score -= 6;
    reasons.push("低能量下频繁位移会放大风险。");
  }

  if (intent.action === "attack" && actor.energy < 20) {
    score -= 10;
    reasons.push("低能量强攻与生存目标冲突。");
  }

  if (control > 70 && intent.action === "observe") {
    score -= 5;
    reasons.push("高控制动机下单纯观察偏保守。");
  }

  if (reasons.length === 0) {
    reasons.push("行为与当前性格/动机未发现明显冲突。");
  }

  return {
    actorId: actor.id,
    score: clampScore(score),
    reasons,
  };
}
