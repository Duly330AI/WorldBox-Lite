import {
  loadCombatSpec,
  loadExportSpec,
  loadEntitySpec,
  loadStateSpec,
  loadTechSpec,
  loadUnitBehaviorSpec,
  loadLoggingSpec,
  loadSimulationSpec,
  loadWorldSpec,
  loadCitySpec,
  type CombatSpec,
  type ExportSpec,
  type EntitySpec,
  type LoggingSpec,
  type SimulationSpec,
  type StateSpec,
  type TechSpec,
  type UnitBehaviorSpec,
  type WorldSpec,
  type CitySpec
} from "./io/specLoader";
import { StateView } from "./state/StateView";
import { spawnUnit } from "./systems/spawn";
import { stepFire, stepLavaHeat, stepTreeGrowth } from "./systems/nature";
import { buildTerrain } from "./systems/terrain";
import { Random } from "./math/Random";

type InitMessage = {
  type: "init";
  worldSpecUrl: string;
  stateSpecUrl: string;
  techSpecUrl: string;
  unitBehaviorSpecUrl: string;
  loggingSpecUrl: string;
  combatSpecUrl: string;
  entitySpecUrl: string;
  simulationSpecUrl: string;
  exportSpecUrl: string;
  citySpecUrl: string;
  seed?: number;
};

export type StateBuffers = {
  terrain: Uint8Array;
  feature: Uint8Array;
  building: Uint16Array;
  building_storage: Uint16Array;
  height: Int8Array;
  explored: Uint8Array;
  ownership: Uint8Array;
  entities: Record<string, Uint8Array | Uint16Array | Uint32Array>;
};

type GenerateResult = {
  type: "state";
  worldSpec: WorldSpec;
  stateSpec: StateSpec;
  techSpec: TechSpec;
  unitBehaviorSpec: UnitBehaviorSpec;
  loggingSpec: LoggingSpec;
  combatSpec: CombatSpec;
  entitySpec: EntitySpec;
  simulationSpec: SimulationSpec;
  exportSpec: ExportSpec;
  buffers: StateBuffers;
  shared: boolean;
};

type LogMessage = {
  type: "log";
  entries: Array<Record<string, unknown>>;
};

type AiTickMessage = {
  type: "ai_tick";
  factionId: number;
  inputs: Record<string, number>;
  stateFacts: string[];
};

type SimTickMessage = {
  type: "sim_tick";
  entityIndices?: number[];
};

type SpawnUnitMessage = {
  type: "spawn_unit";
  unitType: number;
  factionId: number;
  x?: number;
  y?: number;
};

type WorldMutationMessage = {
  type: "world_mutation";
  mutations: Array<{ x: number; y: number; terrain?: number; feature?: number; building?: number }>;
};

type SetResearchTargetMessage = {
  type: "set_research_target";
  factionId: number;
  techId: string;
};

type ExportChronicleMessage = {
  type: "export_chronicle";
};

type ErrorMessage = {
  type: "error";
  message: string;
};

function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function seedForests(view: StateView, worldSpec: WorldSpec, rng: () => number) {
  const width = view.width;
  const height = view.height;
  const grassId = Object.values(worldSpec.terrain_types).find((t) => t.id === 0)?.id ?? 0;
  const tileCount = width * height;
  const avgClusterSize = 7;
  const clusterCount = Math.max(1, Math.floor((tileCount * 0.08) / avgClusterSize));
  const directions = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1]
  ];

  for (let c = 0; c < clusterCount; c += 1) {
    let cx = Math.floor(rng() * width);
    let cy = Math.floor(rng() * height);
    let attempts = 0;
    while (attempts < 50) {
      const idx = cy * width + cx;
      if (view.getTerrain(idx) === grassId) break;
      cx = Math.floor(rng() * width);
      cy = Math.floor(rng() * height);
      attempts += 1;
    }
    const size = 5 + Math.floor(rng() * 6);
    let x = cx;
    let y = cy;
    for (let i = 0; i < size; i += 1) {
      if (x < 0 || y < 0 || x >= width || y >= height) break;
      const idx = y * width + x;
      if (view.getTerrain(idx) === grassId) {
        view.setFeature(idx, 100);
      }
      const [dx, dy] = directions[Math.floor(rng() * directions.length)];
      x += dx;
      y += dy;
    }
  }
}

function spawnInitialUnits() {
  if (!buffersRef || !worldSpecRef || !entitySpecRef) return;
  const baseHealth = entitySpecRef.config.base_health_all_units;
  const workerId = entitySpecRef.units.worker.type_id;
  const scoutId = entitySpecRef.units.scout.type_id;

  const spawns = [
    { faction: 0, x: 10, y: 10 },
    { faction: 1, x: 70, y: 70 }
  ];

  for (const spawn of spawns) {
    spawnUnit(buffersRef, worldSpecRef, homeByFaction, baseHealth, workerId, spawn.faction, spawn.x, spawn.y, randomFn);
    spawnUnit(buffersRef, worldSpecRef, homeByFaction, baseHealth, workerId, spawn.faction, spawn.x + 1, spawn.y, randomFn);
    spawnUnit(buffersRef, worldSpecRef, homeByFaction, baseHealth, scoutId, spawn.faction, spawn.x, spawn.y + 1, randomFn);
  }
}

function spawnCityEntity(factionId: number, x: number, y: number) {
  if (!buffersRef || !stateViewRef || !entitySpecRef) return null;
  const view = stateViewRef;
  for (let i = 0; i < view.entityCount; i += 1) {
    if (view.getEntityId(i) !== 0) continue;
    view.setEntityId(i, i + 1);
    view.setEntityType(i, CITY_ENTITY_TYPE);
    view.setEntityFaction(i, factionId);
    view.setEntityX(i, x);
    view.setEntityY(i, y);
    view.setEntityHealth(i, entitySpecRef.config.base_health_all_units);
    view.setEntityHunger(i, 0);
    view.setEntityWood(i, 0);
    view.setEntityFood(i, 0);
    view.setEntityActionId(i, 0);
    view.setEntityActionProgress(i, 0);
    view.setEntityPlanLock(i, 0);
    view.setEntityTargetX(i, INVALID_TARGET);
    view.setEntityTargetY(i, INVALID_TARGET);
    view.setEntityCitySize(i, 1);
    view.setEntityCityGrowthPoints(i, 0);
    const rule = getCityRule(1);
    const initialFood = rule ? rule.threshold + rule.food_consumption * 5 : 20;
    view.setEntityCityFoodStockpile(i, initialFood);
    return i;
  }
  return null;
}

function allocBuffer(byteLength: number, useShared: boolean): ArrayBuffer {
  if (useShared && typeof SharedArrayBuffer !== "undefined") {
    return new SharedArrayBuffer(byteLength);
  }
  return new ArrayBuffer(byteLength);
}

function makeTileBuffer(type: string, length: number, useShared: boolean) {
  if (type === "Uint16Array") {
    return new Uint16Array(allocBuffer(length * 2, useShared));
  }
  if (type === "Int8Array") {
    return new Int8Array(allocBuffer(length, useShared));
  }
  return new Uint8Array(allocBuffer(length, useShared));
}

function makeStateBuffers(stateSpec: StateSpec, worldSpec: WorldSpec, useShared: boolean): StateBuffers {
  const { width, height } = worldSpec.config.dimensions;
  const tileCount = width * height;

  const terrain = makeTileBuffer(stateSpec.memory_layout.terrain_buffer.type, tileCount, useShared) as Uint8Array;
  const feature = makeTileBuffer(stateSpec.memory_layout.feature_buffer.type, tileCount, useShared) as Uint8Array;
  const building = makeTileBuffer(stateSpec.memory_layout.building_buffer.type, tileCount, useShared) as Uint16Array;
  const buildingStorage = makeTileBuffer(stateSpec.memory_layout.building_storage_buffer.type, tileCount, useShared) as Uint16Array;
  const heightBuf = makeTileBuffer(stateSpec.memory_layout.height_buffer.type, tileCount, useShared) as Int8Array;
  const explored = makeTileBuffer(stateSpec.memory_layout.explored_buffer.type, tileCount, useShared) as Uint8Array;

  const entities: StateBuffers["entities"] = {};
  const maxEntities = stateSpec.entity_state.max_entities;
  for (const [key, type] of Object.entries(stateSpec.entity_state.properties_per_entity)) {
    if (type === "uint8") {
      entities[key] = new Uint8Array(allocBuffer(maxEntities, useShared));
    } else if (type === "uint16") {
      entities[key] = new Uint16Array(allocBuffer(maxEntities * 2, useShared));
    } else {
      entities[key] = new Uint32Array(allocBuffer(maxEntities * 4, useShared));
    }
  }

  const ownership = makeTileBuffer(stateSpec.memory_layout.ownership_buffer.type, tileCount, useShared) as Uint8Array;

  return { terrain, feature, building, building_storage: buildingStorage, height: heightBuf, explored, ownership, entities };
}

class TechManager {
  private techSpec: TechSpec;
  private factions = new Map<number, { current: string | null; progress: number; known: Set<string> }>();

  constructor(techSpec: TechSpec) {
    this.techSpec = techSpec;
  }

  addFaction(factionId: number) {
    if (!this.factions.has(factionId)) {
      this.factions.set(factionId, { current: null, progress: 0, known: new Set() });
    }
  }

  startResearch(factionId: number, techId: string) {
    const faction = this.factions.get(factionId);
    if (!faction) return false;
    if (!this.techSpec.techs[techId]) return false;
    const prereq = this.techSpec.techs[techId].prerequisites ?? [];
    for (const req of prereq) {
      if (!faction.known.has(req)) return false;
    }
    faction.current = techId;
    faction.progress = 0;
    return true;
  }

  tickResearch(factionId: number, points: number) {
    const faction = this.factions.get(factionId);
    if (!faction || !faction.current) return null;
    const tech = this.techSpec.techs[faction.current];
    if (!tech) return null;
    faction.progress += points;
    if (faction.progress >= tech.cost) {
      faction.known.add(faction.current);
      const completed = faction.current;
      faction.current = null;
      faction.progress = 0;
      return completed;
    }
    return null;
  }

  getState(factionId: number) {
    const faction = this.factions.get(factionId);
    if (!faction) {
      return { current: null, progress: 0, cost: 0, known: [] as string[] };
    }
    const cost = faction.current ? this.techSpec.techs[faction.current]?.cost ?? 0 : 0;
    return {
      current: faction.current,
      progress: faction.progress,
      cost,
      known: Array.from(faction.known)
    };
  }

  getKnown(factionId: number) {
    return this.factions.get(factionId)?.known ?? new Set<string>();
  }
}

type ActionDef = { name: string; cost: number; pre: string[]; eff: string[] };

function buildFormula(expr: string) {
  const safe = expr.replace(/\s+/g, "");
  if (!/^[0-9a-zA-Z_()+\-*/^?:<>=!&.|]+$/.test(safe)) {
    return () => 0;
  }
  const normalized = safe.replace(/\^/g, "**");
  return (vars: Record<string, number>) => {
    const fn = new Function(
      "vars",
      `with (vars) { return (${normalized}); }`
    ) as (v: Record<string, number>) => number;
    try {
      const value = fn(vars);
      return Number.isFinite(value) ? value : 0;
    } catch {
      return 0;
    }
  };
}

function computeUtilities(
  spec: UnitBehaviorSpec,
  inputs: Record<string, number>
): Record<string, number> {
  const utilities: Record<string, number> = {};
  for (const [key, expr] of Object.entries(spec.utility_formulas)) {
    const fn = buildFormula(expr);
    utilities[key] = fn(inputs);
  }
  return utilities;
}

function pickTopGoal(spec: UnitBehaviorSpec, utilities: Record<string, number>) {
  let bestGoal = "";
  let bestEffect = "";
  let bestScore = -Infinity;
  let bestPriority = Number.MAX_SAFE_INTEGER;
  for (const [goal, def] of Object.entries(spec.goal_definitions)) {
    const score = utilities[def.utility_curve] ?? 0;
    if (score > bestScore || (score === bestScore && def.priority < bestPriority)) {
      bestScore = score;
      bestPriority = def.priority;
      bestGoal = goal;
      bestEffect = def.target_effect;
    }
  }
  return { goalKey: bestGoal, goalEffect: bestEffect };
}

function buildPlan(actions: ActionDef[], goalEffect: string, stateFacts: Set<string>) {
  if (!goalEffect) return [];
  const maxDepth = 5;
  const queue: Array<{ state: Set<string>; plan: ActionDef[] }> = [
    { state: new Set(stateFacts), plan: [] }
  ];
  while (queue.length > 0) {
    const node = queue.shift()!;
    if (node.state.has(goalEffect)) return node.plan;
    if (node.plan.length >= maxDepth) continue;
    for (const action of actions) {
      if (action.pre.every((p) => node.state.has(p))) {
        const nextState = new Set(node.state);
        for (const eff of action.eff) nextState.add(eff);
        queue.push({ state: nextState, plan: [...node.plan, action] });
      }
    }
  }
  return [];
}

function pickGoalWithPlan(
  spec: UnitBehaviorSpec,
  utilities: Record<string, number>,
  actions: ActionDef[],
  stateFacts: Set<string>
) {
  const candidates = Object.entries(spec.goal_definitions)
    .map(([goal, def]) => ({
      goal,
      effect: def.target_effect,
      score: utilities[def.utility_curve] ?? 0,
      priority: def.priority
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.priority - b.priority;
    });

  for (const cand of candidates) {
    const plan = buildPlan(actions, cand.effect, new Set(stateFacts));
    if (plan.length > 0) {
      return { goalKey: cand.goal, goalEffect: cand.effect, plan };
    }
  }

  return { goalKey: candidates[0]?.goal ?? "", goalEffect: candidates[0]?.effect ?? "", plan: [] };
}

const logBuffer: Array<Record<string, unknown>> = [];
const knowledgeByFaction: Record<number, Record<string, number>> = {};
const chroniclesByFaction: Record<
  number,
  {
    tech_order: string[];
    total_resources_gathered: { wood: number; food: number };
    houses_built: number;
    kills: number;
    losses: number;
    produced_units: Record<number, number>;
  }
> = {};
const eventStream = {
  decisions: [] as Array<Record<string, unknown>>,
  combat: [] as Array<Record<string, unknown>>,
  victory_milestones: [] as Array<Record<string, unknown>>
};
function logEvent(entry: Record<string, unknown>) {
  logBuffer.push({ ts: Date.now(), tick: simTick, ...entry });
  trackKnowledge(entry);
  trackEventStream(entry);
}
function flushLogs() {
  if (logBuffer.length === 0) return;
  const limit = loggingSpecRef?.config.ui_log_limit ?? 50;
  const payload: LogMessage = { type: "log", entries: logBuffer.splice(0, logBuffer.length) };
  payload.entries = payload.entries.slice(-limit);
  self.postMessage(payload);
}

function trackKnowledge(entry: Record<string, unknown>) {
  if (!stateViewRef) return;
  let factionId: number | null = null;
  if (typeof entry.faction_id === "number") factionId = entry.faction_id;
  if (factionId === null && typeof entry.entity_id === "number") {
    factionId = stateViewRef.getEntityFaction(entry.entity_id);
  }
  if (factionId === null || Number.isNaN(factionId)) return;
  if (!knowledgeByFaction[factionId]) knowledgeByFaction[factionId] = {};
  const baseType = entry.event_type ? String(entry.event_type) : "event";
  const action = entry.action ? String(entry.action) : null;
  const key = action ? `${baseType}:${action}` : baseType;
  knowledgeByFaction[factionId][key] = (knowledgeByFaction[factionId][key] ?? 0) + 1;
}

function ensureChronicle(factionId: number) {
  if (!chroniclesByFaction[factionId]) {
    chroniclesByFaction[factionId] = {
      tech_order: [],
      total_resources_gathered: { wood: 0, food: 0 },
      houses_built: 0,
      kills: 0,
      losses: 0,
      produced_units: {}
    };
  }
  return chroniclesByFaction[factionId];
}

function ensureBlackboard(factionId: number) {
  if (!blackboardByFaction.has(factionId)) {
    blackboardByFaction.set(factionId, {
      forests: new Set(),
      food: new Set(),
      enemyBases: new Set(),
      enemyWorkers: new Set()
    });
  }
  return blackboardByFaction.get(factionId)!;
}

function findNearestKnown(
  factionId: number,
  x: number,
  y: number,
  set: Set<number>,
  isValid: (idx: number) => boolean
) {
  let best: { x: number; y: number; dist: number } | null = null;
  for (const idx of set) {
    if (!isValid(idx)) continue;
    const tx = idx % stateViewRef!.width;
    const ty = Math.floor(idx / stateViewRef!.width);
    const dist = Math.abs(tx - x) + Math.abs(ty - y);
    if (!best || dist < best.dist) best = { x: tx, y: ty, dist };
  }
  return best ? { x: best.x, y: best.y } : null;
}

function trackEventStream(entry: Record<string, unknown>) {
  const type = String(entry.event_type ?? "");
  if (type === "AI_PLAN_CHANGE" || type === "UNIT_ACTION" || type.startsWith("CITY_")) {
    eventStream.decisions.push(entry);
  } else if (type === "UNIT_DIED" || entry.level === "COMBAT") {
    eventStream.combat.push(entry);
  } else if (type === "MATCH_OVER") {
    eventStream.victory_milestones.push(entry);
  }
  const maxEntries = 5000;
  if (eventStream.decisions.length > maxEntries) eventStream.decisions.shift();
  if (eventStream.combat.length > maxEntries) eventStream.combat.shift();
  if (eventStream.victory_milestones.length > maxEntries) eventStream.victory_milestones.shift();
}

function snapshotKnowledge() {
  const snapshot: Record<number, Record<string, number>> = {};
  for (const [factionStr, data] of Object.entries(knowledgeByFaction)) {
    snapshot[Number(factionStr)] = { ...data };
  }
  return snapshot;
}

function snapshotChronicles() {
  const snapshot: Record<number, Record<string, unknown>> = {};
  for (const [factionStr, data] of Object.entries(chroniclesByFaction)) {
    const ratio =
      data.losses === 0 ? data.kills : Number((data.kills / data.losses).toFixed(2));
    snapshot[Number(factionStr)] = {
      tech_order: [...data.tech_order],
      total_resources_gathered: { ...data.total_resources_gathered },
      battle_win_loss_ratio: ratio,
      produced_units: { ...data.produced_units }
    };
  }
  return snapshot;
}

function buildExportPayload(spec: ExportSpec) {
  const world_metadata = {
    dimensions: worldSpecRef?.config.dimensions,
    seed: seedRef,
    tech_tree_version: techSpecRef?.version ?? ""
  };
  let decisions = [...eventStream.decisions];
  if (spec.post_processing.compress_identical_wander_events) {
    const compressed: Array<Record<string, unknown>> = [];
    let last: Record<string, unknown> | null = null;
    for (const entry of decisions) {
      const action = String(entry.action ?? "");
      if (last && action === "WANDER" && String(last.action ?? "") === "WANDER") {
        continue;
      }
      compressed.push(entry);
      last = entry;
    }
    decisions = compressed;
  }
  const payload: Record<string, unknown> = {
    spec_id: spec.spec_id,
    version: spec.version,
    format: spec.format,
    world_metadata,
    faction_chronicles: snapshotChronicles(),
    event_stream: {
      decisions,
      combat: eventStream.combat,
      victory_milestones: eventStream.victory_milestones
    }
  };
  if (spec.post_processing.include_final_knowledge_state) {
    payload.final_knowledge_state = snapshotKnowledge();
  }
  return payload;
}

let unitBehaviorSpecRef: UnitBehaviorSpec | null = null;
let techManagerRef: TechManager | null = null;
let techSpecRef: TechSpec | null = null;
let worldSpecRef: WorldSpec | null = null;
let stateSpecRef: StateSpec | null = null;
let buffersRef: StateBuffers | null = null;
let simTick = 0;
let loggingSpecRef: LoggingSpec | null = null;
let stateViewRef: StateView | null = null;
let combatSpecRef: CombatSpec | null = null;
let entitySpecRef: EntitySpec | null = null;
let simulationSpecRef: SimulationSpec | null = null;
let exportSpecRef: ExportSpec | null = null;
let citySpecRef: CitySpec | null = null;
let seedRef = 0;
let randomRef: Random | null = null;
let randomFn: () => number = Math.random;
let maxVisionRef = 3;
let pathfindingCalls = 0;
let matchOverSent = false;
const attackLines: Array<{ from: [number, number]; to: [number, number] }> = [];
const INVALID_TARGET = 0xffff;
const CITY_ENTITY_TYPE = 210;

let actionById: Map<number, { name: string; progress_step: number }> = new Map();
let actionIdByName: Map<string, number> = new Map();
const exploredTiles: Map<number, Set<number>> = new Map();
const lastPaths: Map<number, Array<[number, number]>> = new Map();
const lastDecision: Map<number, { goal: string; plan: string[]; utilities: Record<string, number> }> = new Map();
const homeByFaction: Map<number, { x: number; y: number }> = new Map();
const buildingOwner: Map<number, number> = new Map();
const hateMatrix: number[][] = Array.from({ length: 8 }, (_, i) =>
  Array.from({ length: 8 }, (_, j) => (i === j ? 0 : 100))
);
const lastFactionMilitary: Map<number, number> = new Map();
const lastFactionEnemyMilitary: Map<number, number> = new Map();
const lastExploredCount: Map<number, number> = new Map();
const perfSamples: number[] = [];
const lastAttackerByEntity: Map<number, number> = new Map();
const blackboardByFaction: Map<
  number,
  { forests: Set<number>; food: Set<number>; enemyBases: Set<number>; enemyWorkers: Set<number> }
> = new Map();
const forcedTargets: Map<number, { x: number; y: number }> = new Map();
let foodTerrainIds: Set<number> = new Set();
type SpatialIndex = {
  cellSize: number;
  cols: number;
  rows: number;
  cells: number[][];
};
let spatialIndexRef: SpatialIndex | null = null;

function createSpatialIndex(width: number, height: number, cellSize: number): SpatialIndex {
  const cols = Math.ceil(width / cellSize);
  const rows = Math.ceil(height / cellSize);
  const cells = Array.from({ length: cols * rows }, () => [] as number[]);
  return { cellSize, cols, rows, cells };
}

function rebuildSpatialIndex(view: StateView) {
  if (!spatialIndexRef) return;
  const { cellSize, cols, rows, cells } = spatialIndexRef;
  for (const cell of cells) cell.length = 0;
  for (let i = 0; i < view.entityCount; i += 1) {
    if (view.getEntityId(i) === 0) continue;
    const x = view.getEntityX(i);
    const y = view.getEntityY(i);
    const cx = Math.floor(x / cellSize);
    const cy = Math.floor(y / cellSize);
    if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) continue;
    cells[cy * cols + cx].push(i);
  }
}

function forEachNearbyEntity(
  x: number,
  y: number,
  range: number,
  cb: (entityIndex: number) => boolean | void
) {
  if (!spatialIndexRef || !stateViewRef) return;
  const { cellSize, cols, rows, cells } = spatialIndexRef;
  const minCx = Math.max(0, Math.floor((x - range) / cellSize));
  const maxCx = Math.min(cols - 1, Math.floor((x + range) / cellSize));
  const minCy = Math.max(0, Math.floor((y - range) / cellSize));
  const maxCy = Math.min(rows - 1, Math.floor((y + range) / cellSize));
  for (let cy = minCy; cy <= maxCy; cy += 1) {
    for (let cx = minCx; cx <= maxCx; cx += 1) {
      const list = cells[cy * cols + cx];
      for (let i = 0; i < list.length; i += 1) {
        const stop = cb(list[i]);
        if (stop) return;
      }
    }
  }
}

function findEntityAtTile(x: number, y: number) {
  if (!spatialIndexRef || !stateViewRef) return null;
  const view = stateViewRef;
  const { cellSize, cols, rows, cells } = spatialIndexRef;
  const cx = Math.floor(x / cellSize);
  const cy = Math.floor(y / cellSize);
  if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) return null;
  const list = cells[cy * cols + cx];
  for (let i = 0; i < list.length; i += 1) {
    const idx = list[i];
    if (view.getEntityX(idx) === x && view.getEntityY(idx) === y) return idx;
  }
  return null;
}

function getUnitDefByType(typeId: number) {
  if (!entitySpecRef) return null;
  return Object.values(entitySpecRef.units).find((u) => u.type_id === typeId) ?? null;
}

function getUnitNameByType(typeId: number) {
  if (!entitySpecRef) return null;
  return Object.keys(entitySpecRef.units).find((k) => entitySpecRef!.units[k].type_id === typeId) ?? null;
}

function getUnitVision(typeId: number) {
  return getUnitDefByType(typeId)?.vision ?? 1;
}

function getUnitStrength(typeId: number) {
  return getUnitDefByType(typeId)?.strength ?? 0;
}

function getUnitAttackRange(typeId: number) {
  return getUnitDefByType(typeId)?.attack_range ?? 1;
}

function isCombatUnit(typeId: number) {
  return getUnitDefByType(typeId)?.is_combat ?? false;
}

function getUnitCost(typeId: number) {
  const def = getUnitDefByType(typeId);
  return def?.cost ?? 0;
}

function hasTech(factionId: number, techId: string | undefined) {
  if (!techId) return true;
  return techManagerRef?.getKnown(factionId)?.has(techId) ?? false;
}

function getCityRule(size: number) {
  if (!citySpecRef) return null;
  const rule = citySpecRef.growth_rules[String(size)];
  return rule ?? null;
}

function getCityRadius(size: number) {
  return getCityRule(size)?.radius ?? 0;
}

function isCityEntity(typeId: number) {
  return typeId === CITY_ENTITY_TYPE;
}

function countFactionCities(factionId: number) {
  if (!stateViewRef) return 0;
  const view = stateViewRef;
  let count = 0;
  for (let i = 0; i < view.entityCount; i += 1) {
    if (view.getEntityId(i) === 0) continue;
    if (view.getEntityFaction(i) !== factionId) continue;
    if (isCityEntity(view.getEntityType(i))) count += 1;
  }
  return count;
}

function countFactionHouses(factionId: number) {
  if (!stateViewRef) return 0;
  const view = stateViewRef;
  let count = 0;
  for (let i = 0; i < view.width * view.height; i += 1) {
    if (view.getBuilding(i) !== 300) continue;
    const owner = buildingOwner.get(i) ?? 0;
    if (owner === factionId) count += 1;
  }
  return count;
}

function chooseProductionUnit(
  factionId: number,
  storage: number,
  rng: () => number
) {
  if (!entitySpecRef) return entitySpecRef?.units.worker.type_id ?? 201;
  const workerId = entitySpecRef.units.worker.type_id;
  const archerId = entitySpecRef.units.archer?.type_id ?? 202;
  const axemanId = entitySpecRef.units.axeman?.type_id ?? 203;
  const known = techManagerRef?.getKnown(factionId) ?? new Set<string>();
  const workerOk = hasTech(factionId, entitySpecRef.units.worker.required_tech);
  const archerOk = entitySpecRef.units.archer
    ? hasTech(factionId, entitySpecRef.units.archer.required_tech)
    : false;
  const axemanOk = entitySpecRef.units.axeman
    ? hasTech(factionId, entitySpecRef.units.axeman.required_tech)
    : false;
  let archerWeight = known.has("archery") && archerOk ? 0.3 : 0;
  let axemanWeight = known.has("bronze_working") && axemanOk ? 0.3 : 0;
  if (storage < getUnitCost(archerId)) archerWeight = 0;
  if (storage < getUnitCost(axemanId)) axemanWeight = 0;
  let workerWeight = Math.max(0, 1 - (archerWeight + axemanWeight));
  if (!workerOk) workerWeight = 0;
  if (storage < getUnitCost(workerId)) workerWeight = 0;
  const options: Array<{ id: number; weight: number }> = [];
  if (workerWeight > 0) options.push({ id: workerId, weight: workerWeight });
  if (archerWeight > 0) options.push({ id: archerId, weight: archerWeight });
  if (axemanWeight > 0) options.push({ id: axemanId, weight: axemanWeight });
  if (options.length === 0) return null;
  const total = options.reduce((sum, o) => sum + o.weight, 0);
  let roll = rng() * total;
  for (const opt of options) {
    if (roll <= opt.weight) return opt.id;
    roll -= opt.weight;
  }
  return options[0].id;
}

function buildActionIdMap(spec: UnitBehaviorSpec) {
  actionById = new Map();
  actionIdByName = new Map();
  for (const [name, def] of Object.entries(spec.actions)) {
    actionById.set(def.id, { name, progress_step: def.progress_step });
    actionIdByName.set(name, def.id);
  }
}

function buildOccupancy(buffers: StateBuffers, width: number, height: number) {
  const occupied = new Set<number>();
  if (!stateViewRef) return occupied;
  const view = stateViewRef;
  for (let i = 0; i < view.entityCount; i += 1) {
    if (view.getEntityId(i) === 0) continue;
    const x = view.getEntityX(i);
    const y = view.getEntityY(i);
    if (x >= width || y >= height) continue;
    occupied.add(y * width + x);
  }
  return occupied;
}

function findEnemyInRange(entityIndex: number, range: number) {
  if (!stateViewRef) return null;
  const view = stateViewRef;
  const selfFaction = view.getEntityFaction(entityIndex);
  const sx = view.getEntityX(entityIndex);
  const sy = view.getEntityY(entityIndex);
  let found: number | null = null;
  let preferred: number | null = null;
  const workerId = entitySpecRef?.units.worker.type_id ?? 201;
  forEachNearbyEntity(sx, sy, range, (i) => {
    if (view.getEntityId(i) === 0) return;
    if (view.getEntityFaction(i) === selfFaction) return;
    if (isCityEntity(view.getEntityType(i))) return;
    const enemyIdx = view.tileIndex(view.getEntityX(i), view.getEntityY(i));
    if ((view.getExplored(enemyIdx) & (1 << selfFaction)) === 0) return;
    const ex = view.getEntityX(i);
    const ey = view.getEntityY(i);
    const dx = Math.abs(ex - sx);
    const dy = Math.abs(ey - sy);
    if (dx <= range && dy <= range) {
      if (!found) found = i;
      const enemyType = view.getEntityType(i);
      if (enemyType === workerId) {
        const home = homeByFaction.get(view.getEntityFaction(i));
        const dist = home ? Math.abs(ex - home.x) + Math.abs(ey - home.y) : 99;
        if (dist > 5) {
          preferred = i;
          return true;
        }
      }
    }
  });
  if (preferred !== null) return preferred;
  if (found !== null) return found;
  return null;
}

function findEnemyInRangeByType(entityIndex: number) {
  if (!stateViewRef) return null;
  const view = stateViewRef;
  const range = getUnitAttackRange(view.getEntityType(entityIndex));
  return findEnemyInRange(entityIndex, range);
}

function isEnemyInVision(entityIndex: number) {
  if (!stateViewRef) return false;
  const view = stateViewRef;
  const selfFaction = view.getEntityFaction(entityIndex);
  const sx = view.getEntityX(entityIndex);
  const sy = view.getEntityY(entityIndex);
  const vision = getUnitVision(view.getEntityType(entityIndex));
  let seen = false;
  forEachNearbyEntity(sx, sy, vision, (i) => {
    if (view.getEntityId(i) === 0) return;
    if (view.getEntityFaction(i) === selfFaction) return;
    if (isCityEntity(view.getEntityType(i))) return;
    const enemyIdx = view.tileIndex(view.getEntityX(i), view.getEntityY(i));
    if ((view.getExplored(enemyIdx) & (1 << selfFaction)) === 0) return;
    const ex = view.getEntityX(i);
    const ey = view.getEntityY(i);
    const dx = Math.abs(ex - sx);
    const dy = Math.abs(ey - sy);
    if (dx <= vision && dy <= vision) {
      seen = true;
      return true;
    }
  });
  if (seen) return true;
  return false;
}

function enemyThreatCost(tx: number, ty: number, factionId: number) {
  if (!stateViewRef) return 0;
  const view = stateViewRef;
  const idx = view.tileIndex(tx, ty);
  if ((view.getExplored(idx) & (1 << factionId)) === 0) return 0;
  const maxVision = maxVisionRef;
  let cost = 0;
  forEachNearbyEntity(tx, ty, maxVision, (i) => {
    if (view.getEntityId(i) === 0) return;
    const enemyFaction = view.getEntityFaction(i);
    if (enemyFaction === factionId) return;
    if ((hateMatrix[factionId]?.[enemyFaction] ?? 0) <= 0) return;
    const vision = getUnitVision(view.getEntityType(i));
    const dx = Math.abs(view.getEntityX(i) - tx);
    const dy = Math.abs(view.getEntityY(i) - ty);
    if (dx <= vision && dy <= vision) {
      cost = 20;
      return true;
    }
  });
  if (cost > 0) return cost;
  return 0;
}

function claimCityTerritory(cityIndex: number) {
  if (!stateViewRef || !citySpecRef) return;
  const view = stateViewRef;
  const size = view.getEntityCitySize(cityIndex);
  const radius = getCityRadius(size);
  const cx = view.getEntityX(cityIndex);
  const cy = view.getEntityY(cityIndex);
  const faction = view.getEntityFaction(cityIndex);
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      const tx = cx + dx;
      const ty = cy + dy;
      if (tx < 0 || ty < 0 || tx >= view.width || ty >= view.height) continue;
      const dist = Math.max(Math.abs(dx), Math.abs(dy));
      if (dist > radius) continue;
      view.setOwnership(view.tileIndex(tx, ty), faction);
    }
  }
}

function isValidCityPlacement(x: number, y: number, factionId: number) {
  if (!stateViewRef || !citySpecRef) return false;
  const view = stateViewRef;
  if (!view.isWalkable(x, y)) return false;
  const idx = view.tileIndex(x, y);
  if (view.getBuilding(idx) !== 0) return false;
  const minDist = citySpecRef.placement_rules.min_distance_centers;
  const allowOverlap = citySpecRef.placement_rules.allow_radius_overlap;
  for (let i = 0; i < view.entityCount; i += 1) {
    if (view.getEntityId(i) === 0) continue;
    if (!isCityEntity(view.getEntityType(i))) continue;
    const ox = view.getEntityX(i);
    const oy = view.getEntityY(i);
    const dist = Math.max(Math.abs(ox - x), Math.abs(oy - y));
    if (dist < minDist) return false;
    if (!allowOverlap) {
      const otherRadius = getCityRadius(view.getEntityCitySize(i));
      if (dist <= otherRadius + getCityRadius(1)) return false;
    }
  }
  return true;
}

function findNearestTile(
  startX: number,
  startY: number,
  width: number,
  height: number,
  isWalkable: (x: number, y: number) => boolean,
  isTarget: (x: number, y: number) => boolean,
  occupied: Set<number>
) {
  const visited = new Uint8Array(width * height);
  const queue: Array<[number, number]> = [[startX, startY]];
  visited[startY * width + startX] = 1;
  while (queue.length > 0) {
    const [x, y] = queue.shift()!;
    if (isTarget(x, y)) return { x, y };
    const neighbors = [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1]
    ];
    for (const [nx, ny] of neighbors) {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const idx = ny * width + nx;
      if (visited[idx]) continue;
      if (!isWalkable(nx, ny)) continue;
      if (occupied.has(idx) && !(nx === startX && ny === startY)) continue;
      visited[idx] = 1;
      queue.push([nx, ny]);
    }
  }
  return null;
}

function buildMinimapBuffer(view: StateView, size = 80) {
  const width = view.width;
  const height = view.height;
  const buffer = new Uint8ClampedArray(size * size * 4);
  const stepX = width / size;
  const stepY = height / size;
  const terrainColors: Record<number, [number, number, number]> = {
    0: [74, 222, 128],
    1: [251, 191, 36],
    2: [245, 158, 11],
    5: [59, 130, 246],
    7: [75, 85, 99],
    8: [239, 68, 68]
  };
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const tx = Math.min(width - 1, Math.floor(x * stepX));
      const ty = Math.min(height - 1, Math.floor(y * stepY));
      const idx = view.tileIndex(tx, ty);
      const terrain = view.getTerrain(idx);
      const feature = view.getFeature(idx);
      let color = terrainColors[terrain] ?? [51, 51, 51];
      if (feature === 100) color = [20, 83, 45];
      if (feature === 110) color = [249, 115, 22];
      const base = (y * size + x) * 4;
      buffer[base] = color[0];
      buffer[base + 1] = color[1];
      buffer[base + 2] = color[2];
      buffer[base + 3] = 255;
    }
  }
  for (let i = 0; i < view.entityCount; i += 1) {
    if (view.getEntityId(i) === 0) continue;
    const ex = view.getEntityX(i);
    const ey = view.getEntityY(i);
    const mx = Math.floor((ex / width) * size);
    const my = Math.floor((ey / height) * size);
    const base = (my * size + mx) * 4;
    const faction = view.getEntityFaction(i);
    const color = faction === 1 ? [59, 130, 246] : [239, 68, 68];
    buffer[base] = color[0];
    buffer[base + 1] = color[1];
    buffer[base + 2] = color[2];
    buffer[base + 3] = 255;
  }
  return buffer;
}

function aStarPath(
  startX: number,
  startY: number,
  goalX: number,
  goalY: number,
  width: number,
  height: number,
  isWalkable: (x: number, y: number) => boolean,
  occupied: Set<number>,
  extraCost?: (x: number, y: number) => number
) {
  pathfindingCalls += 1;
  const maxIterations = 2000;
  const startIdx = startY * width + startX;
  const goalIdx = goalY * width + goalX;
  const open: number[] = [startIdx];
  const cameFrom = new Int32Array(width * height).fill(-1);
  const gScore = new Float32Array(width * height).fill(Number.POSITIVE_INFINITY);
  gScore[startIdx] = 0;
  const fScore = new Float32Array(width * height).fill(Number.POSITIVE_INFINITY);
  fScore[startIdx] = Math.abs(goalX - startX) + Math.abs(goalY - startY);

  let iterations = 0;
  while (open.length > 0 && iterations < maxIterations) {
    iterations += 1;
    let bestIdx = 0;
    for (let i = 1; i < open.length; i += 1) {
      if (fScore[open[i]] < fScore[open[bestIdx]]) bestIdx = i;
    }
    const current = open.splice(bestIdx, 1)[0];
    if (current === goalIdx) break;
    const cx = current % width;
    const cy = Math.floor(current / width);
    const neighbors = [
      [cx + 1, cy],
      [cx - 1, cy],
      [cx, cy + 1],
      [cx, cy - 1]
    ];
    for (const [nx, ny] of neighbors) {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const nIdx = ny * width + nx;
      if (!isWalkable(nx, ny)) continue;
      if (occupied.has(nIdx) && nIdx !== startIdx && nIdx !== goalIdx) continue;
      const penalty = extraCost ? extraCost(nx, ny) : 0;
      const tentative = gScore[current] + 1 + penalty;
      if (tentative < gScore[nIdx]) {
        cameFrom[nIdx] = current;
        gScore[nIdx] = tentative;
        fScore[nIdx] = tentative + Math.abs(goalX - nx) + Math.abs(goalY - ny);
        if (!open.includes(nIdx)) open.push(nIdx);
      }
    }
  }

  if (cameFrom[goalIdx] === -1) return null;
  const path: Array<[number, number]> = [];
  let current = goalIdx;
  path.push([goalX, goalY]);
  while (current !== startIdx) {
    const prev = cameFrom[current];
    if (prev === -1) break;
    const px = prev % width;
    const py = Math.floor(prev / width);
    path.push([px, py]);
    current = prev;
  }
  path.reverse();
  return path;
}

function tickAction(entityIndex: number) {
  if (!buffersRef || !worldSpecRef || !stateSpecRef || !stateViewRef) return;
  const buffers = buffersRef;
  const view = stateViewRef;
  const { width, height } = worldSpecRef.config.dimensions;
  const x = view.getEntityX(entityIndex);
  const y = view.getEntityY(entityIndex);
  const actionId = view.getEntityActionId(entityIndex);
  const actionMeta = actionById.get(actionId);
  const progressStep = actionMeta?.progress_step ?? 0;
  if (!actionMeta) return;
  if (isCityEntity(view.getEntityType(entityIndex))) return;

  const isWalkable = (tx: number, ty: number) => view.isWalkable(tx, ty);

  const occupied = buildOccupancy(buffers, width, height);
  const idx = y * width + x;
  occupied.delete(idx);

  const hasValidTarget = (tx: number, ty: number, predicate: (tx: number, ty: number) => boolean) =>
    tx >= 0 && ty >= 0 && tx < width && ty < height && predicate(tx, ty);

  const ensureTarget = (predicate: (tx: number, ty: number) => boolean) => {
    const tx = view.getEntityTargetX(entityIndex);
    const ty = view.getEntityTargetY(entityIndex);
    if (hasValidTarget(tx, ty, predicate)) return;
    const found = findNearestTile(x, y, width, height, isWalkable, predicate, occupied);
    if (found) {
      view.setEntityTargetX(entityIndex, found.x);
      view.setEntityTargetY(entityIndex, found.y);
    } else {
      view.setEntityTargetX(entityIndex, INVALID_TARGET);
      view.setEntityTargetY(entityIndex, INVALID_TARGET);
    }
  };

  const atTarget = () =>
    x === view.getEntityTargetX(entityIndex) && y === view.getEntityTargetY(entityIndex);

  const moveTowardTarget = () => {
    const path = aStarPath(
      x,
      y,
      view.getEntityTargetX(entityIndex),
      view.getEntityTargetY(entityIndex),
      width,
      height,
      isWalkable,
      occupied,
      actionMeta.name === "ATTACK" ? undefined : (tx, ty) => enemyThreatCost(tx, ty, view.getEntityFaction(entityIndex))
    );
    if (path && path.length > 1) {
      const [nx, ny] = path[1];
      view.setEntityX(entityIndex, nx);
      view.setEntityY(entityIndex, ny);
      view.setEntityAnimationFrame(entityIndex, (view.getEntityAnimationFrame(entityIndex) + 1) % 2);
      lastPaths.set(entityIndex, path);
    } else {
      view.setEntityAnimationFrame(entityIndex, 0);
    }
  };

  const forced = forcedTargets.get(entityIndex);
  if (forced) {
    view.setEntityTargetX(entityIndex, forced.x);
    view.setEntityTargetY(entityIndex, forced.y);
    if (!atTarget()) {
      moveTowardTarget();
      return;
    }
    forcedTargets.delete(entityIndex);
    view.setEntityActionProgress(entityIndex, 0);
    return;
  }

  const findNearestInVision = (predicate: (idx: number) => boolean) => {
    const vision = getUnitVision(view.getEntityType(entityIndex));
    let best: { x: number; y: number; dist: number } | null = null;
    for (let dy = -vision; dy <= vision; dy += 1) {
      for (let dx = -vision; dx <= vision; dx += 1) {
        const tx = x + dx;
        const ty = y + dy;
        if (tx < 0 || ty < 0 || tx >= width || ty >= height) continue;
        const idx = ty * width + tx;
        if (!predicate(idx)) continue;
        const dist = Math.abs(dx) + Math.abs(dy);
        if (!best || dist < best.dist) best = { x: tx, y: ty, dist };
      }
    }
    return best ? { x: best.x, y: best.y } : null;
  };

  if (actionMeta.name === "WANDER") {
    const typeId = view.getEntityType(entityIndex);
    const scoutId = entitySpecRef?.units.scout.type_id ?? 200;
    if (typeId === scoutId) {
      const board = ensureBlackboard(view.getEntityFaction(entityIndex));
      const known = findNearestKnown(
        view.getEntityFaction(entityIndex),
        x,
        y,
        board.forests,
        (idx) => view.getFeature(idx) === 100
      );
      if (known) {
        view.setEntityTargetX(entityIndex, known.x);
        view.setEntityTargetY(entityIndex, known.y);
        moveTowardTarget();
        return;
      }
    }
    const options = [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1]
    ].filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < width && ny < height && isWalkable(nx, ny));
    if (options.length > 0) {
      const pick = options[Math.floor(randomFn() * options.length)];
      view.setEntityX(entityIndex, pick[0]);
      view.setEntityY(entityIndex, pick[1]);
      view.setEntityAnimationFrame(entityIndex, (view.getEntityAnimationFrame(entityIndex) + 1) % 2);
    } else {
      view.setEntityAnimationFrame(entityIndex, 0);
    }
    view.setEntityActionProgress(entityIndex, 0);
    return;
  }

  if (actionMeta?.name === "CHOP_WOOD") {
    const faction = view.getEntityFaction(entityIndex);
    const board = ensureBlackboard(faction);
    const visible = findNearestInVision((idx) => view.getFeature(idx) === 100);
    const known = visible
      ? visible
      : findNearestKnown(faction, x, y, board.forests, (idx) => view.getFeature(idx) === 100);
    if (known) {
      view.setEntityTargetX(entityIndex, known.x);
      view.setEntityTargetY(entityIndex, known.y);
    } else {
      ensureTarget((tx, ty) => view.getFeature(ty * width + tx) === 100);
    }
    if (!atTarget()) {
      moveTowardTarget();
      return;
    }
    const tx = view.getEntityTargetX(entityIndex);
    const ty = view.getEntityTargetY(entityIndex);
    if (!hasValidTarget(tx, ty, (sx, sy) => view.getFeature(sy * width + sx) === 100)) {
      view.setEntityActionProgress(entityIndex, 0);
      view.setEntityTargetX(entityIndex, INVALID_TARGET);
      view.setEntityTargetY(entityIndex, INVALID_TARGET);
      return;
    }
    const next = Math.min(100, view.getEntityActionProgress(entityIndex) + progressStep);
    view.setEntityActionProgress(entityIndex, next);
    if (next >= 100) {
      view.setFeature(ty * width + tx, 0);
      view.setEntityWood(entityIndex, Math.min(255, view.getEntityWood(entityIndex) + 1));
      ensureChronicle(faction).total_resources_gathered.wood += 1;
      view.setEntityActionProgress(entityIndex, 0);
      logEvent({ event_type: "UNIT_ACTION", level: "INFO", action: "CHOP_WOOD", entity_id: entityIndex });
      logEvent({
        event_type: "ECONOMY_UPDATE",
        level: "ECONOMY",
        entity_id: entityIndex,
        wood: view.getEntityWood(entityIndex),
        food: view.getEntityFood(entityIndex)
      });
    }
    return;
  }

  if (actionMeta?.name === "GATHER_FOOD") {
    const faction = view.getEntityFaction(entityIndex);
    const board = ensureBlackboard(faction);
    const visible = findNearestInVision((idx) => foodTerrainIds.has(view.getTerrain(idx)));
    const known = visible
      ? visible
      : findNearestKnown(faction, x, y, board.food, (idx) => foodTerrainIds.has(view.getTerrain(idx)));
    if (known) {
      view.setEntityTargetX(entityIndex, known.x);
      view.setEntityTargetY(entityIndex, known.y);
    } else {
      ensureTarget((tx, ty) => foodTerrainIds.has(view.getTerrain(ty * width + tx)));
    }
    if (!atTarget()) {
      moveTowardTarget();
      return;
    }
    const tx = view.getEntityTargetX(entityIndex);
    const ty = view.getEntityTargetY(entityIndex);
    if (!hasValidTarget(tx, ty, (sx, sy) => foodTerrainIds.has(view.getTerrain(sy * width + sx)))) {
      view.setEntityActionProgress(entityIndex, 0);
      view.setEntityTargetX(entityIndex, INVALID_TARGET);
      view.setEntityTargetY(entityIndex, INVALID_TARGET);
      return;
    }
    const next = Math.min(100, view.getEntityActionProgress(entityIndex) + progressStep);
    view.setEntityActionProgress(entityIndex, next);
    if (next >= 100) {
      view.setEntityFood(entityIndex, Math.min(255, view.getEntityFood(entityIndex) + 1));
      ensureChronicle(faction).total_resources_gathered.food += 1;
      view.setEntityActionProgress(entityIndex, 0);
      logEvent({ event_type: "UNIT_ACTION", level: "INFO", action: "GATHER_FOOD", entity_id: entityIndex });
      logEvent({
        event_type: "ECONOMY_UPDATE",
        level: "ECONOMY",
        entity_id: entityIndex,
        wood: view.getEntityWood(entityIndex),
        food: view.getEntityFood(entityIndex)
      });
    }
    return;
  }

  if (actionMeta?.name === "DELIVER") {
    let tx = view.getEntityTargetX(entityIndex);
    let ty = view.getEntityTargetY(entityIndex);
    if (!hasValidTarget(tx, ty, (sx, sy) => view.getBuilding(sy * width + sx) === 300)) {
      ensureTarget((sx, sy) => view.getBuilding(sy * width + sx) === 300);
      tx = view.getEntityTargetX(entityIndex);
      ty = view.getEntityTargetY(entityIndex);
    }
    if (!hasValidTarget(tx, ty, (sx, sy) => view.getBuilding(sy * width + sx) === 300)) {
      view.setEntityActionProgress(entityIndex, 0);
      view.setEntityTargetX(entityIndex, INVALID_TARGET);
      view.setEntityTargetY(entityIndex, INVALID_TARGET);
      return;
    }
    if (!atTarget()) {
      moveTowardTarget();
      return;
    }
    const idx = ty * width + tx;
    if (view.getBuilding(idx) !== 300) {
      view.setEntityActionProgress(entityIndex, 0);
      return;
    }
    const next = Math.min(100, view.getEntityActionProgress(entityIndex) + progressStep);
    view.setEntityActionProgress(entityIndex, next);
    if (next >= 100) {
      const wood = view.getEntityWood(entityIndex);
      const stored = (buffersRef!.building_storage as Uint16Array)[idx] ?? 0;
      (buffersRef!.building_storage as Uint16Array)[idx] = stored + wood;
      view.setEntityWood(entityIndex, 0);
      view.setEntityActionProgress(entityIndex, 0);
      logEvent({ event_type: "UNIT_ACTION", level: "INFO", action: "DELIVER", entity_id: entityIndex });
      logEvent({ event_type: "ECONOMY_UPDATE", level: "ECONOMY", entity_id: entityIndex, wood: 0 });
    }
    return;
  }

  if (actionMeta?.name === "ATTACK") {
    const enemyIndex = findEnemyInRangeByType(entityIndex);
    if (enemyIndex === null) {
      const faction = view.getEntityFaction(entityIndex);
      const board = ensureBlackboard(faction);
      const knownWorker = findNearestKnown(
        faction,
        x,
        y,
        board.enemyWorkers,
        (idx) => {
          const tx = idx % width;
          const ty = Math.floor(idx / width);
          const ent = findEntityAtTile(tx, ty);
          if (ent === null) return false;
          const enemyFaction = view.getEntityFaction(ent);
          const enemyType = view.getEntityType(ent);
          const workerId = entitySpecRef?.units.worker.type_id ?? 201;
          if (enemyFaction === faction || enemyType !== workerId) return false;
          const home = homeByFaction.get(enemyFaction);
          const dist = home ? Math.abs(view.getEntityX(ent) - home.x) + Math.abs(view.getEntityY(ent) - home.y) : 99;
          return dist > 5;
        }
      );
      if (knownWorker) {
        view.setEntityTargetX(entityIndex, knownWorker.x);
        view.setEntityTargetY(entityIndex, knownWorker.y);
        moveTowardTarget();
        return;
      }
      const knownBase = findNearestKnown(
        faction,
        x,
        y,
        board.enemyBases,
        (idx) => {
          if (view.getBuilding(idx) !== 300) return false;
          const owner = buildingOwner.get(idx);
          return owner !== undefined && owner !== faction;
        }
      );
      if (knownBase) {
        view.setEntityTargetX(entityIndex, knownBase.x);
        view.setEntityTargetY(entityIndex, knownBase.y);
        moveTowardTarget();
      }
      return;
    }
    const attackerX = view.getEntityX(entityIndex);
    const attackerY = view.getEntityY(entityIndex);
    const targetX = view.getEntityX(enemyIndex);
    const targetY = view.getEntityY(enemyIndex);
    attackLines.push({ from: [attackerX, attackerY], to: [targetX, targetY] });
    const defenderIdx = view.tileIndex(view.getEntityX(enemyIndex), view.getEntityY(enemyIndex));
    let defense = 1;
    const featureId = view.getFeature(defenderIdx);
    if (featureId === 102) defense = combatSpecRef?.rules.defense_multiplier_hills ?? 1.25;
    if (featureId === 100) defense = combatSpecRef?.rules.defense_multiplier_forest ?? 1.5;
    const baseDamage = combatSpecRef?.rules.base_damage ?? 10;
    const attackerType = view.getEntityType(entityIndex);
    const defenderType = view.getEntityType(enemyIndex);
    const attackerName = getUnitNameByType(attackerType);
    const defenderName = getUnitNameByType(defenderType);
    let counter = 1;
    if (attackerName && defenderName) {
      const key = `${attackerName}_vs_${defenderName}`;
      counter = combatSpecRef?.unit_counters[key] ?? 1;
    }
    const damage = (baseDamage * counter) / defense;
    const newHealth = view.getEntityHealth(enemyIndex) - damage;
    view.setEntityHealth(enemyIndex, Math.max(0, Math.floor(newHealth)));
    lastAttackerByEntity.set(enemyIndex, entityIndex);
    logEvent({ event_type: "COMBAT_HIT", level: "COMBAT", attacker: entityIndex, target: enemyIndex, damage });
    if (newHealth <= (combatSpecRef?.rules.death_threshold ?? 0)) {
      const attackerFaction = view.getEntityFaction(entityIndex);
      const defenderFaction = view.getEntityFaction(enemyIndex);
      ensureChronicle(attackerFaction).kills += 1;
      ensureChronicle(defenderFaction).losses += 1;
      view.setEntityId(enemyIndex, 0);
      view.setEntityType(enemyIndex, 0);
      view.setEntityFaction(enemyIndex, 0);
      view.setEntityHealth(enemyIndex, 0);
      view.setEntityActionId(enemyIndex, 0);
      view.setEntityActionProgress(enemyIndex, 0);
      logEvent({ event_type: "UNIT_DIED", level: "COMBAT", entity_id: enemyIndex, faction_id: defenderFaction });
    }
    return;
  }

  if (actionMeta?.name === "BUILD_HOUSE") {
    const faction = view.getEntityFaction(entityIndex);
    const requiredTech = entitySpecRef?.buildings.house?.required_tech;
    if (requiredTech && !hasTech(faction, requiredTech)) {
      view.setEntityActionProgress(entityIndex, 0);
      return;
    }
    const home = homeByFaction.get(view.getEntityFaction(entityIndex));
    const grassId = Object.values(worldSpecRef!.terrain_types).find((t) => t.id === 0)?.id ?? 0;
    if (home) {
      let found: { x: number; y: number } | null = null;
      let bestDist = Number.MAX_SAFE_INTEGER;
      for (let dy = -5; dy <= 5; dy += 1) {
        for (let dx = -5; dx <= 5; dx += 1) {
          const tx = home.x + dx;
          const ty = home.y + dy;
          if (tx < 0 || ty < 0 || tx >= width || ty >= height) continue;
          const idx = ty * width + tx;
          if (view.getTerrain(idx) !== grassId) continue;
          if (view.getBuilding(idx) !== 0) continue;
          const dist = Math.abs(dx) + Math.abs(dy);
          if (dist < bestDist) {
            bestDist = dist;
            found = { x: tx, y: ty };
          }
        }
      }
      if (found) {
        view.setEntityTargetX(entityIndex, found.x);
        view.setEntityTargetY(entityIndex, found.y);
      }
    } else {
      ensureTarget((tx, ty) => {
        const idx = ty * width + tx;
        return view.getTerrain(idx) === grassId && view.getBuilding(idx) === 0;
      });
    }
    if (!atTarget()) {
      moveTowardTarget();
      return;
    }
    const tx = view.getEntityTargetX(entityIndex);
    const ty = view.getEntityTargetY(entityIndex);
    const next = Math.min(100, view.getEntityActionProgress(entityIndex) + progressStep);
    view.setEntityActionProgress(entityIndex, next);
    if (next >= 100) {
      view.setBuilding(ty * width + tx, 300);
      buildingOwner.set(ty * width + tx, view.getEntityFaction(entityIndex));
      const faction = view.getEntityFaction(entityIndex);
      ensureChronicle(faction).houses_built += 1;
      view.setEntityWood(entityIndex, Math.max(0, view.getEntityWood(entityIndex) - 3));
      view.setEntityActionProgress(entityIndex, 0);
      logEvent({ event_type: "UNIT_ACTION", level: "INFO", action: "BUILD_HOUSE", entity_id: entityIndex });
      logEvent({
        event_type: "ECONOMY_UPDATE",
        level: "ECONOMY",
        entity_id: entityIndex,
        wood: view.getEntityWood(entityIndex),
        food: view.getEntityFood(entityIndex)
      });
    }
  }

  if (actionMeta?.name === "FOUND_CITY") {
    const faction = view.getEntityFaction(entityIndex);
    if (!isValidCityPlacement(x, y, faction)) {
      const found = findNearestTile(
        x,
        y,
        width,
        height,
        isWalkable,
        (tx, ty) => isValidCityPlacement(tx, ty, faction),
        occupied
      );
      if (found) {
        view.setEntityTargetX(entityIndex, found.x);
        view.setEntityTargetY(entityIndex, found.y);
        moveTowardTarget();
      }
      return;
    }
    const next = Math.min(100, view.getEntityActionProgress(entityIndex) + progressStep);
    view.setEntityActionProgress(entityIndex, next);
    if (next >= 100) {
      const cityIndex = spawnCityEntity(faction, x, y);
      if (cityIndex !== null) {
        claimCityTerritory(cityIndex);
        logEvent({ event_type: "CITY_FOUNDED", level: "INFO", faction_id: faction, x, y });
      }
      view.setEntityActionProgress(entityIndex, 0);
    }
  }
}

function updateExploration(entityIndex: number, width: number) {
  const view = stateViewRef!;
  const faction = view.getEntityFaction(entityIndex);
  const typeId = view.getEntityType(entityIndex);
  const scoutId = entitySpecRef?.units.scout.type_id ?? 200;
  const vision = getUnitVision(view.getEntityType(entityIndex)) + (typeId === scoutId ? 2 : 0);
  const ex = view.getEntityX(entityIndex);
  const ey = view.getEntityY(entityIndex);
  const board = ensureBlackboard(faction);
  for (let dy = -vision; dy <= vision; dy += 1) {
    for (let dx = -vision; dx <= vision; dx += 1) {
      const x = ex + dx;
      const y = ey + dy;
      if (x < 0 || y < 0 || x >= view.width || y >= view.height) continue;
      const idx = view.tileIndex(x, y);
      view.setExploredBit(idx, faction);
      if (view.getFeature(idx) === 100) {
        board.forests.add(idx);
      }
      if (foodTerrainIds.has(view.getTerrain(idx))) {
        board.food.add(idx);
      }
      if (typeId === scoutId) {
        const building = view.getBuilding(idx);
        if (building === 300) {
          const owner = buildingOwner.get(idx);
          if (owner !== undefined && owner !== faction) {
            board.enemyBases.add(idx);
          }
        }
      }
    }
  }

  if (typeId === scoutId) {
    const workerId = entitySpecRef?.units.worker.type_id ?? 201;
    forEachNearbyEntity(ex, ey, vision, (i) => {
      if (view.getEntityId(i) === 0) return;
      const enemyFaction = view.getEntityFaction(i);
      if (enemyFaction === faction) return;
      const enemyType = view.getEntityType(i);
      if (enemyType !== workerId) return;
      const home = homeByFaction.get(enemyFaction);
      const dist = home ? Math.abs(view.getEntityX(i) - home.x) + Math.abs(view.getEntityY(i) - home.y) : 99;
      if (dist > 5) {
        const idx = view.tileIndex(view.getEntityX(i), view.getEntityY(i));
        board.enemyWorkers.add(idx);
      }
    });
  }
}

function getTilesExplored(entityIndex: number) {
  const view = stateViewRef!;
  const faction = view.getEntityFaction(entityIndex);
  return lastExploredCount.get(faction) ?? 1;
}

function buildStateFacts(entityIndex: number, width: number, height: number) {
  const view = stateViewRef!;
  const wood = view.getEntityWood(entityIndex);
  const x = view.getEntityX(entityIndex);
  const y = view.getEntityY(entityIndex);
  const idx = y * width + x;
  const facts: string[] = [];
  const faction = view.getEntityFaction(entityIndex);
  const board = ensureBlackboard(faction);
  if (view.getFeature(idx) === 100) facts.push("is_on_forest_tile");
  if (view.getFeature(idx) === 110) facts.push("is_on_fire_tile");
  const terrainId = view.getTerrain(idx);
  for (const def of Object.values(worldSpecRef!.terrain_types)) {
    if (def.id === terrainId && (def.yield?.food ?? 0) > 0) {
      facts.push("is_on_food_tile");
      break;
    }
  }
  if (wood >= 3) facts.push("has_wood_3");
  if (wood >= 3) facts.push("has_wood_to_store");
  const grassId = Object.values(worldSpecRef!.terrain_types).find((t) => t.id === 0)?.id ?? 0;
  if (terrainId === grassId) facts.push("is_on_grass_tile");
  if (hasTech(faction, "pottery")) facts.push("can_build_house");
  if (isValidCityPlacement(x, y, faction)) facts.push("is_on_valid_land");
  if (findEnemyInRangeByType(entityIndex) !== null) facts.push("enemy_in_range");
  if (isEnemyInVision(entityIndex)) facts.push("enemy_nearby");
  if (board.forests.size > 0) facts.push("forest_known");
  if (board.food.size > 0) facts.push("food_known");
  if (board.enemyWorkers.size > 0 || board.enemyBases.size > 0 || isEnemyInVision(entityIndex)) {
    facts.push("enemy_known");
  }
  const home = homeByFaction.get(faction);
  if (home && home.x === x && home.y === y) facts.push("is_at_home");
  return facts;
}

function stepCityGrowth() {
  if (!stateViewRef || !citySpecRef) return;
  const view = stateViewRef;
  for (let i = 0; i < view.entityCount; i += 1) {
    if (view.getEntityId(i) === 0) continue;
    if (!isCityEntity(view.getEntityType(i))) continue;
    const size = view.getEntityCitySize(i);
    const rule = getCityRule(size);
    if (!rule) continue;
    let food = view.getEntityCityFoodStockpile(i);
    let growth = view.getEntityCityGrowthPoints(i);
    food = Math.min(1000, food + 1);
    if (food > rule.food_consumption) {
      food -= rule.food_consumption;
      growth += 1;
    } else {
      food = Math.max(0, food - rule.food_consumption);
    }
    const nextRule = getCityRule(size + 1);
    if (nextRule && growth >= rule.threshold) {
      view.setEntityCitySize(i, size + 1);
      growth = 0;
      claimCityTerritory(i);
      logEvent({
        event_type: "CITY_GROWTH",
        level: "INFO",
        faction_id: view.getEntityFaction(i),
        city_id: i,
        size: size + 1
      });
    }
    view.setEntityCityFoodStockpile(i, food);
    view.setEntityCityGrowthPoints(i, growth);
  }
}

function chooseAutoResearch(factionId: number) {
  if (!techManagerRef || !techSpecRef) return;
  const state = techManagerRef.getState(factionId);
  if (state.current) return;
  const known = techManagerRef.getKnown(factionId);
  const pickOrder = ["mining", "agriculture", "hunting", "pottery"];
  let target: string | null = null;
  for (const techId of pickOrder) {
    if (!known.has(techId) && techSpecRef.techs[techId]) {
      target = techId;
      break;
    }
  }
  if (!target) return;
  const ok = techManagerRef.startResearch(factionId, target);
  if (ok) {
    logEvent({ event_type: "RESEARCH_TARGET", level: "INFO", faction_id: factionId, tech: target });
  }
}

function computeInputs(entityIndex: number, width: number) {
  const view = stateViewRef!;
  const faction = view.getEntityFaction(entityIndex);
  const board = ensureBlackboard(faction);
  const home = homeByFaction.get(faction);
  let enemyNearHome = 0;
  if (home) {
    forEachNearbyEntity(home.x, home.y, 10, (i) => {
      if (view.getEntityId(i) === 0) return;
      if (view.getEntityFaction(i) === faction) return;
      const enemyIdx = view.tileIndex(view.getEntityX(i), view.getEntityY(i));
      if ((view.getExplored(enemyIdx) & (1 << faction)) === 0) return;
      const dist = Math.abs(view.getEntityX(i) - home.x) + Math.abs(view.getEntityY(i) - home.y);
      if (dist <= 10) {
        enemyNearHome = 1;
        return true;
      }
    });
  }
  const ownMil = (lastFactionMilitary.get(faction) ?? 0);
  const enemyMil = (lastFactionEnemyMilitary.get(faction) ?? 0);
  const ratio = enemyMil > 0 ? ownMil / enemyMil : 0;
  const known = techManagerRef?.getKnown(faction) ?? new Set<string>();
  return {
    enemy_nearby: isEnemyInVision(entityIndex) ? 1 : 0,
    enemy_known: board.enemyWorkers.size > 0 || board.enemyBases.size > 0 || isEnemyInVision(entityIndex) ? 1 : 0,
    health: view.getEntityHealth(entityIndex),
    hunger: view.getEntityHunger(entityIndex),
    wood: view.getEntityWood(entityIndex),
    city_count: countFactionCities(faction),
    house_count: countFactionHouses(faction),
    has_pottery: known.has("pottery") ? 1 : 0,
    tiles_explored: getTilesExplored(entityIndex),
    enemy_near_home: enemyNearHome,
    military_strength_ratio: ratio
  };
}

self.onmessage = async (ev: MessageEvent<InitMessage>) => {
  if (ev.data.type === "ai_tick") {
    if (!unitBehaviorSpecRef) return;
    const { factionId, inputs, stateFacts } = ev.data as AiTickMessage;
    const utilities = computeUtilities(unitBehaviorSpecRef, inputs);
    const actions: ActionDef[] = Object.entries(unitBehaviorSpecRef.actions).map(
      ([name, def]) => ({ name, cost: def.cost, pre: def.pre, eff: def.eff })
    );
    const { goalKey, goalEffect, plan } = pickGoalWithPlan(
      unitBehaviorSpecRef,
      utilities,
      actions,
      new Set(stateFacts)
    );
    logEvent({
      event_type: "AI_PLAN_CHANGE",
      faction_id: factionId,
      goal: goalKey,
      utilities,
      plan: plan.map((p) => p.name),
      reason: "utility_top_goal"
    });
    flushLogs();
    return;
  }
  if (ev.data.type === "world_mutation") {
    if (!stateViewRef || !worldSpecRef) return;
    const view = stateViewRef;
    const { width, height } = worldSpecRef.config.dimensions;
    const req = ev.data as WorldMutationMessage;
    for (const mutation of req.mutations) {
      const x = mutation.x;
      const y = mutation.y;
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      const idx = view.tileIndex(x, y);
      if (typeof mutation.terrain === "number") {
        view.setTerrain(idx, mutation.terrain);
        if (mutation.terrain === 8 || mutation.terrain === 5) {
          view.setFeature(idx, 0);
          view.setBuilding(idx, 0);
          buildingOwner.delete(idx);
        }
      }
      if (typeof mutation.feature === "number") {
        view.setFeature(idx, mutation.feature);
      }
      if (typeof mutation.building === "number") {
        view.setBuilding(idx, mutation.building);
        if (mutation.building === 300) {
          buildingOwner.set(idx, 0);
        } else if (mutation.building === 0) {
          buildingOwner.delete(idx);
        }
      }
      logEvent({ event_type: "WORLD_MUTATION", level: "INFO", x, y, ...mutation });
    }
    flushLogs();
    return;
  }
  if (ev.data.type === "set_research_target") {
    const req = ev.data as SetResearchTargetMessage;
    if (!techManagerRef) return;
    const ok = techManagerRef.startResearch(req.factionId, req.techId);
    logEvent({
      event_type: "RESEARCH_TARGET",
      level: "INFO",
      faction_id: req.factionId,
      tech: req.techId,
      accepted: ok
    });
    flushLogs();
    return;
  }
  if (ev.data.type === "export_chronicle") {
    if (!exportSpecRef || !worldSpecRef || !techManagerRef) return;
    const payload = buildExportPayload(exportSpecRef);
    self.postMessage({ type: "export_data", payload });
    return;
  }
  if (ev.data.type === "sim_tick") {
    const { entityIndices } = ev.data as SimTickMessage;
    if (!buffersRef || !stateViewRef || !entitySpecRef) return;
    if (matchOverSent) return;
    const tickStart = performance.now();
    pathfindingCalls = 0;
    const view = stateViewRef;
    const { width, height } = worldSpecRef!.config.dimensions;
    const count = view.entityCount;
    const indices =
      entityIndices && entityIndices.length > 0
        ? entityIndices
        : Array.from({ length: count }, (_, i) => i);
    attackLines.length = 0;
    rebuildSpatialIndex(view);

    if (simTick % 2 === 0) {
      stepFire(view, {
        logEvent,
        buildingOwner,
        rng: randomFn
      });
    }

    if (simTick % 20 === 0) {
      stepLavaHeat(view, { logEvent });
    }

    if (simTick % 100 === 0) {
      stepTreeGrowth(view, { rng: randomFn });
    }

    stepCityGrowth();

    if (simTick % 5 === 0) {
      for (let i = 0; i < count; i += 1) {
        if (view.getEntityId(i) === 0) continue;
        view.setEntityHunger(i, Math.min(100, view.getEntityHunger(i) + 1));
      }
    }

    if (techManagerRef) {
      for (const factionId of homeByFaction.keys()) {
        chooseAutoResearch(factionId);
        const completed = techManagerRef.tickResearch(factionId, 1);
        if (completed) {
          ensureChronicle(factionId).tech_order.push(completed);
          logEvent({ event_type: "TECH_UNLOCKED", level: "INFO", faction_id: factionId, tech: completed });
        }
      }
    }

    if (simTick % 50 === 0) {
      const houseLimitPerHouse = 10;
      const housesPerFaction: Record<number, number> = {};
      const population: Record<number, number> = {};
      const unitTypeIds = new Set(Object.values(entitySpecRef.units).map((u) => u.type_id));
      for (let i = 0; i < count; i += 1) {
        if (view.getEntityId(i) === 0) continue;
        if (unitTypeIds.has(view.getEntityType(i))) {
          const faction = view.getEntityFaction(i);
          population[faction] = (population[faction] ?? 0) + 1;
        }
      }
      for (let i = 0; i < view.width * view.height; i += 1) {
        if (view.getBuilding(i) === 300) {
          const faction = buildingOwner.get(i) ?? 0;
          housesPerFaction[faction] = (housesPerFaction[faction] ?? 0) + 1;
        }
      }
      for (let i = 0; i < view.width * view.height; i += 1) {
        if (view.getBuilding(i) !== 300) continue;
        const faction = buildingOwner.get(i) ?? 0;
        const limit = (housesPerFaction[faction] ?? 0) * houseLimitPerHouse;
        const current = population[faction] ?? 0;
        if (current >= limit) continue;
        const storage = (buffersRef.building_storage as Uint16Array)[i] ?? 0;
        const unitType = chooseProductionUnit(faction, storage, randomFn);
        if (!unitType) continue;
        const unitDef = getUnitDefByType(unitType);
        if (unitDef?.required_tech && !hasTech(faction, unitDef.required_tech)) continue;
        const cost = getUnitCost(unitType);
        if (storage < cost || cost <= 0) continue;
        const x = i % width;
        const y = Math.floor(i / width);
        (buffersRef.building_storage as Uint16Array)[i] = Math.max(0, storage - cost);
        const result = spawnUnit(
          buffersRef,
          worldSpecRef!,
          homeByFaction,
          entitySpecRef.config.base_health_all_units,
          unitType,
          faction,
          x,
          y,
          randomFn
        );
        if (result.success) {
          ensureChronicle(faction).produced_units[unitType] =
            (ensureChronicle(faction).produced_units[unitType] ?? 0) + 1;
          logEvent({ event_type: "UNIT_SPAWN", level: "INFO", entity_id: result.entityIndex, unit_type: unitType });
          logEvent({ event_type: "HOUSE_PRODUCED_UNIT", level: "INFO", building_idx: i, faction_id: faction });
        }
      }
    }

    for (const idx of indices) {
      if (view.getEntityId(idx) === 0) continue;
      if (isCityEntity(view.getEntityType(idx))) continue;
      if (view.getEntityPlanLock(idx) > 0) {
        view.setEntityPlanLock(idx, view.getEntityPlanLock(idx) - 1);
      }
      updateExploration(idx, width);
      if (view.getEntityPlanLock(idx) === 0) {
        const inputs = computeInputs(idx, width);
        const utilities = computeUtilities(unitBehaviorSpecRef!, inputs);
        const actions: ActionDef[] = Object.entries(unitBehaviorSpecRef!.actions).map(
          ([name, def]) => ({ name, cost: def.cost, pre: def.pre, eff: def.eff })
        );
        const stateFacts = new Set(buildStateFacts(idx, width, height));
        const { goalKey, goalEffect, plan } = pickGoalWithPlan(
          unitBehaviorSpecRef!,
          utilities,
          actions,
          stateFacts
        );
        const topScore =
          unitBehaviorSpecRef!.goal_definitions[goalKey]?.utility_curve
            ? utilities[unitBehaviorSpecRef!.goal_definitions[goalKey].utility_curve] ?? 0
            : 0;
        const prev = lastDecision.get(idx);
        if (prev?.goal) {
          const prevCurve = unitBehaviorSpecRef!.goal_definitions[prev.goal]?.utility_curve;
          const prevScore = prevCurve ? utilities[prevCurve] ?? 0 : 0;
          if (prevScore + 10 >= topScore && view.getEntityActionId(idx) !== 0) {
            view.setEntityPlanLock(idx, 5);
            continue;
          }
        }
        const nextAction = plan[0]?.name;
        const nextId = nextAction ? actionIdByName.get(nextAction) ?? 0 : 0;
        view.setEntityActionId(idx, nextId);
        view.setEntityPlanLock(idx, 10);
        logEvent({
          event_type: "AI_PLAN_CHANGE",
          level: "DECISION",
          entity_id: idx,
          goal: goalKey,
          utilities,
          plan: plan.map((p) => p.name),
          reason: "utility_top_goal"
        });
        lastDecision.set(idx, { goal: goalKey, plan: plan.map((p) => p.name), utilities });
      }
      // recovery at home
      const home = homeByFaction.get(view.getEntityFaction(idx));
      if (home && view.getEntityX(idx) === home.x && view.getEntityY(idx) === home.y) {
        const rate = combatSpecRef?.rules.recovery_rate_at_home ?? 5;
        const max = entitySpecRef.config.base_health_all_units;
        view.setEntityHealth(idx, Math.min(max, view.getEntityHealth(idx) + rate));
      }
      tickAction(idx);
    }
    simTick += 1;
    const paths = Array.from(lastPaths.entries()).map(([entity_id, path]) => ({
      entity_id,
      path
    }));
    const entityDebug: Record<number, { goal?: string; plan?: string[]; utilities?: Record<string, number> }> =
      {};
    for (const [id, meta] of lastDecision.entries()) {
      entityDebug[id] = meta;
    }
    const stats = {
      population: {} as Record<number, number>,
      houses: {} as Record<number, number>,
      wood: {} as Record<number, number>,
      military: {} as Record<number, number>
    };
    const unitTypeIds = new Set(Object.values(entitySpecRef.units).map((u) => u.type_id));
    for (let i = 0; i < count; i += 1) {
      if (view.getEntityId(i) === 0) continue;
      const faction = view.getEntityFaction(i);
      const typeId = view.getEntityType(i);
      if (unitTypeIds.has(typeId)) {
        stats.population[faction] = (stats.population[faction] ?? 0) + 1;
      }
      stats.wood[faction] = (stats.wood[faction] ?? 0) + view.getEntityWood(i);
      const strength = getUnitStrength(typeId);
      stats.military[faction] =
        (stats.military[faction] ?? 0) + view.getEntityHealth(i) * strength;
    }
    for (let i = 0; i < view.width * view.height; i += 1) {
      if (view.getBuilding(i) === 300) {
        const faction = buildingOwner.get(i) ?? 0;
        stats.houses[faction] = (stats.houses[faction] ?? 0) + 1;
      }
    }
    lastFactionMilitary.clear();
    lastFactionEnemyMilitary.clear();
    lastExploredCount.clear();
    for (const [factionStr, mil] of Object.entries(stats.military)) {
      lastFactionMilitary.set(Number(factionStr), mil);
    }
    for (const [factionStr, mil] of Object.entries(stats.military)) {
      const faction = Number(factionStr);
      let enemySum = 0;
      for (let i = 0; i < count; i += 1) {
        if (view.getEntityId(i) === 0) continue;
        const enemyFaction = view.getEntityFaction(i);
        if (enemyFaction === faction) continue;
        const enemyIdx = view.tileIndex(view.getEntityX(i), view.getEntityY(i));
        if ((view.getExplored(enemyIdx) & (1 << faction)) === 0) continue;
        const strength = getUnitStrength(view.getEntityType(i));
        enemySum += view.getEntityHealth(i) * strength;
      }
      lastFactionEnemyMilitary.set(faction, enemySum);
      let exploredCount = 0;
      for (let i = 0; i < view.width * view.height; i += 1) {
        if (view.getExplored(i) & (1 << faction)) exploredCount += 1;
      }
      lastExploredCount.set(faction, exploredCount);
    }
    const buildingOwners: Record<number, number> = {};
    for (const [idx, faction] of buildingOwner.entries()) {
      buildingOwners[idx] = faction;
    }
    self.postMessage({ type: "tick", tick: simTick, paths, entityDebug, stats, buildingOwners, attackLines });
    const tickDuration = performance.now() - tickStart;
    perfSamples.push(tickDuration);
    if (perfSamples.length > 30) perfSamples.shift();
    if (simTick % 10 === 0) {
      const avg =
        perfSamples.reduce((sum, value) => sum + value, 0) / Math.max(1, perfSamples.length);
      const research: Record<number, { current: string | null; progress: number; cost: number; known: string[] }> =
        {};
      if (techManagerRef) {
        for (const factionId of homeByFaction.keys()) {
          research[factionId] = techManagerRef.getState(factionId);
        }
      }
      self.postMessage({
        type: "perf_stats",
        avg_tick_ms: avg,
        entity_count: count,
        pathfinding_calls_per_tick: pathfindingCalls,
        knowledge: snapshotKnowledge(),
        research,
        chronicles: snapshotChronicles()
      });
    }
    if (simTick % 20 === 0) {
      const mini = buildMinimapBuffer(view, 80);
      self.postMessage({ type: "minimap", buffer: mini.buffer }, [mini.buffer]);
    }
    if (simulationSpecRef?.victory_conditions?.conquest?.active) {
      const alive = new Set<number>();
      for (const [faction, pop] of Object.entries(stats.population)) {
        if ((pop ?? 0) > 0) alive.add(Number(faction));
      }
      for (const [faction, houses] of Object.entries(stats.houses)) {
        if ((houses ?? 0) > 0) alive.add(Number(faction));
      }
      if (alive.size <= 1 && simTick > 0) {
        matchOverSent = true;
        const winnerFactionId = alive.size === 1 ? Array.from(alive)[0] : -1;
        const winnerName =
          winnerFactionId === 0
            ? "Red"
            : winnerFactionId === 1
              ? "Blue"
              : `Faction ${winnerFactionId}`;
        let summary: Record<string, unknown> | null = null;
        if (winnerFactionId >= 0) {
          const chronicle = ensureChronicle(winnerFactionId);
          let topUnit: { id: number; count: number } | null = null;
          for (const [unitIdStr, count] of Object.entries(chronicle.produced_units)) {
            const id = Number(unitIdStr);
            if (!topUnit || count > topUnit.count) topUnit = { id, count };
          }
          const topName = topUnit ? getUnitNameByType(topUnit.id) ?? `Unit ${topUnit.id}` : "None";
          summary = {
            most_built_unit: topName,
            collected_wood: chronicle.total_resources_gathered.wood,
            fallen_units: chronicle.losses,
            researched_techs: Array.from(techManagerRef?.getKnown(winnerFactionId) ?? [])
          };
        }
        logEvent({
          event_type: "MATCH_OVER",
          level: "INFO",
          winner: winnerName,
          winner_faction: winnerFactionId,
          duration_ticks: simTick
        });
        flushLogs();
        self.postMessage({
          type: "match_over",
          winnerFactionId,
          winnerName,
          tick: simTick,
          knowledge: snapshotKnowledge(),
          summary
        });
      }
    }
    const flushInterval = loggingSpecRef?.config.flush_interval_ticks ?? 10;
    const maxBuffer = loggingSpecRef?.config.max_buffer_worker ?? 1000;
    if (simTick % flushInterval === 0 || logBuffer.length >= maxBuffer) {
      flushLogs();
    }
    return;
  }
  if (ev.data.type === "spawn_unit") {
    if (!buffersRef || !worldSpecRef) return;
    const req = ev.data as SpawnUnitMessage;
    const baseHealth = entitySpecRef?.config.base_health_all_units ?? 100;
    const result = spawnUnit(
      buffersRef,
      worldSpecRef,
      homeByFaction,
      baseHealth,
      req.unitType,
      req.factionId,
      req.x,
      req.y,
      randomFn
    );
    if (result.success) {
      logEvent({ event_type: "UNIT_SPAWN", level: "INFO", entity_id: result.entityIndex, unit_type: req.unitType });
    } else {
      logEvent({ event_type: "UNIT_SPAWN_FAILED", level: "INFO", reason: result.reason });
    }
    flushLogs();
    return;
  }
  if (ev.data.type === "set_forced_target") {
    if (!stateViewRef) return;
    const req = ev.data as { entityId: number; x: number; y: number };
    forcedTargets.set(req.entityId, { x: req.x, y: req.y });
    stateViewRef.setEntityTargetX(req.entityId, req.x);
    stateViewRef.setEntityTargetY(req.entityId, req.y);
    stateViewRef.setEntityActionProgress(req.entityId, 0);
    return;
  }
  if (ev.data.type !== "init") return;
  try {
    const [
      worldSpec,
      stateSpec,
      techSpec,
      unitBehaviorSpec,
      loggingSpec,
      combatSpec,
      entitySpec,
      simulationSpec,
      exportSpec,
      citySpec
    ] = await Promise.all([
      loadWorldSpec(ev.data.worldSpecUrl),
      loadStateSpec(ev.data.stateSpecUrl),
      loadTechSpec(ev.data.techSpecUrl),
      loadUnitBehaviorSpec(ev.data.unitBehaviorSpecUrl),
      loadLoggingSpec(ev.data.loggingSpecUrl),
      loadCombatSpec(ev.data.combatSpecUrl),
      loadEntitySpec(ev.data.entitySpecUrl),
      loadSimulationSpec(ev.data.simulationSpecUrl),
      loadExportSpec(ev.data.exportSpecUrl),
      loadCitySpec(ev.data.citySpecUrl)
    ]);
    const seed =
      worldSpec.generation_params?.seed ??
      ev.data.seed ??
      1337;
    const deterministic = worldSpec.generation_params?.use_deterministic_simulation ?? false;
    seedRef = seed;
    randomRef = deterministic ? new Random(seed) : null;
    randomFn = deterministic ? () => randomRef!.nextFloat() : Math.random;
    const useShared = typeof SharedArrayBuffer !== "undefined";
    const buffers = makeStateBuffers(stateSpec, worldSpec, useShared);
    buildTerrain(worldSpec, seed, buffers.terrain.buffer);
    const localView = new StateView(buffers, worldSpec, stateSpec);
    stateViewRef = localView;
    spatialIndexRef = createSpatialIndex(worldSpec.config.dimensions.width, worldSpec.config.dimensions.height, 4);
    seedForests(localView, worldSpec, randomFn);

    const techManager = new TechManager(techSpec);
    techManager.addFaction(0);
    techManager.addFaction(1);
    techManager.startResearch(0, "mining");
    techManagerRef = techManager;
    unitBehaviorSpecRef = unitBehaviorSpec;
    buildActionIdMap(unitBehaviorSpec);
    techSpecRef = techSpec;
    worldSpecRef = worldSpec;
    stateSpecRef = stateSpec;
    buffersRef = buffers;
    loggingSpecRef = loggingSpec;
    combatSpecRef = combatSpec;
    entitySpecRef = entitySpec;
    simulationSpecRef = simulationSpec;
    exportSpecRef = exportSpec;
    citySpecRef = citySpec;
    maxVisionRef = Math.max(1, ...Object.values(entitySpec.units).map((u) => u.vision));
    foodTerrainIds = new Set(
      Object.values(worldSpec.terrain_types)
        .filter((t) => (t.yield?.food ?? 0) > 0)
        .map((t) => t.id)
    );
    matchOverSent = false;
    perfSamples.length = 0;
    for (const key of Object.keys(knowledgeByFaction)) delete knowledgeByFaction[Number(key)];
    for (const key of Object.keys(chroniclesByFaction)) delete chroniclesByFaction[Number(key)];
    eventStream.decisions.length = 0;
    eventStream.combat.length = 0;
    eventStream.victory_milestones.length = 0;
    blackboardByFaction.clear();
    forcedTargets.clear();
    spawnInitialUnits();
    for (const [factionId, home] of homeByFaction.entries()) {
      const cityIndex = spawnCityEntity(factionId, home.x, home.y);
      if (cityIndex !== null) {
        claimCityTerritory(cityIndex);
        logEvent({ event_type: "CITY_FOUNDED", level: "INFO", faction_id: factionId, x: home.x, y: home.y });
      }
    }

    logEvent({ kind: "init", message: "world/state/tech loaded" });

    const payload: GenerateResult = {
      type: "state",
      worldSpec,
      stateSpec,
      techSpec,
      unitBehaviorSpec,
      loggingSpec,
      combatSpec,
      entitySpec,
      simulationSpec,
      exportSpec,
      buffers,
      shared: useShared
    };

    if (useShared) {
      self.postMessage(payload);
    } else {
      const transferables: ArrayBuffer[] = [
        buffers.terrain.buffer,
        buffers.feature.buffer,
        buffers.building.buffer,
        buffers.building_storage.buffer,
        buffers.height.buffer,
        buffers.explored.buffer,
        buffers.ownership.buffer,
        ...Object.values(buffers.entities).map((arr) => arr.buffer)
      ];
      self.postMessage(payload, transferables);
    }
    flushLogs();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const payload: ErrorMessage = { type: "error", message };
    self.postMessage(payload);
  }
};
