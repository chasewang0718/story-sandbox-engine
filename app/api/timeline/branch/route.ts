import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { branchTimelineInputSchema } from "@/lib/engine/schema";
import { branchTimeline, shouldUseSupabasePersistence } from "@/lib/engine/persistence";
import { setState } from "@/lib/engine/store";

export async function POST(request: Request) {
  if (!shouldUseSupabasePersistence()) {
    return NextResponse.json(
      { error: "Timeline branching requires Supabase (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)." },
      { status: 501 },
    );
  }

  try {
    const body = await request.json();
    const input = branchTimelineInputSchema.parse(body);
    const result = await branchTimeline(input);
    setState(result.worldState);

    return NextResponse.json({
      worldState: result.worldState,
      newTimelineLabel: result.newTimelineLabel,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid request body", details: error.issues },
        { status: 400 },
      );
    }

    const message = error instanceof Error ? error.message : "Branch failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
