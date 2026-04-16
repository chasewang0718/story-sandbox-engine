import { beforeEach, describe, expect, it } from "vitest";
import { GET } from "./route";
import { resetEngineStoreForTests } from "@/lib/engine/store";
import { runTick } from "@/lib/engine/runTick";

async function readAvailableChunks(response: Response, maxReads = 6): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Response body reader is unavailable.");
  }

  const chunks: string[] = [];
  for (let i = 0; i < maxReads; i += 1) {
    const result = await Promise.race([
      reader.read(),
      new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), 120);
      }),
    ]);

    if (!result) {
      break;
    }

    if (result.done || !result.value) {
      break;
    }

    chunks.push(new TextDecoder().decode(result.value));
  }

  await reader.cancel();
  return chunks.join("");
}

describe("/api/stream route", () => {
  beforeEach(() => {
    resetEngineStoreForTests();
  });

  it("returns SSE headers", async () => {
    const response = await GET(new Request("http://localhost:3001/api/stream"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    expect(response.headers.get("Cache-Control")).toBe("no-cache, no-transform");
    expect(response.headers.get("Connection")).toBe("keep-alive");
  });

  it("streams connected frame and backlog tick events", async () => {
    await runTick({ intervention: "天降大雨" });
    const response = await GET(new Request("http://localhost:3001/api/stream"));
    const streamData = await readAvailableChunks(response);

    expect(streamData).toContain(": connected");
    expect(streamData).toContain("event: tick");
    expect(streamData).toContain("director_intervention");
  });
});
