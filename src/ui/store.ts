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
  error: string | null;
  setWorld: (
    spec: WorldSpec,
    terrain: Uint8Array,
    buffers: StateBuffers | null,
    unitBehaviorSpec: UnitBehaviorSpec | null
  ) => void;
  addEvents: (entries: Array<Record<string, unknown>>) => void;
  setPaths: (paths: Array<{ entity_id: number; path: Array<[number, number]> }>) => void;
  setError: (message: string) => void;
};

export const useWorldStore = create<WorldState>((set) => ({
  spec: null,
  unitBehaviorSpec: null,
  terrain: null,
  buffers: null,
  paths: [],
  events: [],
  error: null,
  setWorld: (spec, terrain, buffers, unitBehaviorSpec) =>
    set({ spec, terrain, buffers, unitBehaviorSpec, error: null }),
  addEvents: (entries) =>
    set((state) => {
      const merged = [...state.events, ...entries];
      return { events: merged.slice(-20) };
    }),
  setPaths: (paths) => set({ paths }),
  setError: (message) => set({ error: message })
}));
