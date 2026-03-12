import { create } from "zustand";
import type { LoggingSpec, UnitBehaviorSpec, WorldSpec } from "../engine/io/specLoader";
import type { StateBuffers } from "../engine/worker";

export type WorldState = {
  spec: WorldSpec | null;
  unitBehaviorSpec: UnitBehaviorSpec | null;
  loggingSpec: LoggingSpec | null;
  terrain: Uint8Array | null;
  buffers: StateBuffers | null;
  paths: Array<{ entity_id: number; path: Array<[number, number]> }>;
  events: Array<Record<string, unknown>>;
  selectedEntityId: number | null;
  entityDebug: Record<number, { goal?: string; plan?: string[]; utilities?: Record<string, number> }>;
  stats: { population: Record<number, number>; houses: Record<number, number>; wood: Record<number, number> } | null;
  error: string | null;
  setWorld: (
    spec: WorldSpec,
    terrain: Uint8Array,
    buffers: StateBuffers | null,
    unitBehaviorSpec: UnitBehaviorSpec | null,
    loggingSpec: LoggingSpec | null
  ) => void;
  addEvents: (entries: Array<Record<string, unknown>>) => void;
  setPaths: (paths: Array<{ entity_id: number; path: Array<[number, number]> }>) => void;
  setSelectedEntityId: (id: number | null) => void;
  setEntityDebug: (
    data: Record<number, { goal?: string; plan?: string[]; utilities?: Record<string, number> }>
  ) => void;
  setStats: (stats: { population: Record<number, number>; houses: Record<number, number>; wood: Record<number, number> }) => void;
  setError: (message: string) => void;
};

export const useWorldStore = create<WorldState>((set) => ({
  spec: null,
  unitBehaviorSpec: null,
  loggingSpec: null,
  terrain: null,
  buffers: null,
  paths: [],
  events: [],
  selectedEntityId: null,
  entityDebug: {},
  stats: null,
  error: null,
  setWorld: (spec, terrain, buffers, unitBehaviorSpec, loggingSpec) =>
    set({ spec, terrain, buffers, unitBehaviorSpec, loggingSpec, error: null }),
  addEvents: (entries) =>
    set((state) => {
      const merged = [...state.events, ...entries];
      const limit = state.loggingSpec?.config.ui_log_limit ?? 50;
      return { events: merged.slice(-limit) };
    }),
  setPaths: (paths) => set({ paths }),
  setSelectedEntityId: (id) => set({ selectedEntityId: id }),
  setEntityDebug: (data) => set({ entityDebug: data }),
  setStats: (stats) => set({ stats }),
  setError: (message) => set({ error: message })
}));
