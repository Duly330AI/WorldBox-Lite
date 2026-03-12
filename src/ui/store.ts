import { create } from "zustand";
import type { WorldSpec } from "../engine/io/specLoader";

export type WorldState = {
  spec: WorldSpec | null;
  terrain: Uint8Array | null;
  error: string | null;
  setWorld: (spec: WorldSpec, terrain: Uint8Array) => void;
  setError: (message: string) => void;
};

export const useWorldStore = create<WorldState>((set) => ({
  spec: null,
  terrain: null,
  error: null,
  setWorld: (spec, terrain) => set({ spec, terrain, error: null }),
  setError: (message) => set({ error: message })
}));
