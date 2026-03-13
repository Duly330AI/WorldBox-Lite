import { describe, expect, it } from "vitest";
import { StateView } from "../src/engine/state/StateView";
import { stepFire, stepLavaHeat, stepTreeGrowth } from "../src/engine/systems/nature";
import type { StateSpec, WorldSpec } from "../src/engine/io/specLoader";
import type { StateBuffers } from "../src/engine/worker";

function makeTestSpecs(width: number, height: number): { world: WorldSpec; state: StateSpec } {
  const world: WorldSpec = {
    spec_id: "test_world",
    version: "0",
    schema_version: "1.0.0",
    config: { dimensions: { width, height }, tile_size: 1, chunk_size: 1 },
    terrain_types: {
      grass: { id: 0, walkable: true, cost: 1, yield: { food: 0, prod: 0, comm: 0 } },
      sand: { id: 2, walkable: true, cost: 1, yield: { food: 0, prod: 0, comm: 0 } },
      lava: { id: 8, walkable: false, cost: 99, yield: { food: 0, prod: 0, comm: 0 } }
    },
    features: {
      forest: { id: 100 },
      fire: { id: 110 }
    }
  };
  const state: StateSpec = {
    spec_id: "test_state",
    version: "0",
    memory_layout: {
      terrain_buffer: { type: "Uint8Array", bytes_per_tile: 1 },
      feature_buffer: { type: "Uint8Array", bytes_per_tile: 1 },
      building_buffer: { type: "Uint16Array", bytes_per_tile: 2 },
      building_storage_buffer: { type: "Uint16Array", bytes_per_tile: 2 },
      height_buffer: { type: "Int8Array", bytes_per_tile: 1 },
      explored_buffer: { type: "Uint8Array", bytes_per_tile: 1 },
      ownership_buffer: { type: "Uint8Array", bytes_per_tile: 1 }
    },
    entity_state: {
      max_entities: 1,
      properties_per_entity: {
        id: "uint32",
        type: "uint8",
        faction_id: "uint8",
        x: "uint16",
        y: "uint16",
        health: "uint8",
        energy: "uint8",
        hunger: "uint8",
        inventory_wood: "uint8",
        inventory_food: "uint8",
        target_x: "uint16",
        target_y: "uint16",
        current_action_id: "uint8",
        action_progress: "uint8",
        plan_lock_ticks: "uint8",
        animation_frame: "uint8",
        city_size: "uint8",
        city_growth_points: "uint16",
        city_food_stockpile: "uint16"
      }
    }
  };
  return { world, state };
}

function makeBuffers(width: number, height: number): StateBuffers {
  return {
    terrain: new Uint8Array(width * height),
    feature: new Uint8Array(width * height),
    building: new Uint16Array(width * height),
    building_storage: new Uint16Array(width * height),
    height: new Int8Array(width * height),
    explored: new Uint8Array(width * height),
    ownership: new Uint8Array(width * height),
    entities: {
      id: new Uint32Array(1),
      type: new Uint8Array(1),
      faction_id: new Uint8Array(1),
      x: new Uint16Array(1),
      y: new Uint16Array(1),
      health: new Uint8Array(1),
      energy: new Uint8Array(1),
      hunger: new Uint8Array(1),
      inventory_wood: new Uint8Array(1),
      inventory_food: new Uint8Array(1),
      target_x: new Uint16Array(1),
      target_y: new Uint16Array(1),
      current_action_id: new Uint8Array(1),
      action_progress: new Uint8Array(1),
      plan_lock_ticks: new Uint8Array(1),
      animation_frame: new Uint8Array(1),
      city_size: new Uint8Array(1),
      city_growth_points: new Uint16Array(1),
      city_food_stockpile: new Uint16Array(1)
    }
  };
}

describe("Nature simulation", () => {
  it("spreads fire to adjacent forest and burns out", () => {
    const { world, state } = makeTestSpecs(3, 3);
    const buffers = makeBuffers(3, 3);
    const view = new StateView(buffers, world, state);
    const center = view.tileIndex(1, 1);
    const north = view.tileIndex(1, 0);
    view.setFeature(center, 110);
    view.setFeature(north, 100);
    stepFire(view, { rng: () => 1 });

    expect(view.getFeature(center)).toBe(0);
    expect(view.getTerrain(center)).toBe(2);
    expect(view.getFeature(north)).toBe(110);
    expect(view.getTerrain(north)).toBe(2);
  });

  it("lava heats adjacent grass into sand", () => {
    const { world, state } = makeTestSpecs(3, 3);
    const buffers = makeBuffers(3, 3);
    const view = new StateView(buffers, world, state);
    const center = view.tileIndex(1, 1);
    const east = view.tileIndex(2, 1);
    view.setTerrain(center, 8);
    view.setTerrain(east, 0);
    stepLavaHeat(view);
    expect(view.getTerrain(east)).toBe(2);
  });

  it("tree growth can seed forests", () => {
    const { world, state } = makeTestSpecs(2, 2);
    const buffers = makeBuffers(2, 2);
    const view = new StateView(buffers, world, state);
    let called = false;
    const rng = () => {
      if (!called) {
        called = true;
        return 0;
      }
      return 1;
    };
    stepTreeGrowth(view, { rng });
    let trees = 0;
    for (let i = 0; i < 4; i += 1) {
      if (view.getFeature(i) === 100) trees += 1;
    }
    expect(trees).toBe(1);
  });
});
