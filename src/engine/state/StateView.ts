import type { StateSpec } from "../io/specLoader";
import type { WorldSpec } from "../io/specLoader";
import type { StateBuffers } from "../worker";

export class StateView {
  private buffers: StateBuffers;
  private worldSpec: WorldSpec;
  private stateSpec: StateSpec;
  private entityMap: Record<string, Uint8Array | Uint16Array | Uint32Array>;
  private maxEntities: number;

  constructor(buffers: StateBuffers, worldSpec: WorldSpec, stateSpec: StateSpec) {
    this.buffers = buffers;
    this.worldSpec = worldSpec;
    this.stateSpec = stateSpec;
    this.entityMap = buffers.entities as Record<string, Uint8Array | Uint16Array | Uint32Array>;
    this.maxEntities = stateSpec.entity_state.max_entities;
  }

  get width() {
    return this.worldSpec.config.dimensions.width;
  }

  get height() {
    return this.worldSpec.config.dimensions.height;
  }

  get entityCount() {
    return this.maxEntities;
  }

  tileIndex(x: number, y: number) {
    return y * this.width + x;
  }

  getTerrain(idx: number) {
    return this.buffers.terrain[idx];
  }

  setTerrain(idx: number, value: number) {
    this.buffers.terrain[idx] = value;
  }

  getFeature(idx: number) {
    return this.buffers.feature[idx];
  }

  setFeature(idx: number, value: number) {
    this.buffers.feature[idx] = value;
  }

  getBuilding(idx: number) {
    return this.buffers.building[idx];
  }

  setBuilding(idx: number, value: number) {
    this.buffers.building[idx] = value;
  }

  getBuildingStorage(idx: number) {
    return this.buffers.building_storage[idx];
  }

  setBuildingStorage(idx: number, value: number) {
    this.buffers.building_storage[idx] = value;
  }

  getExplored(idx: number) {
    return this.buffers.explored[idx];
  }

  setExplored(idx: number, value: number) {
    this.buffers.explored[idx] = value;
  }

  setExploredBit(idx: number, factionId: number) {
    const mask = 1 << factionId;
    this.buffers.explored[idx] = this.buffers.explored[idx] | mask;
  }

  getEntityField<T extends number>(index: number, field: string): T {
    const arr = this.entityMap[field];
    if (!arr) return 0 as T;
    return (arr as Uint8Array | Uint16Array | Uint32Array)[index] as T;
  }

  setEntityField(index: number, field: string, value: number) {
    const arr = this.entityMap[field];
    if (!arr) return;
    (arr as Uint8Array | Uint16Array | Uint32Array)[index] = value;
  }

  isWalkable(x: number, y: number) {
    const idx = this.tileIndex(x, y);
    const terrainId = this.getTerrain(idx);
    for (const def of Object.values(this.worldSpec.terrain_types)) {
      if (def.id === terrainId) return def.walkable;
    }
    return true;
  }

  // Convenience accessors
  getEntityId(index: number) {
    return this.getEntityField<number>(index, "id");
  }
  setEntityId(index: number, value: number) {
    this.setEntityField(index, "id", value);
  }
  getEntityType(index: number) {
    return this.getEntityField<number>(index, "type");
  }
  setEntityType(index: number, value: number) {
    this.setEntityField(index, "type", value);
  }
  getEntityFaction(index: number) {
    return this.getEntityField<number>(index, "faction_id");
  }
  setEntityFaction(index: number, value: number) {
    this.setEntityField(index, "faction_id", value);
  }
  getEntityX(index: number) {
    return this.getEntityField<number>(index, "x");
  }
  setEntityX(index: number, value: number) {
    this.setEntityField(index, "x", value);
  }
  getEntityY(index: number) {
    return this.getEntityField<number>(index, "y");
  }
  setEntityY(index: number, value: number) {
    this.setEntityField(index, "y", value);
  }
  getEntityHealth(index: number) {
    return this.getEntityField<number>(index, "health");
  }
  setEntityHealth(index: number, value: number) {
    this.setEntityField(index, "health", value);
  }
  getEntityHunger(index: number) {
    return this.getEntityField<number>(index, "hunger");
  }
  setEntityHunger(index: number, value: number) {
    this.setEntityField(index, "hunger", value);
  }
  getEntityWood(index: number) {
    return this.getEntityField<number>(index, "inventory_wood");
  }
  setEntityWood(index: number, value: number) {
    this.setEntityField(index, "inventory_wood", value);
  }
  getEntityFood(index: number) {
    return this.getEntityField<number>(index, "inventory_food");
  }
  setEntityFood(index: number, value: number) {
    this.setEntityField(index, "inventory_food", value);
  }
  getEntityActionId(index: number) {
    return this.getEntityField<number>(index, "current_action_id");
  }
  setEntityActionId(index: number, value: number) {
    this.setEntityField(index, "current_action_id", value);
  }
  getEntityActionProgress(index: number) {
    return this.getEntityField<number>(index, "action_progress");
  }
  setEntityActionProgress(index: number, value: number) {
    this.setEntityField(index, "action_progress", value);
  }
  getEntityPlanLock(index: number) {
    return this.getEntityField<number>(index, "plan_lock_ticks");
  }
  setEntityPlanLock(index: number, value: number) {
    this.setEntityField(index, "plan_lock_ticks", value);
  }
  getEntityAnimationFrame(index: number) {
    return this.getEntityField<number>(index, "animation_frame");
  }
  setEntityAnimationFrame(index: number, value: number) {
    this.setEntityField(index, "animation_frame", value);
  }
  getEntityTargetX(index: number) {
    return this.getEntityField<number>(index, "target_x");
  }
  setEntityTargetX(index: number, value: number) {
    this.setEntityField(index, "target_x", value);
  }
  getEntityTargetY(index: number) {
    return this.getEntityField<number>(index, "target_y");
  }
  setEntityTargetY(index: number, value: number) {
    this.setEntityField(index, "target_y", value);
  }
}
