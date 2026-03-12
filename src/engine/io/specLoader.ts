import Ajv, { type DefinedError } from "ajv/dist/2020";
import worldSchema from "../../specs/schemas/world_spec.schema.json";
import stateSchema from "../../specs/schemas/state_spec.schema.json";
import techSchema from "../../specs/schemas/tech_spec.schema.json";
import unitBehaviorSchema from "../../specs/schemas/unit_behavior_spec.schema.json";
import loggingSchema from "../../specs/schemas/logging_spec.schema.json";
import combatSchema from "../../specs/schemas/combat_spec.schema.json";
import entitySchema from "../../specs/schemas/entity_spec.schema.json";
import simulationSchema from "../../specs/schemas/simulation_spec.schema.json";
import exportSchema from "../../specs/schemas/export_spec.schema.json";

export type WorldSpec = {
  spec_id: string;
  version: string;
  schema_version: string;
  config: {
    dimensions: { width: number; height: number };
    tile_size: number;
    chunk_size: number;
  };
  generation_params?: {
    seed: number;
    use_deterministic_simulation: boolean;
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
    explored_buffer: { type: string; bytes_per_tile: number; description?: string };
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

export type LoggingSpec = {
  spec_id: string;
  version: string;
  schema_version: string;
  config: {
    flush_interval_ticks: number;
    max_buffer_worker: number;
    ui_log_limit: number;
    levels: string[];
  };
};

export type CombatSpec = {
  spec_id: string;
  version: string;
  schema_version: string;
  rules: {
    base_damage: number;
    defense_multiplier_hills: number;
    defense_multiplier_forest: number;
    recovery_rate_at_home: number;
    death_threshold: number;
  };
  unit_counters: Record<string, number>;
};

export type EntitySpec = {
  spec_id: string;
  version: string;
  schema_version: string;
  config: { base_health_all_units: number };
  units: Record<
    string,
    {
      type_id: number;
      strength: number;
      vision: number;
      movement: number;
      cost: number;
      is_combat: boolean;
      required_tech: string;
    }
  >;
  buildings: Record<
    string,
    {
      type_id: number;
      health: number;
      cost: number;
      vision: number;
      is_combat: boolean;
      required_tech: string;
    }
  >;
};

export type SimulationSpec = {
  spec_id: string;
  version: string;
  schema_version: string;
  description?: string;
  game_loop_config: {
    mode: string;
    ticks_per_turn: number;
    max_turns: number;
    simulation_speed_multiplier: number;
  };
  victory_conditions: {
    conquest?: { active: boolean; requirement: string };
  };
  god_tools: {
    brush_sizes: number[];
    allowed_mutations: string[];
  };
  performance_targets: {
    target_tick_ms: number;
    warning_threshold_ms: number;
  };
};

export type ExportSpec = {
  spec_id: string;
  version: string;
  format: string;
  sections: {
    world_metadata: string[];
    faction_chronicles: string[];
    event_stream: string[];
  };
  post_processing: {
    compress_identical_wander_events: boolean;
    include_final_knowledge_state: boolean;
  };
};

const ajv = new Ajv({ allErrors: true, strict: true });
const validateWorld = ajv.compile(worldSchema);
const validateState = ajv.compile(stateSchema);
const validateTech = ajv.compile(techSchema);
const validateUnitBehavior = ajv.compile(unitBehaviorSchema);
const validateLogging = ajv.compile(loggingSchema);
const validateCombat = ajv.compile(combatSchema);
const validateEntity = ajv.compile(entitySchema);
const validateSimulation = ajv.compile(simulationSchema);
const validateExport = ajv.compile(exportSchema);

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

export function assertLoggingSpec(data: unknown): LoggingSpec {
  if (!validateLogging(data)) {
    const errors = (validateLogging.errors || []) as DefinedError[];
    const message = errors
      .map((e) => `${e.instancePath || "(root)"} ${e.message}`)
      .join("; ");
    throw new Error(`logging_spec validation failed: ${message}`);
  }
  return data as LoggingSpec;
}

export function assertCombatSpec(data: unknown): CombatSpec {
  if (!validateCombat(data)) {
    const errors = (validateCombat.errors || []) as DefinedError[];
    const message = errors
      .map((e) => `${e.instancePath || "(root)"} ${e.message}`)
      .join("; ");
    throw new Error(`combat_spec validation failed: ${message}`);
  }
  return data as CombatSpec;
}

export function assertEntitySpec(data: unknown): EntitySpec {
  if (!validateEntity(data)) {
    const errors = (validateEntity.errors || []) as DefinedError[];
    const message = errors
      .map((e) => `${e.instancePath || "(root)"} ${e.message}`)
      .join("; ");
    throw new Error(`entity_spec validation failed: ${message}`);
  }
  return data as EntitySpec;
}

export function assertSimulationSpec(data: unknown): SimulationSpec {
  if (!validateSimulation(data)) {
    const errors = (validateSimulation.errors || []) as DefinedError[];
    const message = errors
      .map((e) => `${e.instancePath || "(root)"} ${e.message}`)
      .join("; ");
    throw new Error(`simulation_spec validation failed: ${message}`);
  }
  return data as SimulationSpec;
}

export function assertExportSpec(data: unknown): ExportSpec {
  if (!validateExport(data)) {
    const errors = (validateExport.errors || []) as DefinedError[];
    const message = errors
      .map((e) => `${e.instancePath || "(root)"} ${e.message}`)
      .join("; ");
    throw new Error(`export_spec validation failed: ${message}`);
  }
  return data as ExportSpec;
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

export async function loadLoggingSpec(url: string): Promise<LoggingSpec> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load logging_spec: ${res.status}`);
  }
  const json = (await res.json()) as unknown;
  return assertLoggingSpec(json);
}

export async function loadCombatSpec(url: string): Promise<CombatSpec> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load combat_spec: ${res.status}`);
  }
  const json = (await res.json()) as unknown;
  return assertCombatSpec(json);
}

export async function loadEntitySpec(url: string): Promise<EntitySpec> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load entity_spec: ${res.status}`);
  }
  const json = (await res.json()) as unknown;
  return assertEntitySpec(json);
}

export async function loadSimulationSpec(url: string): Promise<SimulationSpec> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load simulation_spec: ${res.status}`);
  }
  const json = (await res.json()) as unknown;
  return assertSimulationSpec(json);
}

export async function loadExportSpec(url: string): Promise<ExportSpec> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load export_spec: ${res.status}`);
  }
  const json = (await res.json()) as unknown;
  return assertExportSpec(json);
}
