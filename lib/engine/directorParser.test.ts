import { describe, expect, it } from "vitest";
import { parseDirectorIntervention } from "./directorParser";

describe("parseDirectorIntervention", () => {
  it("extracts weather, assassin and high intensity tags", () => {
    const parsed = parseDirectorIntervention("天降暴雨，神秘刺客伏击主角，局势剧烈恶化");
    expect(parsed.tags).toContain("weather_shift");
    expect(parsed.tags).toContain("assassin");
    expect(parsed.tags).toContain("ambush");
    expect(parsed.intensity).toBe("high");
    expect(parsed.targetActorIds).toContain("hero");
  });

  it("returns empty tags on neutral intervention", () => {
    const parsed = parseDirectorIntervention("夜色平静，双方暂时对峙");
    expect(parsed.tags).toEqual([]);
    expect(parsed.intensity).toBe("medium");
  });
});
