export type TerrainType = 'grass' | 'water' | 'sand';
export type EntityType = 'tree' | 'human' | 'wolf';

export interface Entity {
  id: string;
  type: EntityType;
  x: number;
  y: number;
  health: number;
  hunger?: number;
  growth_stage?: number;
  max_growth?: number;
}

export interface WorldState {
  width: number;
  height: number;
  terrain: TerrainType[][];
  entities: Entity[];
  step: number;
}

export type ToolType = 'terrain' | 'entity' | 'eraser';

export interface ToolState {
  type: ToolType;
  value: TerrainType | EntityType | null;
}
