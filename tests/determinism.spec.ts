import { describe, expect, it } from "vitest";
import worldSpec from "../specs/world_spec.json";
import { buildTerrain } from "../src/engine/systems/terrain";

describe("Determinism", () => {
  it("terrain generation is deterministic for same seed", () => {
    const a = buildTerrain(worldSpec, 1337);
    const b = buildTerrain(worldSpec, 1337);
    expect(a).toEqual(b);
  });
});
