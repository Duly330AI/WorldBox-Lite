import { create } from "zustand";
import type { UnitBehaviorSpec, WorldSpec } from "../engine/io/specLoader";
import type { StateBuffers } from "../engine/worker";

export type WorldState = {
  spec: WorldSpec | null;
  unitBehaviorSpec: UnitBehaviorSpec | null;
  terrain: Uint8Array | null;
  buffers: StateBuffers | null;
  paths: Array<{ entity_id: number; path: Array<[number, number]> }>;
  events: Array<Record<string, unknown>>;
  selectedEntityId: number | null;
  entityDebug: Record<number, { goal?: string; plan?: string[]; utilities?: Record<string, number> }>;
  error: string | null;
  setWorld: (
    spec: WorldSpec,
    terrain: Uint8Array,
    buffers: StateBuffers | null,
    unitBehaviorSpec: UnitBehaviorSpec | null
  ) => void;
  addEvents: (entries: Array<Record<string, unknown>>) => void;
  setPaths: (paths: Array<{ entity_id: number; path: Array<[number, number]> }>) => void;
  setSelectedEntityId: (id: number | null) => void;
  setEntityDebug: (
    data: Record<number, { goal?: string; plan?: string[]; utilities?: Record<string, number> }>
  ) => void;
  setError: (message: string) => void;
};

export const useWorldStore = create<WorldState>((set) => ({
  spec: null,
  unitBehaviorSpec: null,
  terrain: null,
  buffers: null,
  paths: [],
  events: [],
  selectedEntityId: null,
  entityDebug: {},
  error: null,
  setWorld: (spec, terrain, buffers, unitBehaviorSpec) =>
    set({ spec, terrain, buffers, unitBehaviorSpec, error: null }),
  addEvents: (entries) =>
    set((state) => {
      const merged = [...state.events, ...entries];
      return { events: merged.slice(-20) };
    }),
  setPaths: (paths) => set({ paths }),
  setSelectedEntityId: (id) => set({ selectedEntityId: id }),
  setEntityDebug: (data) => set({ entityDebug: data }),
  setError: (message) => set({ error: message })
}));
