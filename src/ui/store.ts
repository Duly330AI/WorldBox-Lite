import { create } from "zustand";
import type { AssetSpec, LoggingSpec, SimulationSpec, TechSpec, UnitBehaviorSpec, WorldSpec } from "../engine/io/specLoader";
import type { StateBuffers } from "../engine/worker";

export type WorldState = {
  spec: WorldSpec | null;
  unitBehaviorSpec: UnitBehaviorSpec | null;
  loggingSpec: LoggingSpec | null;
  simulationSpec: SimulationSpec | null;
  techSpec: TechSpec | null;
  assetSpec: AssetSpec | null;
  tilesetImages: Record<string, HTMLImageElement>;
  minimapBuffer: Uint8ClampedArray | null;
  cameraTarget: { x: number; y: number } | null;
  terrain: Uint8Array | null;
  buffers: StateBuffers | null;
  paths: Array<{ entity_id: number; path: Array<[number, number]> }>;
  buildingOwners: Record<number, number>;
  attackLines: Array<{ from: [number, number]; to: [number, number] }>;
  events: Array<Record<string, unknown>>;
  selectedEntityId: number | null;
  entityDebug: Record<number, { goal?: string; plan?: string[]; utilities?: Record<string, number> }>;
  stats: { population: Record<number, number>; houses: Record<number, number>; wood: Record<number, number>; military: Record<number, number> } | null;
  perfStats: { avg_tick_ms: number; entity_count: number; pathfinding_calls_per_tick: number } | null;
  matchOver: {
    winnerFactionId: number;
    winnerName: string;
    tick: number;
    knowledge: Record<number, Record<string, number>>;
    summary?: { most_built_unit: string; collected_wood: number; researched_techs: string[] };
  } | null;
  knowledge: Record<number, Record<string, number>>;
  research: Record<number, { current: string | null; progress: number; cost: number; known: string[] }>;
  chronicles: Record<number, { battle_win_loss_ratio: number }>;
  godTool: { tool: "lava" | "forest" | "water" | "ignite" | null; brushSize: number };
  worker: Worker | null;
  tick: number;
  tickIntervalMs: number;
  error: string | null;
  setWorld: (
    spec: WorldSpec,
    terrain: Uint8Array,
    buffers: StateBuffers | null,
    unitBehaviorSpec: UnitBehaviorSpec | null,
    loggingSpec: LoggingSpec | null,
    simulationSpec: SimulationSpec | null,
    techSpec: TechSpec | null,
    assetSpec: AssetSpec | null
  ) => void;
  addEvents: (entries: Array<Record<string, unknown>>) => void;
  setPaths: (paths: Array<{ entity_id: number; path: Array<[number, number]> }>) => void;
  setBuildingOwners: (owners: Record<number, number>) => void;
  setAttackLines: (lines: Array<{ from: [number, number]; to: [number, number] }>) => void;
  setSelectedEntityId: (id: number | null) => void;
  setEntityDebug: (
    data: Record<number, { goal?: string; plan?: string[]; utilities?: Record<string, number> }>
  ) => void;
  setStats: (stats: { population: Record<number, number>; houses: Record<number, number>; wood: Record<number, number>; military: Record<number, number> }) => void;
  setPerfStats: (perf: { avg_tick_ms: number; entity_count: number; pathfinding_calls_per_tick: number }) => void;
  setMatchOver: (data: {
    winnerFactionId: number;
    winnerName: string;
    tick: number;
    knowledge: Record<number, Record<string, number>>;
    summary?: { most_built_unit: string; collected_wood: number; researched_techs: string[] };
  }) => void;
  setKnowledge: (data: Record<number, Record<string, number>>) => void;
  setResearch: (data: Record<number, { current: string | null; progress: number; cost: number; known: string[] }>) => void;
  setChronicles: (data: Record<number, { battle_win_loss_ratio: number }>) => void;
  setTilesetImages: (images: Record<string, HTMLImageElement>) => void;
  setAssetSpec: (spec: AssetSpec | null) => void;
  setTick: (tick: number) => void;
  setTickIntervalMs: (ms: number) => void;
  setMinimapBuffer: (buf: Uint8ClampedArray | null) => void;
  setCameraTarget: (target: { x: number; y: number } | null) => void;
  setCameraTarget: (target: { x: number; y: number } | null) => void;
  setMinimapBuffer: (buf: Uint8ClampedArray | null) => void;
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
  techSpec: null,
  assetSpec: null,
  tilesetImages: {},
  minimapBuffer: null,
  cameraTarget: null,
  terrain: null,
  buffers: null,
  paths: [],
  buildingOwners: {},
  attackLines: [],
  events: [],
  selectedEntityId: null,
  entityDebug: {},
  stats: null,
  perfStats: null,
  matchOver: null,
  knowledge: {},
  research: {},
  chronicles: {},
  godTool: { tool: null, brushSize: 1 },
  worker: null,
  tick: 0,
  tickIntervalMs: 500,
  error: null,
  setWorld: (spec, terrain, buffers, unitBehaviorSpec, loggingSpec, simulationSpec, techSpec, assetSpec) =>
    set({ spec, terrain, buffers, unitBehaviorSpec, loggingSpec, simulationSpec, techSpec, assetSpec, error: null }),
  addEvents: (entries) =>
    set((state) => {
      const merged = [...state.events, ...entries];
      const limit = state.loggingSpec?.config.ui_log_limit ?? 50;
      return { events: merged.slice(-limit) };
    }),
  setPaths: (paths) => set({ paths }),
  setBuildingOwners: (owners) => set({ buildingOwners: owners }),
  setAttackLines: (lines) => set({ attackLines: lines }),
  setSelectedEntityId: (id) => set({ selectedEntityId: id }),
  setEntityDebug: (data) => set({ entityDebug: data }),
  setStats: (stats) => set({ stats }),
  setPerfStats: (perf) => set({ perfStats: perf }),
  setMatchOver: (data) => set({ matchOver: data }),
  setKnowledge: (data) => set({ knowledge: data }),
  setResearch: (data) => set({ research: data }),
  setChronicles: (data) => set({ chronicles: data }),
  setTilesetImages: (images: Record<string, HTMLImageElement>) => set({ tilesetImages: images }),
  setAssetSpec: (spec) => set({ assetSpec: spec }),
  setTick: (tick) => set({ tick }),
  setTickIntervalMs: (ms) => set({ tickIntervalMs: ms }),
  setMinimapBuffer: (buf) => set({ minimapBuffer: buf }),
  setCameraTarget: (target) => set({ cameraTarget: target }),
  setGodTool: (tool) => set((state) => ({ godTool: { ...state.godTool, tool } })),
  setBrushSize: (size) => set((state) => ({ godTool: { ...state.godTool, brushSize: size } })),
  setWorker: (worker) => set({ worker }),
  setError: (message) => set({ error: message })
}));
