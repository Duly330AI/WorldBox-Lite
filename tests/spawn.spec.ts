import { describe, expect, it } from "vitest";
import worldSpec from "../specs/world_spec.json";
import stateSpec from "../specs/state_spec.json";
import type { StateBuffers } from "../src/engine/worker";
import { spawnUnit } from "../src/engine/systems/spawn";

function makeBuffers(): StateBuffers {
  const { width, height } = worldSpec.config.dimensions;
  const tileCount = width * height;
  const terrain = new Uint8Array(tileCount);
  const feature = new Uint8Array(tileCount);
  const building = new Uint16Array(tileCount);
  const heightBuf = new Int8Array(tileCount);

  const entities: Record<string, Uint8Array | Uint16Array | Uint32Array> = {};
  for (const [key, type] of Object.entries(stateSpec.entity_state.properties_per_entity)) {
    if (type === "uint8") entities[key] = new Uint8Array(stateSpec.entity_state.max_entities);
    else if (type === "uint16") entities[key] = new Uint16Array(stateSpec.entity_state.max_entities);
    else entities[key] = new Uint32Array(stateSpec.entity_state.max_entities);
  }

  return { terrain, feature, building, height: heightBuf, entities };
}

describe("spawnUnit", () => {
  it("spawns a worker on a walkable tile", () => {
    const buffers = makeBuffers();
    buffers.terrain.fill(0); // grass
    const home = new Map<number, { x: number; y: number }>();
    const result = spawnUnit(buffers, worldSpec, home, 201, 0, 1, 1);
    expect(result.success).toBe(true);
    if (result.success) {
      const ids = buffers.entities.id as Uint32Array;
      expect(ids[result.entityIndex]).toBeGreaterThan(0);
    }
  });

  it("fails when no free slots", () => {
    const buffers = makeBuffers();
    buffers.terrain.fill(0);
    const ids = buffers.entities.id as Uint32Array;
    ids.fill(1);
    const home = new Map<number, { x: number; y: number }>();
    const result = spawnUnit(buffers, worldSpec, home, 201, 0, 1, 1);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.reason).toBe("no_free_slots");
  });

  it("fails when no walkable tile exists", () => {
    const buffers = makeBuffers();
    buffers.terrain.fill(5); // water
    const home = new Map<number, { x: number; y: number }>();
    const result = spawnUnit(buffers, worldSpec, home, 201, 0);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.reason).toBe("no_walkable_tile");
  });
});
