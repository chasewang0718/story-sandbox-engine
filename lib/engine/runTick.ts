import {
  ActorIntent,
  DirectorInput,
  EventLog,
  directorInputSchema,
  eventLogSchema,
} from "./schema";
import { getState, pushEvent, setState } from "./store";
import { generateActorIntent } from "@/lib/llm/intents";
import { parseDirectorIntervention } from "./directorParser";

type TickResult = {
  worldState: ReturnType<typeof getState>;
  intents: ActorIntent[];
  conflictSummary: string;
  events: EventLog[];
};

function nowIso(): string {
  return new Date().toISOString();
}

function createEvent(
  timelineLabel: string,
  event: Omit<EventLog, "timestamp" | "timelineLabel">,
): EventLog {
  return eventLogSchema.parse({ ...event, timelineLabel, timestamp: nowIso() });
}

function resolveConflict(heroIntent: ActorIntent, villainIntent: ActorIntent): {
  heroHpDelta: number;
  villainHpDelta: number;
  summary: string;
} {
  const heroAttack = heroIntent.action === "attack";
  const villainAttack = villainIntent.action === "attack";
  const heroDefend = heroIntent.action === "defend";
  const villainDefend = villainIntent.action === "defend";

  if (heroAttack && villainAttack) {
    return { heroHpDelta: -10, villainHpDelta: -12, summary: "双方同时进攻，均受到反击伤害。" };
  }

  if (heroAttack && villainDefend) {
    return { heroHpDelta: 0, villainHpDelta: -4, summary: "反派防守成功，主角仅造成轻微伤害。" };
  }

  if (villainAttack && heroDefend) {
    return { heroHpDelta: -4, villainHpDelta: 0, summary: "主角格挡了大部分伤害，战线僵持。" };
  }

  if (heroAttack) {
    return { heroHpDelta: 0, villainHpDelta: -15, summary: "主角抓住破绽，压制反派。" };
  }

  if (villainAttack) {
    return { heroHpDelta: -15, villainHpDelta: 0, summary: "反派抢得先机，主角受创。" };
  }

  return { heroHpDelta: 0, villainHpDelta: 0, summary: "双方都在试探与调整，没有直接交战。" };
}

export async function runTick(input: DirectorInput): Promise<TickResult> {
  const parsedInput = directorInputSchema.parse(input);
  const current = getState();
  const nextTick = current.tick + 1;
  const hero = current.actors[0];
  const villain = current.actors[1];
  const parsedEffects = parseDirectorIntervention(parsedInput.intervention);

  const directorEvent = createEvent(current.timelineLabel, {
    tick: nextTick,
    type: "director_intervention",
    summary: `导演干预：${parsedInput.intervention}`,
    payload: {
      intervention: parsedInput.intervention,
      parsedEffects,
    },
  });

  const [heroIntent, villainIntent] = await Promise.all([
    generateActorIntent(hero, villain, parsedInput.intervention),
    generateActorIntent(villain, hero, parsedInput.intervention),
  ]);

  const intentEvent = createEvent(current.timelineLabel, {
    tick: nextTick,
    type: "intent_generated",
    summary: "主角与反派生成行动意图。",
    payload: { intents: [heroIntent, villainIntent] },
  });

  const resolution = resolveConflict(heroIntent, villainIntent);
  const conflictEvent = createEvent(current.timelineLabel, {
    tick: nextTick,
    type: "conflict_resolved",
    summary: resolution.summary,
    payload: resolution,
  });

  const updatedActors = current.actors.map((actor) => {
    if (actor.id === hero.id) {
      return {
        ...actor,
        hp: Math.max(0, actor.hp + resolution.heroHpDelta),
        energy: Math.max(0, actor.energy - 10),
        location: heroIntent.targetLocation ?? actor.location,
      };
    }

    if (actor.id === villain.id) {
      return {
        ...actor,
        hp: Math.max(0, actor.hp + resolution.villainHpDelta),
        energy: Math.max(0, actor.energy - 10),
        location: villainIntent.targetLocation ?? actor.location,
      };
    }

    return actor;
  });

  const nextState = {
    ...current,
    tick: nextTick,
    weather: parsedEffects.tags.includes("weather_shift") ? "storm" : current.weather,
    actors: updatedActors,
  };

  setState(nextState);

  const stateEvent = createEvent(current.timelineLabel, {
    tick: nextTick,
    type: "state_updated",
    summary: `Tick ${nextTick} 结算完成，状态已更新。`,
    payload: { worldState: nextState },
  });

  const events = [directorEvent, intentEvent, conflictEvent, stateEvent];
  for (const event of events) {
    pushEvent(event);
  }

  return {
    worldState: nextState,
    intents: [heroIntent, villainIntent],
    conflictSummary: resolution.summary,
    events,
  };
}
