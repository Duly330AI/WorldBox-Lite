export type TerrainType = 'grass' | 'water' | 'sand' | 'mountain' | 'lava';
export type EntityType = 'tree' | 'human' | 'wolf' | 'fire' | 'house';
export type FactionPerk = 'aggressive' | 'defensive' | 'builder' | 'gatherer' | 'none';

export interface Faction {
  id: string;
  name: string;
  color: string; // e.g. 'red', 'blue', 'green'
  perk: FactionPerk;
}

export interface TelemetryEvent {
  tick: number;
  entityId: string;
  team: string;
  action: string;
  reason: string;
  coordinates: [number, number];
}

export interface Entity {
  id: string;
  type: EntityType;
  x: number;
  y: number;
  health: number;
  hunger?: number;
  thirst?: number;
  age?: number;
  growth_stage?: number;
  max_growth?: number;
  duration?: number; // Für Feuer
  wood?: number; // Für Menschen
  spawn_timer?: number; // Für Häuser
  team?: string; // Fraktions-ID
}

export interface WorldState {
  width: number;
  height: number;
  terrain: TerrainType[][];
  entities: Entity[];
  step: number;
  factions: Record<string, Faction>;
  telemetry: TelemetryEvent[];
}

export type ToolType = 'terrain' | 'entity' | 'disaster' | 'eraser';

export interface ToolState {
  type: ToolType;
  value: TerrainType | EntityType | string | null; // string for human_red, etc.
}
