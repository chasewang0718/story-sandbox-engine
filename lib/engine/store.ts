import { EventLog, WorldState, worldStateSchema } from "./schema";

type EventListener = (event: EventLog) => void;

type EngineStore = {
  state: WorldState;
  history: EventLog[];
  listeners: Set<EventListener>;
};

export function createInitialState(timelineLabel = "mainline"): WorldState {
  return worldStateSchema.parse({
    tick: 0,
    weather: "clear",
    scene: "abandoned watchtower",
    timelineLabel,
    actors: [
      {
        id: "hero",
        name: "Protagonist",
        hp: 100,
        energy: 100,
        location: "watchtower_gate",
        inventory: ["dagger", "flare"],
        hostility: 40,
        psychology: {
          traits: { cautious: 72, empathy: 66, aggression: 45 },
          goals: ["survive_the_night", "rescue_captive"],
          motives: { justice: 74, loyalty: 68, ambition: 33 },
          arc: {
            stage: "doubt",
            triggerProgress: 0,
            triggerThreshold: 3,
          },
        },
      },
      {
        id: "villain",
        name: "Antagonist",
        hp: 120,
        energy: 90,
        location: "inner_courtyard",
        inventory: ["longbow", "smoke_bomb"],
        hostility: 70,
        psychology: {
          traits: { strategic: 79, cruelty: 61, patience: 69 },
          goals: ["complete_ritual", "neutralize_hero"],
          motives: { control: 81, revenge: 58, survival: 47 },
          arc: {
            stage: "dominance",
            triggerProgress: 0,
            triggerThreshold: 4,
          },
        },
      },
    ],
  });
}

declare global {
  var __storyEngineStore: EngineStore | undefined;
}

const store: EngineStore =
  globalThis.__storyEngineStore ??
  (globalThis.__storyEngineStore = {
    state: createInitialState(),
    history: [],
    listeners: new Set<EventListener>(),
  });

export function getState(): WorldState {
  return store.state;
}

export function setState(next: WorldState): void {
  store.state = worldStateSchema.parse(next);
}

export function getHistory(): EventLog[] {
  return store.history;
}

export function pushEvent(event: EventLog): void {
  store.history.push(event);
  for (const listener of store.listeners) {
    listener(event);
  }
}

export function subscribe(listener: EventListener): () => void {
  store.listeners.add(listener);
  return () => {
    store.listeners.delete(listener);
  };
}

export function resetEngineStoreForTests(): void {
  store.state = createInitialState();
  store.history = [];
  store.listeners.clear();
}
