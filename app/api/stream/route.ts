import { EventLog } from "@/lib/engine/schema";
import { getHistory, subscribe } from "@/lib/engine/store";

const encoder = new TextEncoder();

function encodeEvent(event: EventLog): Uint8Array {
  return encoder.encode(`event: tick\ndata: ${JSON.stringify(event)}\n\n`);
}

export async function GET(request: Request) {
  const timeline = new URL(request.url).searchParams.get("timeline") ?? "mainline";

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(": connected\n\n"));

      const backlog = getHistory().filter((event) => event.timelineLabel === timeline).slice(-20);
      for (const event of backlog) {
        controller.enqueue(encodeEvent(event));
      }

      const unsubscribe = subscribe((event) => {
        if (event.timelineLabel === timeline) {
          controller.enqueue(encodeEvent(event));
        }
      });

      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(": keep-alive\n\n"));
      }, 15000);

      return () => {
        clearInterval(heartbeat);
        unsubscribe();
      };
    },
    cancel() {
      // noop
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
