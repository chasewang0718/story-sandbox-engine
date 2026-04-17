import { z } from "zod";

export const characterPsychologySchema = z.object({
  traits: z.record(z.string(), z.number().min(0).max(100)).default({}),
  goals: z.array(z.string().min(1)).default([]),
  motives: z.record(z.string(), z.number().min(0).max(100)).default({}),
  arc: z.object({
    stage: z.string().min(1),
    triggerProgress: z.number().int().min(0),
    triggerThreshold: z.number().int().min(1),
  }),
});

export const actorSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  hp: z.number().int().min(0),
  energy: z.number().int().min(0),
  location: z.string().min(1),
  inventory: z.array(z.string()),
  hostility: z.number().int().min(0).max(100),
  psychology: characterPsychologySchema,
});

export const worldStateSchema = z.object({
  tick: z.number().int().min(0),
  weather: z.string().min(1),
  scene: z.string().min(1),
  actors: z.array(actorSchema).min(2),
  timelineLabel: z.string().min(1),
});

export const directorInputSchema = z.object({
  intervention: z.string().min(1),
  timelineLabel: z.string().min(1).optional(),
});

export const directorEffectTagSchema = z.enum([
  "weather_shift",
  "hazard",
  "assassin",
  "ambush",
  "morale_shock",
  "reinforcement",
  "ritual",
]);

export const directorEffectsSchema = z.object({
  tags: z.array(directorEffectTagSchema).default([]),
  intensity: z.enum(["low", "medium", "high"]).default("medium"),
  targetActorIds: z.array(z.string().min(1)).default([]),
  notes: z.string().default(""),
});

export const branchTimelineInputSchema = z.object({
  fromTimeline: z.string().min(1),
  atTick: z.number().int().min(0),
  newTimelineLabel: z.string().min(1).optional(),
});

export const actorIntentSchema = z.object({
  actorId: z.string().min(1),
  action: z.enum(["observe", "move", "attack", "defend", "negotiate", "use_item"]),
  targetActorId: z.string().optional(),
  targetLocation: z.string().optional(),
  itemName: z.string().optional(),
  rationale: z.string().min(1),
});

export const eventLogSchema = z.object({
  tick: z.number().int().min(1),
  timelineLabel: z.string().min(1).default("mainline"),
  type: z.enum(["director_intervention", "intent_generated", "conflict_resolved", "state_updated"]),
  summary: z.string().min(1),
  payload: z.record(z.string(), z.unknown()).default({}),
  timestamp: z.string().datetime(),
});

export type Actor = z.infer<typeof actorSchema>;
export type WorldState = z.infer<typeof worldStateSchema>;
export type DirectorInput = z.infer<typeof directorInputSchema>;
export type ActorIntent = z.infer<typeof actorIntentSchema>;
export type EventLog = z.infer<typeof eventLogSchema>;
export type BranchTimelineInput = z.infer<typeof branchTimelineInputSchema>;
export type CharacterPsychology = z.infer<typeof characterPsychologySchema>;
export type DirectorEffects = z.infer<typeof directorEffectsSchema>;
