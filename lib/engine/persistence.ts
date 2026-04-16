import {
  BranchTimelineInput,
  EventLog,
  WorldState,
  branchTimelineInputSchema,
  eventLogSchema,
  worldStateSchema,
} from "./schema";
import { createInitialState } from "./store";
import { getSupabaseAdminClient, isSupabaseConfigured } from "@/lib/supabase/client";

type PersistedWorldStateRow = {
  world_state: unknown;
};

type PersistedEventRow = {
  tick: number;
  timeline_label: string;
  event_type: EventLog["type"];
  summary: string;
  payload: Record<string, unknown>;
  timestamp: string;
};

export function shouldUseSupabasePersistence(): boolean {
  return isSupabaseConfigured();
}

export async function loadLatestWorldStateFromDb(timelineLabel: string): Promise<WorldState | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("world_states")
    .select("world_state")
    .eq("timeline_label", timelineLabel)
    .order("tick", { ascending: false })
    .limit(1)
    .maybeSingle<PersistedWorldStateRow>();

  if (error) {
    throw new Error(`Failed to load latest world state: ${error.message}`);
  }

  if (!data?.world_state) {
    return null;
  }

  return worldStateSchema.parse(data.world_state);
}

export async function loadRecentEventsFromDb(timelineLabel: string, limit = 20): Promise<EventLog[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("event_logs")
    .select("tick,timeline_label,event_type,summary,payload,timestamp")
    .eq("timeline_label", timelineLabel)
    .order("id", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load recent events: ${error.message}`);
  }

  const rows = (data ?? []) as PersistedEventRow[];
  return rows
    .reverse()
    .map((row) =>
      eventLogSchema.parse({
        tick: row.tick,
        timelineLabel: row.timeline_label,
        type: row.event_type,
        summary: row.summary,
        payload: row.payload,
        timestamp: row.timestamp,
      }),
    );
}

export async function persistTickToDb(worldState: WorldState, events: EventLog[]): Promise<void> {
  const supabase = getSupabaseAdminClient();

  const { error: stateError } = await supabase.from("world_states").insert({
    tick: worldState.tick,
    timeline_label: worldState.timelineLabel,
    world_state: worldState,
  });

  if (stateError) {
    throw new Error(`Failed to persist world state: ${stateError.message}`);
  }

  if (events.length === 0) {
    return;
  }

  const eventRows = events.map((event) => ({
    tick: event.tick,
    timeline_label: event.timelineLabel,
    event_type: event.type,
    summary: event.summary,
    payload: event.payload,
    timestamp: event.timestamp,
  }));

  const { error: eventError } = await supabase.from("event_logs").insert(eventRows);
  if (eventError) {
    throw new Error(`Failed to persist event logs: ${eventError.message}`);
  }
}

export async function branchTimeline(
  input: BranchTimelineInput,
): Promise<{ worldState: WorldState; newTimelineLabel: string }> {
  const parsed = branchTimelineInputSchema.parse(input);
  const supabase = getSupabaseAdminClient();

  const newTimelineLabel =
    parsed.newTimelineLabel ??
    `branch-${parsed.fromTimeline}-t${parsed.atTick}-${crypto.randomUUID().slice(0, 8)}`;

  const { data: row, error: loadError } = await supabase
    .from("world_states")
    .select("world_state")
    .eq("timeline_label", parsed.fromTimeline)
    .eq("tick", parsed.atTick)
    .maybeSingle<PersistedWorldStateRow>();

  if (loadError) {
    throw new Error(`Failed to load snapshot for branch: ${loadError.message}`);
  }

  let forked: WorldState;
  if (row?.world_state) {
    const base = worldStateSchema.parse(row.world_state);
    forked = { ...base, timelineLabel: newTimelineLabel };
  } else if (parsed.atTick === 0) {
    forked = { ...createInitialState(parsed.fromTimeline), timelineLabel: newTimelineLabel };
  } else {
    throw new Error(
      `No snapshot for timeline "${parsed.fromTimeline}" at tick ${parsed.atTick}. Run a tick first or branch from tick 0.`,
    );
  }

  const { error: stateError } = await supabase.from("world_states").insert({
    tick: forked.tick,
    timeline_label: newTimelineLabel,
    world_state: forked,
  });

  if (stateError) {
    throw new Error(`Failed to persist branched world state: ${stateError.message}`);
  }

  const { data: eventsToCopy, error: eventsError } = await supabase
    .from("event_logs")
    .select("tick,event_type,summary,payload,timestamp")
    .eq("timeline_label", parsed.fromTimeline)
    .lte("tick", parsed.atTick);

  if (eventsError) {
    throw new Error(`Failed to load events to copy: ${eventsError.message}`);
  }

  const rows = eventsToCopy ?? [];
  if (rows.length > 0) {
    const inserts = rows.map((eventRow) => ({
      tick: eventRow.tick,
      timeline_label: newTimelineLabel,
      event_type: eventRow.event_type,
      summary: eventRow.summary,
      payload: eventRow.payload,
      timestamp: eventRow.timestamp,
    }));

    const { error: insertEventsError } = await supabase.from("event_logs").insert(inserts);
    if (insertEventsError) {
      throw new Error(`Failed to copy event logs: ${insertEventsError.message}`);
    }
  }

  return { worldState: forked, newTimelineLabel };
}
