import type { StateSpec } from "../io/specLoader";
import type { WorldSpec } from "../io/specLoader";
import type { StateBuffers } from "../worker";

export class StateView {
  private buffers: StateBuffers;
  private worldSpec: WorldSpec;
  private stateSpec: StateSpec;
  private entityMap: Record<string, Uint8Array | Uint16Array | Uint32Array>;

  constructor(buffers: StateBuffers, worldSpec: WorldSpec, stateSpec: StateSpec) {
    this.buffers = buffers;
    this.worldSpec = worldSpec;
    this.stateSpec = stateSpec;
    this.entityMap = buffers.entities as Record<string, Uint8Array | Uint16Array | Uint32Array>;
  }

  get width() {
    return this.worldSpec.config.dimensions.width;
  }

  get height() {
    return this.worldSpec.config.dimensions.height;
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
}
