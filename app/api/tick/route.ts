import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { directorInputSchema } from "@/lib/engine/schema";
import { runTick } from "@/lib/engine/runTick";
import { createInitialState, getHistory, getState, setState } from "@/lib/engine/store";
import {
  loadLatestWorldStateFromDb,
  loadRecentEventsFromDb,
  persistTickToDb,
  shouldUseSupabasePersistence,
} from "@/lib/engine/persistence";

function resolveTimeline(request: Request, bodyTimeline?: string): string {
  const fromQuery = new URL(request.url).searchParams.get("timeline");
  return bodyTimeline ?? fromQuery ?? "mainline";
}

export async function GET(request: Request) {
  const timeline = new URL(request.url).searchParams.get("timeline") ?? "mainline";

  if (shouldUseSupabasePersistence()) {
    const [latestState, recentEvents] = await Promise.all([
      loadLatestWorldStateFromDb(timeline),
      loadRecentEventsFromDb(timeline, 20),
    ]);

    if (latestState) {
      setState(latestState);
    } else {
      setState(createInitialState(timeline));
    }

    return NextResponse.json({
      worldState: latestState ?? getState(),
      recentEvents,
      timeline,
    });
  }

  if (getState().timelineLabel !== timeline) {
    setState(createInitialState(timeline));
  }

  return NextResponse.json({
    worldState: getState(),
    recentEvents: getHistory().filter((event) => event.timelineLabel === timeline).slice(-20),
    timeline,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = directorInputSchema.parse(body);
    const timeline = resolveTimeline(request, input.timelineLabel);

    if (shouldUseSupabasePersistence()) {
      const latest = await loadLatestWorldStateFromDb(timeline);
      if (latest) {
        setState(latest);
      } else {
        setState(createInitialState(timeline));
      }
    } else if (getState().timelineLabel !== timeline) {
      setState(createInitialState(timeline));
    }

    const result = runTick({ intervention: input.intervention });

    if (shouldUseSupabasePersistence()) {
      await persistTickToDb(result.worldState, result.events);
    }

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Invalid request body",
          details: error.issues,
        },
        { status: 400 },
      );
    }

    const message = error instanceof Error ? error.message : "Tick execution failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
