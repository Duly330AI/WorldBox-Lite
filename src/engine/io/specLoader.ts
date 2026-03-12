import Ajv, { type DefinedError } from "ajv/dist/2020";
import worldSchema from "../../specs/schemas/world_spec.schema.json";
import stateSchema from "../../specs/schemas/state_spec.schema.json";
import techSchema from "../../specs/schemas/tech_spec.schema.json";
import unitBehaviorSchema from "../../specs/schemas/unit_behavior_spec.schema.json";

export type WorldSpec = {
  spec_id: string;
  version: string;
  schema_version: string;
  config: {
    dimensions: { width: number; height: number };
    tile_size: number;
    chunk_size: number;
  };
  terrain_types: Record<
    string,
    {
      id: number;
      walkable: boolean;
      cost: number;
      yield: { food: number; prod: number; comm: number };
    }
  >;
  features: Record<
    string,
    {
      id: number;
      prod_mod?: number;
      food_mod?: number;
      health_mod?: number;
      defense_mod?: number;
    }
  >;
};

export type StateSpec = {
  spec_id: string;
  version: string;
  memory_layout: {
    terrain_buffer: { type: string; bytes_per_tile: number; description?: string };
    feature_buffer: { type: string; bytes_per_tile: number; description?: string };
    building_buffer: { type: string; bytes_per_tile: number; description?: string };
    height_buffer: { type: string; bytes_per_tile: number; description?: string };
  };
  entity_state: {
    max_entities: number;
    properties_per_entity: Record<string, "uint8" | "uint16" | "uint32">;
  };
};

export type TechSpec = {
  spec_id: string;
  version: string;
  schema_version: string;
  techs: Record<
    string,
    { id: number; cost: number; prerequisites: string[]; unlocks: string[] }
  >;
};

export type UnitBehaviorSpec = {
  spec_id: string;
  version: string;
  schema_version: string;
  goal_definitions: Record<
    string,
    { priority: number; utility_curve: string; target_effect: string }
  >;
  actions: Record<
    string,
    { id: number; cost: number; progress_step: number; pre: string[]; eff: string[] }
  >;
  utility_formulas: Record<string, string>;
};

const ajv = new Ajv({ allErrors: true, strict: true });
const validateWorld = ajv.compile(worldSchema);
const validateState = ajv.compile(stateSchema);
const validateTech = ajv.compile(techSchema);
const validateUnitBehavior = ajv.compile(unitBehaviorSchema);

export function assertWorldSpec(data: unknown): WorldSpec {
  if (!validateWorld(data)) {
    const errors = (validateWorld.errors || []) as DefinedError[];
    const message = errors
      .map((e) => `${e.instancePath || "(root)"} ${e.message}`)
      .join("; ");
    throw new Error(`world_spec validation failed: ${message}`);
  }
  return data as WorldSpec;
}

export function assertStateSpec(data: unknown): StateSpec {
  if (!validateState(data)) {
    const errors = (validateState.errors || []) as DefinedError[];
    const message = errors
      .map((e) => `${e.instancePath || "(root)"} ${e.message}`)
      .join("; ");
    throw new Error(`state_spec validation failed: ${message}`);
  }
  return data as StateSpec;
}

export function assertTechSpec(data: unknown): TechSpec {
  if (!validateTech(data)) {
    const errors = (validateTech.errors || []) as DefinedError[];
    const message = errors
      .map((e) => `${e.instancePath || "(root)"} ${e.message}`)
      .join("; ");
    throw new Error(`tech_spec validation failed: ${message}`);
  }
  return data as TechSpec;
}

export function assertUnitBehaviorSpec(data: unknown): UnitBehaviorSpec {
  if (!validateUnitBehavior(data)) {
    const errors = (validateUnitBehavior.errors || []) as DefinedError[];
    const message = errors
      .map((e) => `${e.instancePath || "(root)"} ${e.message}`)
      .join("; ");
    throw new Error(`unit_behavior_spec validation failed: ${message}`);
  }
  return data as UnitBehaviorSpec;
}

export async function loadWorldSpec(url: string): Promise<WorldSpec> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load world_spec: ${res.status}`);
  }
  const json = (await res.json()) as unknown;
  return assertWorldSpec(json);
}

export async function loadStateSpec(url: string): Promise<StateSpec> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load state_spec: ${res.status}`);
  }
  const json = (await res.json()) as unknown;
  return assertStateSpec(json);
}

export async function loadTechSpec(url: string): Promise<TechSpec> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load tech_spec: ${res.status}`);
  }
  const json = (await res.json()) as unknown;
  return assertTechSpec(json);
}

export async function loadUnitBehaviorSpec(url: string): Promise<UnitBehaviorSpec> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load unit_behavior_spec: ${res.status}`);
  }
  const json = (await res.json()) as unknown;
  return assertUnitBehaviorSpec(json);
}
