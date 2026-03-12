import { create } from "zustand";
import type { LoggingSpec, SimulationSpec, UnitBehaviorSpec, WorldSpec } from "../engine/io/specLoader";
import type { StateBuffers } from "../engine/worker";

export type WorldState = {
  spec: WorldSpec | null;
  unitBehaviorSpec: UnitBehaviorSpec | null;
  loggingSpec: LoggingSpec | null;
  simulationSpec: SimulationSpec | null;
  terrain: Uint8Array | null;
  buffers: StateBuffers | null;
  paths: Array<{ entity_id: number; path: Array<[number, number]> }>;
  buildingOwners: Record<number, number>;
  events: Array<Record<string, unknown>>;
  selectedEntityId: number | null;
  entityDebug: Record<number, { goal?: string; plan?: string[]; utilities?: Record<string, number> }>;
  stats: { population: Record<number, number>; houses: Record<number, number>; wood: Record<number, number>; military: Record<number, number> } | null;
  perfStats: { avg_tick_ms: number; entity_count: number; pathfinding_calls_per_tick: number } | null;
  matchOver: { winnerFactionId: number; winnerName: string; tick: number; knowledge: Record<number, Record<string, number>> } | null;
  knowledge: Record<number, Record<string, number>>;
  godTool: { tool: "lava" | "forest" | "water" | "ignite" | null; brushSize: number };
  worker: Worker | null;
  error: string | null;
  setWorld: (
    spec: WorldSpec,
    terrain: Uint8Array,
    buffers: StateBuffers | null,
    unitBehaviorSpec: UnitBehaviorSpec | null,
    loggingSpec: LoggingSpec | null,
    simulationSpec: SimulationSpec | null
  ) => void;
  addEvents: (entries: Array<Record<string, unknown>>) => void;
  setPaths: (paths: Array<{ entity_id: number; path: Array<[number, number]> }>) => void;
  setBuildingOwners: (owners: Record<number, number>) => void;
  setSelectedEntityId: (id: number | null) => void;
  setEntityDebug: (
    data: Record<number, { goal?: string; plan?: string[]; utilities?: Record<string, number> }>
  ) => void;
  setStats: (stats: { population: Record<number, number>; houses: Record<number, number>; wood: Record<number, number>; military: Record<number, number> }) => void;
  setPerfStats: (perf: { avg_tick_ms: number; entity_count: number; pathfinding_calls_per_tick: number }) => void;
  setMatchOver: (data: { winnerFactionId: number; winnerName: string; tick: number; knowledge: Record<number, Record<string, number>> }) => void;
  setKnowledge: (data: Record<number, Record<string, number>>) => void;
  setGodTool: (tool: "lava" | "forest" | "water" | "ignite" | null) => void;
  setBrushSize: (size: number) => void;
  setWorker: (worker: Worker | null) => void;
  setError: (message: string) => void;
};

export const useWorldStore = create<WorldState>((set) => ({
  spec: null,
  unitBehaviorSpec: null,
  loggingSpec: null,
  simulationSpec: null,
  terrain: null,
  buffers: null,
  paths: [],
  buildingOwners: {},
  events: [],
  selectedEntityId: null,
  entityDebug: {},
  stats: null,
  perfStats: null,
  matchOver: null,
  knowledge: {},
  godTool: { tool: null, brushSize: 1 },
  worker: null,
  error: null,
  setWorld: (spec, terrain, buffers, unitBehaviorSpec, loggingSpec, simulationSpec) =>
    set({ spec, terrain, buffers, unitBehaviorSpec, loggingSpec, simulationSpec, error: null }),
  addEvents: (entries) =>
    set((state) => {
      const merged = [...state.events, ...entries];
      const limit = state.loggingSpec?.config.ui_log_limit ?? 50;
      return { events: merged.slice(-limit) };
    }),
  setPaths: (paths) => set({ paths }),
  setBuildingOwners: (owners) => set({ buildingOwners: owners }),
  setSelectedEntityId: (id) => set({ selectedEntityId: id }),
  setEntityDebug: (data) => set({ entityDebug: data }),
  setStats: (stats) => set({ stats }),
  setPerfStats: (perf) => set({ perfStats: perf }),
  setMatchOver: (data) => set({ matchOver: data }),
  setKnowledge: (data) => set({ knowledge: data }),
  setGodTool: (tool) => set((state) => ({ godTool: { ...state.godTool, tool } })),
  setBrushSize: (size) => set((state) => ({ godTool: { ...state.godTool, brushSize: size } })),
  setWorker: (worker) => set({ worker }),
  setError: (message) => set({ error: message })
}));
