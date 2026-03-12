import {
  loadCombatSpec,
  loadEntitySpec,
  loadStateSpec,
  loadTechSpec,
  loadUnitBehaviorSpec,
  loadLoggingSpec,
  loadSimulationSpec,
  loadWorldSpec,
  type CombatSpec,
  type EntitySpec,
  type LoggingSpec,
  type SimulationSpec,
  type StateSpec,
  type TechSpec,
  type UnitBehaviorSpec,
  type WorldSpec
} from "./io/specLoader";
import { StateView } from "./state/StateView";
import { spawnUnit } from "./systems/spawn";
import { stepFire, stepLavaHeat, stepTreeGrowth } from "./systems/nature";

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
  seed?: number;
};

export type StateBuffers = {
  terrain: Uint8Array;
  feature: Uint8Array;
  building: Uint16Array;
  height: Int8Array;
  explored: Uint8Array;
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

function buildTerrain(spec: WorldSpec, seed: number, buffer?: ArrayBuffer): Uint8Array {
  const { width, height } = spec.config.dimensions;
  const terrain = buffer ? new Uint8Array(buffer) : new Uint8Array(width * height);
  const rng = lcg(seed);

  const entries = Object.values(spec.terrain_types);
  if (entries.length === 0) return terrain;

  for (let i = 0; i < terrain.length; i += 1) {
    const idx = Math.floor(rng() * entries.length);
    terrain[i] = entries[idx].id;
  }
  return terrain;
}

function seedForests(view: StateView, seed: number) {
  const width = view.width;
  const height = view.height;
  const rng = lcg(seed ^ 0x9e3779b9);
  const grassId = Object.values(worldSpecRef!.terrain_types).find((t) => t.id === 0)?.id ?? 0;
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
    spawnUnit(buffersRef, worldSpecRef, homeByFaction, baseHealth, workerId, spawn.faction, spawn.x, spawn.y);
    spawnUnit(buffersRef, worldSpecRef, homeByFaction, baseHealth, workerId, spawn.faction, spawn.x + 1, spawn.y);
    spawnUnit(buffersRef, worldSpecRef, homeByFaction, baseHealth, scoutId, spawn.faction, spawn.x, spawn.y + 1);
  }
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

  return { terrain, feature, building, height: heightBuf, explored, entities };
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

const logBuffer: Array<Record<string, unknown>> = [];
const knowledgeByFaction: Record<number, Record<string, number>> = {};
function logEvent(entry: Record<string, unknown>) {
  logBuffer.push({ ts: Date.now(), tick: simTick, ...entry });
  trackKnowledge(entry);
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

function snapshotKnowledge() {
  const snapshot: Record<number, Record<string, number>> = {};
  for (const [factionStr, data] of Object.entries(knowledgeByFaction)) {
    snapshot[Number(factionStr)] = { ...data };
  }
  return snapshot;
}

let unitBehaviorSpecRef: UnitBehaviorSpec | null = null;
let techManagerRef: TechManager | null = null;
let worldSpecRef: WorldSpec | null = null;
let stateSpecRef: StateSpec | null = null;
let buffersRef: StateBuffers | null = null;
let simTick = 0;
let loggingSpecRef: LoggingSpec | null = null;
let stateViewRef: StateView | null = null;
let combatSpecRef: CombatSpec | null = null;
let entitySpecRef: EntitySpec | null = null;
let simulationSpecRef: SimulationSpec | null = null;
let pathfindingCalls = 0;
let matchOverSent = false;

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

function getUnitDefByType(typeId: number) {
  if (!entitySpecRef) return null;
  return Object.values(entitySpecRef.units).find((u) => u.type_id === typeId) ?? null;
}

function getUnitVision(typeId: number) {
  return getUnitDefByType(typeId)?.vision ?? 1;
}

function getUnitStrength(typeId: number) {
  return getUnitDefByType(typeId)?.strength ?? 0;
}

function isCombatUnit(typeId: number) {
  return getUnitDefByType(typeId)?.is_combat ?? false;
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
  for (let i = 0; i < view.entityCount; i += 1) {
    if (view.getEntityId(i) === 0) continue;
    if (view.getEntityFaction(i) === selfFaction) continue;
    const enemyIdx = view.tileIndex(view.getEntityX(i), view.getEntityY(i));
    if ((view.getExplored(enemyIdx) & (1 << selfFaction)) === 0) continue;
    const ex = view.getEntityX(i);
    const ey = view.getEntityY(i);
    const dx = Math.abs(ex - sx);
    const dy = Math.abs(ey - sy);
    if (dx <= range && dy <= range) return i;
  }
  return null;
}

function isEnemyInVision(entityIndex: number) {
  if (!stateViewRef) return false;
  const view = stateViewRef;
  const selfFaction = view.getEntityFaction(entityIndex);
  const sx = view.getEntityX(entityIndex);
  const sy = view.getEntityY(entityIndex);
  const vision = getUnitVision(view.getEntityType(entityIndex));
  for (let i = 0; i < view.entityCount; i += 1) {
    if (view.getEntityId(i) === 0) continue;
    if (view.getEntityFaction(i) === selfFaction) continue;
    const enemyIdx = view.tileIndex(view.getEntityX(i), view.getEntityY(i));
    if ((view.getExplored(enemyIdx) & (1 << selfFaction)) === 0) continue;
    const ex = view.getEntityX(i);
    const ey = view.getEntityY(i);
    const dx = Math.abs(ex - sx);
    const dy = Math.abs(ey - sy);
    if (dx <= vision && dy <= vision) return true;
  }
  return false;
}

function enemyThreatCost(tx: number, ty: number, factionId: number) {
  if (!stateViewRef) return 0;
  const view = stateViewRef;
  const idx = view.tileIndex(tx, ty);
  if ((view.getExplored(idx) & (1 << factionId)) === 0) return 0;
  for (let i = 0; i < view.entityCount; i += 1) {
    if (view.getEntityId(i) === 0) continue;
    const enemyFaction = view.getEntityFaction(i);
    if (enemyFaction === factionId) continue;
    if ((hateMatrix[factionId]?.[enemyFaction] ?? 0) <= 0) continue;
    const vision = getUnitVision(view.getEntityType(i));
    const dx = Math.abs(view.getEntityX(i) - tx);
    const dy = Math.abs(view.getEntityY(i) - ty);
    if (dx <= vision && dy <= vision) return 20;
  }
  return 0;
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
  const startIdx = startY * width + startX;
  const goalIdx = goalY * width + goalX;
  const open: number[] = [startIdx];
  const cameFrom = new Int32Array(width * height).fill(-1);
  const gScore = new Float32Array(width * height).fill(Number.POSITIVE_INFINITY);
  gScore[startIdx] = 0;
  const fScore = new Float32Array(width * height).fill(Number.POSITIVE_INFINITY);
  fScore[startIdx] = Math.abs(goalX - startX) + Math.abs(goalY - startY);

  while (open.length > 0) {
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

  const isWalkable = (tx: number, ty: number) => view.isWalkable(tx, ty);

  const occupied = buildOccupancy(buffers, width, height);
  const idx = y * width + x;
  occupied.delete(idx);

  const ensureTarget = (predicate: (tx: number, ty: number) => boolean) => {
    const tx = view.getEntityTargetX(entityIndex);
    const ty = view.getEntityTargetY(entityIndex);
    if (tx < width && ty < height) return;
    const found = findNearestTile(x, y, width, height, isWalkable, predicate, occupied);
    if (found) {
      view.setEntityTargetX(entityIndex, found.x);
      view.setEntityTargetY(entityIndex, found.y);
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
      lastPaths.set(entityIndex, path);
    }
  };

  if (actionMeta.name === "WANDER") {
    const options = [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1]
    ].filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < width && ny < height && isWalkable(nx, ny));
    if (options.length > 0) {
      const pick = options[Math.floor(Math.random() * options.length)];
      view.setEntityX(entityIndex, pick[0]);
      view.setEntityY(entityIndex, pick[1]);
    }
    view.setEntityActionProgress(entityIndex, 0);
    return;
  }

  if (actionMeta?.name === "CHOP_WOOD") {
    ensureTarget((tx, ty) => view.getFeature(ty * width + tx) === 100);
    if (!atTarget()) {
      moveTowardTarget();
      return;
    }
    const tx = view.getEntityTargetX(entityIndex);
    const ty = view.getEntityTargetY(entityIndex);
    const next = Math.min(100, view.getEntityActionProgress(entityIndex) + progressStep);
    view.setEntityActionProgress(entityIndex, next);
    if (next >= 100) {
      view.setFeature(ty * width + tx, 0);
      view.setEntityWood(entityIndex, Math.min(255, view.getEntityWood(entityIndex) + 1));
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
    ensureTarget((tx, ty) => {
      const terrainId = view.getTerrain(ty * width + tx);
      for (const def of Object.values(worldSpecRef!.terrain_types)) {
        if (def.id === terrainId) return (def.yield?.food ?? 0) > 0;
      }
      return false;
    });
    if (!atTarget()) {
      moveTowardTarget();
      return;
    }
    const tx = view.getEntityTargetX(entityIndex);
    const ty = view.getEntityTargetY(entityIndex);
    const next = Math.min(100, view.getEntityActionProgress(entityIndex) + progressStep);
    view.setEntityActionProgress(entityIndex, next);
    if (next >= 100) {
      view.setEntityFood(entityIndex, Math.min(255, view.getEntityFood(entityIndex) + 1));
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

  if (actionMeta?.name === "ATTACK") {
    const enemyIndex = findEnemyInRange(entityIndex, 1);
    if (enemyIndex === null) return;
    const defenderIdx = view.tileIndex(view.getEntityX(enemyIndex), view.getEntityY(enemyIndex));
    let defense = 1;
    const featureId = view.getFeature(defenderIdx);
    if (featureId === 102) defense = combatSpecRef?.rules.defense_multiplier_hills ?? 1.25;
    if (featureId === 100) defense = combatSpecRef?.rules.defense_multiplier_forest ?? 1.5;
    const baseDamage = combatSpecRef?.rules.base_damage ?? 10;
    const attackerType = view.getEntityType(entityIndex);
    const defenderType = view.getEntityType(enemyIndex);
    const attackerName = Object.keys(entitySpecRef!.units).find(
      (k) => entitySpecRef!.units[k].type_id === attackerType
    );
    const defenderName = Object.keys(entitySpecRef!.units).find(
      (k) => entitySpecRef!.units[k].type_id === defenderType
    );
    let counter = 1;
    if (attackerName && defenderName) {
      const key = `${attackerName}_vs_${defenderName}`;
      counter = combatSpecRef?.unit_counters[key] ?? 1;
    }
    const damage = (baseDamage * counter) / defense;
    const newHealth = view.getEntityHealth(enemyIndex) - damage;
    view.setEntityHealth(enemyIndex, Math.max(0, Math.floor(newHealth)));
    logEvent({ event_type: "COMBAT_HIT", level: "COMBAT", attacker: entityIndex, target: enemyIndex, damage });
    if (newHealth <= (combatSpecRef?.rules.death_threshold ?? 0)) {
      view.setEntityId(enemyIndex, 0);
      view.setEntityType(enemyIndex, 0);
      view.setEntityFaction(enemyIndex, 0);
      view.setEntityHealth(enemyIndex, 0);
      view.setEntityActionId(enemyIndex, 0);
      view.setEntityActionProgress(enemyIndex, 0);
      logEvent({ event_type: "UNIT_DIED", level: "COMBAT", entity_id: enemyIndex });
    }
    return;
  }

  if (actionMeta?.name === "BUILD_HOUSE") {
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
}

function updateExploration(entityIndex: number, width: number) {
  const view = stateViewRef!;
  const faction = view.getEntityFaction(entityIndex);
  const vision = getUnitVision(view.getEntityType(entityIndex));
  const ex = view.getEntityX(entityIndex);
  const ey = view.getEntityY(entityIndex);
  for (let dy = -vision; dy <= vision; dy += 1) {
    for (let dx = -vision; dx <= vision; dx += 1) {
      const x = ex + dx;
      const y = ey + dy;
      if (x < 0 || y < 0 || x >= view.width || y >= view.height) continue;
      const idx = view.tileIndex(x, y);
      view.setExploredBit(idx, faction);
    }
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
  facts.push("is_on_grass_tile");
  if (findEnemyInRange(entityIndex, 1) !== null) facts.push("enemy_in_range");
  if (isEnemyInVision(entityIndex)) facts.push("enemy_nearby");
  return facts;
}

function computeInputs(entityIndex: number, width: number) {
  const view = stateViewRef!;
  const faction = view.getEntityFaction(entityIndex);
  const home = homeByFaction.get(faction);
  let enemyNearHome = 0;
  if (home) {
    for (let i = 0; i < view.entityCount; i += 1) {
      if (view.getEntityId(i) === 0) continue;
      if (view.getEntityFaction(i) === faction) continue;
      const enemyIdx = view.tileIndex(view.getEntityX(i), view.getEntityY(i));
      if ((view.getExplored(enemyIdx) & (1 << faction)) === 0) continue;
      const dist = Math.abs(view.getEntityX(i) - home.x) + Math.abs(view.getEntityY(i) - home.y);
      if (dist <= 10) {
        enemyNearHome = 1;
        break;
      }
    }
  }
  const ownMil = (lastFactionMilitary.get(faction) ?? 0);
  const enemyMil = (lastFactionEnemyMilitary.get(faction) ?? 1);
  const ratio = enemyMil > 0 ? ownMil / enemyMil : ownMil;
  return {
    enemy_nearby: isEnemyInVision(entityIndex) ? 1 : 0,
    health: view.getEntityHealth(entityIndex),
    hunger: view.getEntityHunger(entityIndex),
    wood: view.getEntityWood(entityIndex),
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
    const { goalKey, goalEffect } = pickTopGoal(unitBehaviorSpecRef, utilities);
    const actions: ActionDef[] = Object.entries(unitBehaviorSpecRef.actions).map(
      ([name, def]) => ({ name, cost: def.cost, pre: def.pre, eff: def.eff })
    );
    const plan = buildPlan(actions, goalEffect, new Set(stateFacts));
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

    if (simTick % 2 === 0) {
      stepFire(view, {
        logEvent,
        buildingOwner,
        rng: Math.random
      });
    }

    if (simTick % 20 === 0) {
      stepLavaHeat(view, { logEvent });
    }

    if (simTick % 100 === 0) {
      stepTreeGrowth(view, { rng: Math.random });
    }

    if (simTick % 5 === 0) {
      for (let i = 0; i < count; i += 1) {
        if (view.getEntityId(i) === 0) continue;
        view.setEntityHunger(i, Math.min(100, view.getEntityHunger(i) + 1));
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
        const x = i % width;
        const y = Math.floor(i / width);
        const result = spawnUnit(
          buffersRef,
          worldSpecRef!,
          homeByFaction,
          entitySpecRef.config.base_health_all_units,
          entitySpecRef.units.worker.type_id,
          faction,
          x,
          y
        );
        if (result.success) {
          logEvent({ event_type: "UNIT_SPAWN", level: "INFO", entity_id: result.entityIndex, unit_type: 201 });
        }
      }
    }

    for (const idx of indices) {
      if (view.getEntityId(idx) === 0) continue;
      if (view.getEntityPlanLock(idx) > 0) {
        view.setEntityPlanLock(idx, view.getEntityPlanLock(idx) - 1);
      }
      updateExploration(idx, width);
      if (view.getEntityPlanLock(idx) === 0) {
        const inputs = computeInputs(idx, width);
        const utilities = computeUtilities(unitBehaviorSpecRef!, inputs);
        const { goalKey, goalEffect } = pickTopGoal(unitBehaviorSpecRef!, utilities);
        const actions: ActionDef[] = Object.entries(unitBehaviorSpecRef!.actions).map(
          ([name, def]) => ({ name, cost: def.cost, pre: def.pre, eff: def.eff })
        );
        const plan = buildPlan(actions, goalEffect, new Set(buildStateFacts(idx, width, height)));
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
    self.postMessage({ type: "tick", tick: simTick, paths, entityDebug, stats, buildingOwners });
    const tickDuration = performance.now() - tickStart;
    perfSamples.push(tickDuration);
    if (perfSamples.length > 30) perfSamples.shift();
    if (simTick % 10 === 0) {
      const avg =
        perfSamples.reduce((sum, value) => sum + value, 0) / Math.max(1, perfSamples.length);
      self.postMessage({
        type: "perf_stats",
        avg_tick_ms: avg,
        entity_count: count,
        pathfinding_calls_per_tick: pathfindingCalls,
        knowledge: snapshotKnowledge()
      });
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
          knowledge: snapshotKnowledge()
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
      req.y
    );
    if (result.success) {
      logEvent({ event_type: "UNIT_SPAWN", level: "INFO", entity_id: result.entityIndex, unit_type: req.unitType });
    } else {
      logEvent({ event_type: "UNIT_SPAWN_FAILED", level: "INFO", reason: result.reason });
    }
    flushLogs();
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
      simulationSpec
    ] = await Promise.all([
      loadWorldSpec(ev.data.worldSpecUrl),
      loadStateSpec(ev.data.stateSpecUrl),
      loadTechSpec(ev.data.techSpecUrl),
      loadUnitBehaviorSpec(ev.data.unitBehaviorSpecUrl),
      loadLoggingSpec(ev.data.loggingSpecUrl),
      loadCombatSpec(ev.data.combatSpecUrl),
      loadEntitySpec(ev.data.entitySpecUrl),
      loadSimulationSpec(ev.data.simulationSpecUrl)
    ]);
    const seed = ev.data.seed ?? 1337;
    const useShared = typeof SharedArrayBuffer !== "undefined";
    const buffers = makeStateBuffers(stateSpec, worldSpec, useShared);
    buildTerrain(worldSpec, seed, buffers.terrain.buffer);
    const localView = new StateView(buffers, worldSpec, stateSpec);
    stateViewRef = localView;
    seedForests(localView, seed);

    const techManager = new TechManager(techSpec);
    techManager.addFaction(0);
    techManager.addFaction(1);
    techManager.startResearch(0, "mining");
    techManagerRef = techManager;
    unitBehaviorSpecRef = unitBehaviorSpec;
    buildActionIdMap(unitBehaviorSpec);
    worldSpecRef = worldSpec;
    stateSpecRef = stateSpec;
    buffersRef = buffers;
    loggingSpecRef = loggingSpec;
    combatSpecRef = combatSpec;
    entitySpecRef = entitySpec;
    simulationSpecRef = simulationSpec;
    matchOverSent = false;
    perfSamples.length = 0;
    for (const key of Object.keys(knowledgeByFaction)) delete knowledgeByFaction[Number(key)];
    spawnInitialUnits();

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
        buffers.height.buffer,
        buffers.explored.buffer,
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
