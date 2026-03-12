import { describe, expect, it } from "vitest";
import worldSpec from "../specs/world_spec.json";

function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function buildTerrain(seed: number) {
  const { width, height } = worldSpec.config.dimensions;
  const terrain = new Uint8Array(width * height);
  const rng = lcg(seed);
  const entries = Object.values(worldSpec.terrain_types);
  for (let i = 0; i < terrain.length; i += 1) {
    const idx = Math.floor(rng() * entries.length);
    terrain[i] = entries[idx].id;
  }
  return terrain;
}

describe("Determinism", () => {
  it("terrain generation is deterministic for same seed", () => {
    const a = buildTerrain(1337);
    const b = buildTerrain(1337);
    expect(a).toEqual(b);
  });
});
