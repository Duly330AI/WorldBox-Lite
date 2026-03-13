import type { WorldSpec } from "../io/specLoader";
import type { StateBuffers } from "../worker";

export type SpawnResult =
  | { success: true; entityIndex: number }
  | { success: false; reason: "no_walkable_tile" | "no_free_slots" };

export function spawnUnit(
  buffers: StateBuffers,
  worldSpec: WorldSpec,
  homeByFaction: Map<number, { x: number; y: number }>,
  baseHealth: number,
  unitType: number,
  factionId: number,
  x?: number,
  y?: number,
  rng: () => number = Math.random
): SpawnResult {
  const { width, height } = worldSpec.config.dimensions;
  const ids = buffers.entities.id as Uint32Array;
  const types = buffers.entities.type as Uint8Array;
  const factions = buffers.entities.faction_id as Uint8Array;
  const xs = buffers.entities.x as Uint16Array;
  const ys = buffers.entities.y as Uint16Array;
  const wood = buffers.entities.inventory_wood as Uint8Array;
  const food = buffers.entities.inventory_food as Uint8Array;
  const hunger = buffers.entities.hunger as Uint8Array;
  const health = buffers.entities.health as Uint8Array;
  const actionId = buffers.entities.current_action_id as Uint8Array;
  const progress = buffers.entities.action_progress as Uint8Array;
  const planLock = buffers.entities.plan_lock_ticks as Uint8Array;
  const animation = buffers.entities.animation_frame as Uint8Array | undefined;
  const targetX = buffers.entities.target_x as Uint16Array | undefined;
  const targetY = buffers.entities.target_y as Uint16Array | undefined;

  const tryPlaceAt = (tx: number, ty: number) => {
    if (tx < 0 || ty < 0 || tx >= width || ty >= height) return false;
    const idx = ty * width + tx;
    const terrainId = buffers.terrain[idx];
    const walkable = Object.values(worldSpec.terrain_types).some(
      (t) => t.id === terrainId && t.walkable
    );
    if (!walkable) return false;
    return true;
  };

  for (let i = 0; i < ids.length; i += 1) {
    if (ids[i] !== 0) continue;
    let px = x ?? Math.floor(rng() * width);
    let py = y ?? Math.floor(rng() * height);
    if (!tryPlaceAt(px, py)) {
      let placed = false;
      for (let attempts = 0; attempts < 500; attempts += 1) {
        px = Math.floor(rng() * width);
        py = Math.floor(rng() * height);
        if (tryPlaceAt(px, py)) {
          placed = true;
          break;
        }
      }
      if (!placed) return { success: false, reason: "no_walkable_tile" };
    }
    ids[i] = i + 1;
    types[i] = unitType;
    factions[i] = factionId;
    if (!homeByFaction.has(factionId)) {
      homeByFaction.set(factionId, { x: px, y: py });
    }
    xs[i] = px;
    ys[i] = py;
    wood[i] = 0;
    food[i] = 0;
    hunger[i] = 0;
    health[i] = baseHealth;
    actionId[i] = 0;
    progress[i] = 0;
    planLock[i] = 0;
    if (targetX) targetX[i] = 0xffff;
    if (targetY) targetY[i] = 0xffff;
    if (animation) animation[i] = 0;
    return { success: true, entityIndex: i };
  }

  return { success: false, reason: "no_free_slots" };
}
