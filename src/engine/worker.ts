import {
  loadStateSpec,
  loadTechSpec,
  loadUnitBehaviorSpec,
  loadWorldSpec,
  type StateSpec,
  type TechSpec,
  type UnitBehaviorSpec,
  type WorldSpec
} from "./io/specLoader";

type InitMessage = {
  type: "init";
  worldSpecUrl: string;
  stateSpecUrl: string;
  techSpecUrl: string;
  unitBehaviorSpecUrl: string;
  seed?: number;
};

export type StateBuffers = {
  terrain: Uint8Array;
  feature: Uint8Array;
  building: Uint16Array;
  height: Int8Array;
  entities: Record<string, Uint8Array | Uint16Array | Uint32Array>;
};

type GenerateResult = {
  type: "state";
  worldSpec: WorldSpec;
  stateSpec: StateSpec;
  techSpec: TechSpec;
  unitBehaviorSpec: UnitBehaviorSpec;
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

function seedForests(spec: WorldSpec, buffers: StateBuffers, seed: number) {
  const { width, height } = spec.config.dimensions;
  const rng = lcg(seed ^ 0x9e3779b9);
  const grassId = Object.values(spec.terrain_types).find((t) => t.id === 0)?.id ?? 0;
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
      if (buffers.terrain[idx] === grassId) break;
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
      if (buffers.terrain[idx] === grassId) {
        buffers.feature[idx] = 100;
      }
      const [dx, dy] = directions[Math.floor(rng() * directions.length)];
      x += dx;
      y += dy;
    }
  }
}

function spawnInitialUnits() {
  if (!buffersRef || !worldSpecRef) return;
  const buffers = buffersRef;
  const { width, height } = worldSpecRef.config.dimensions;
  const ids = buffers.entities.id as Uint32Array;
  const types = buffers.entities.type as Uint8Array;
  const factions = buffers.entities.faction_id as Uint8Array;
  const xs = buffers.entities.x as Uint16Array;
  const ys = buffers.entities.y as Uint16Array;
  const wood = buffers.entities.inventory_wood as Uint8Array;
  const food = buffers.entities.inventory_food as Uint8Array;
  const actionId = buffers.entities.current_action_id as Uint8Array;
  const progress = buffers.entities.action_progress as Uint8Array;
  const planLock = buffers.entities.plan_lock_ticks as Uint8Array;

  let spawned = 0;
  for (let i = 0; i < ids.length && spawned < 2; i += 1) {
    if (ids[i] !== 0) continue;
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const idx = y * width + x;
        if (buffers.feature[idx] !== 100) continue;
        const adj = [
          [x + 1, y],
          [x - 1, y],
          [x, y + 1],
          [x, y - 1]
        ];
        const spot = adj.find(([ax, ay]) => {
          const aIdx = ay * width + ax;
          return buffers.feature[aIdx] === 0 && buffers.terrain[aIdx] === buffers.terrain[idx];
        });
        if (!spot) continue;
        ids[i] = i + 1;
        types[i] = 201;
        factions[i] = 0;
        if (!homeByFaction.has(0)) {
          homeByFaction.set(0, { x: spot[0], y: spot[1] });
        }
        xs[i] = spot[0];
        ys[i] = spot[1];
        wood[i] = 0;
        food[i] = 0;
        actionId[i] = 0;
        progress[i] = 0;
        planLock[i] = 0;
        spawned += 1;
        break;
      }
      if (spawned >= 2) break;
    }
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

  return { terrain, feature, building, height: heightBuf, entities };
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
function logEvent(entry: Record<string, unknown>) {
  logBuffer.push({ ts: Date.now(), tick: simTick, ...entry });
}
function flushLogs() {
  if (logBuffer.length === 0) return;
  const payload: LogMessage = { type: "log", entries: logBuffer.splice(0, logBuffer.length) };
  self.postMessage(payload);
}

let unitBehaviorSpecRef: UnitBehaviorSpec | null = null;
let techManagerRef: TechManager | null = null;
let worldSpecRef: WorldSpec | null = null;
let stateSpecRef: StateSpec | null = null;
let buffersRef: StateBuffers | null = null;
let simTick = 0;

let actionById: Map<number, { name: string; progress_step: number }> = new Map();
let actionIdByName: Map<string, number> = new Map();
const exploredTiles: Map<number, Set<number>> = new Map();
const lastPaths: Map<number, Array<[number, number]>> = new Map();
const lastDecision: Map<number, { goal: string; plan: string[]; utilities: Record<string, number> }> = new Map();
const homeByFaction: Map<number, { x: number; y: number }> = new Map();

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
  const xs = buffers.entities.x as Uint16Array | undefined;
  const ys = buffers.entities.y as Uint16Array | undefined;
  const ids = buffers.entities.id as Uint32Array | undefined;
  if (!xs || !ys || !ids) return occupied;
  for (let i = 0; i < ids.length; i += 1) {
    if (ids[i] === 0) continue;
    const x = xs[i];
    const y = ys[i];
    if (x >= width || y >= height) continue;
    occupied.add(y * width + x);
  }
  return occupied;
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
  occupied: Set<number>
) {
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
      const tentative = gScore[current] + 1;
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
  if (!buffersRef || !worldSpecRef || !stateSpecRef) return;
  const buffers = buffersRef;
  const { width, height } = worldSpecRef.config.dimensions;
  const xs = buffers.entities.x as Uint16Array;
  const ys = buffers.entities.y as Uint16Array;
  const actionIds = buffers.entities.current_action_id as Uint8Array;
  const progress = buffers.entities.action_progress as Uint8Array;
  const targetX = buffers.entities.target_x as Uint16Array;
  const targetY = buffers.entities.target_y as Uint16Array;
  const inventoryWood = buffers.entities.inventory_wood as Uint8Array;
  const inventoryFood = buffers.entities.inventory_food as Uint8Array;

  const x = xs[entityIndex];
  const y = ys[entityIndex];
  const actionId = actionIds[entityIndex];
  const actionMeta = actionById.get(actionId);
  const progressStep = actionMeta?.progress_step ?? 0;
  if (!actionMeta) return;

  const isWalkable = (tx: number, ty: number) => {
    const terrainId = buffers.terrain[ty * width + tx];
    for (const def of Object.values(worldSpecRef!.terrain_types)) {
      if (def.id === terrainId) return def.walkable;
    }
    return true;
  };

  const occupied = buildOccupancy(buffers, width, height);
  const idx = y * width + x;
  occupied.delete(idx);

  const ensureTarget = (predicate: (tx: number, ty: number) => boolean) => {
    if (targetX[entityIndex] < width && targetY[entityIndex] < height) return;
    const found = findNearestTile(x, y, width, height, isWalkable, predicate, occupied);
    if (found) {
      targetX[entityIndex] = found.x;
      targetY[entityIndex] = found.y;
    }
  };

  const atTarget = () =>
    x === targetX[entityIndex] && y === targetY[entityIndex];

  const moveTowardTarget = () => {
    const path = aStarPath(x, y, targetX[entityIndex], targetY[entityIndex], width, height, isWalkable, occupied);
    if (path && path.length > 1) {
      const [nx, ny] = path[1];
      xs[entityIndex] = nx;
      ys[entityIndex] = ny;
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
      xs[entityIndex] = pick[0];
      ys[entityIndex] = pick[1];
    }
    progress[entityIndex] = 0;
    return;
  }

  if (actionMeta?.name === "CHOP_WOOD") {
    ensureTarget((tx, ty) => buffers.feature[ty * width + tx] === 100);
    if (!atTarget()) {
      moveTowardTarget();
      return;
    }
    const next = Math.min(100, progress[entityIndex] + progressStep);
    progress[entityIndex] = next;
    if (next >= 100) {
      buffers.feature[ty * width + tx] = 0;
      inventoryWood[entityIndex] = Math.min(255, inventoryWood[entityIndex] + 1);
      progress[entityIndex] = 0;
      logEvent({ event_type: "UNIT_ACTION", action: "CHOP_WOOD", entity_id: entityIndex });
      logEvent({
        event_type: "ECONOMY_UPDATE",
        entity_id: entityIndex,
        wood: inventoryWood[entityIndex],
        food: inventoryFood[entityIndex] ?? 0
      });
    }
    return;
  }

  if (actionMeta?.name === "GATHER_FOOD") {
    ensureTarget((tx, ty) => {
      const terrainId = buffers.terrain[ty * width + tx];
      for (const def of Object.values(worldSpecRef!.terrain_types)) {
        if (def.id === terrainId) return (def.yield?.food ?? 0) > 0;
      }
      return false;
    });
    if (!atTarget()) {
      moveTowardTarget();
      return;
    }
    const next = Math.min(100, progress[entityIndex] + progressStep);
    progress[entityIndex] = next;
    if (next >= 100) {
      inventoryFood[entityIndex] = Math.min(255, inventoryFood[entityIndex] + 1);
      progress[entityIndex] = 0;
      logEvent({ event_type: "UNIT_ACTION", action: "GATHER_FOOD", entity_id: entityIndex });
      logEvent({
        event_type: "ECONOMY_UPDATE",
        entity_id: entityIndex,
        wood: inventoryWood[entityIndex] ?? 0,
        food: inventoryFood[entityIndex]
      });
    }
    return;
  }

  if (actionMeta?.name === "BUILD_HOUSE") {
    const home = homeByFaction.get((buffers.entities.faction_id as Uint8Array)[entityIndex]);
    const grassId = Object.values(worldSpecRef!.terrain_types).find((t) => t.id === 0)?.id ?? 0;
    if (home) {
      const found = findNearestTile(
        home.x,
        home.y,
        width,
        height,
        isWalkable,
        (tx, ty) => {
          const idx = ty * width + tx;
          return buffers.terrain[idx] === grassId && buffers.building[idx] === 0;
        },
        occupied
      );
      if (found) {
        targetX[entityIndex] = found.x;
        targetY[entityIndex] = found.y;
      }
    } else {
      ensureTarget((tx, ty) => {
        const idx = ty * width + tx;
        return buffers.terrain[idx] === grassId && buffers.building[idx] === 0;
      });
    }
    if (!atTarget()) {
      moveTowardTarget();
      return;
    }
    const next = Math.min(100, progress[entityIndex] + progressStep);
    progress[entityIndex] = next;
    if (next >= 100) {
      buffers.building[ty * width + tx] = 300;
      inventoryWood[entityIndex] = Math.max(0, inventoryWood[entityIndex] - 3);
      progress[entityIndex] = 0;
      logEvent({ event_type: "UNIT_ACTION", action: "BUILD_HOUSE", entity_id: entityIndex });
      logEvent({
        event_type: "ECONOMY_UPDATE",
        entity_id: entityIndex,
        wood: inventoryWood[entityIndex],
        food: inventoryFood[entityIndex] ?? 0
      });
    }
  }
}

function updateExploration(entityIndex: number, width: number) {
  const buffers = buffersRef!;
  const xs = buffers.entities.x as Uint16Array;
  const ys = buffers.entities.y as Uint16Array;
  const idx = ys[entityIndex] * width + xs[entityIndex];
  let set = exploredTiles.get(entityIndex);
  if (!set) {
    set = new Set<number>();
    exploredTiles.set(entityIndex, set);
  }
  set.add(idx);
}

function getTilesExplored(entityIndex: number) {
  return exploredTiles.get(entityIndex)?.size ?? 1;
}

function buildStateFacts(entityIndex: number, width: number, height: number) {
  const buffers = buffersRef!;
  const xs = buffers.entities.x as Uint16Array;
  const ys = buffers.entities.y as Uint16Array;
  const wood = buffers.entities.inventory_wood as Uint8Array;
  const x = xs[entityIndex];
  const y = ys[entityIndex];
  const idx = y * width + x;
  const facts: string[] = [];
  if (buffers.feature[idx] === 100) facts.push("is_on_forest_tile");
  if (buffers.feature.includes(100)) facts.push("is_on_forest_tile");
  const terrainId = buffers.terrain[idx];
  for (const def of Object.values(worldSpecRef!.terrain_types)) {
    if (def.id === terrainId && (def.yield?.food ?? 0) > 0) {
      facts.push("is_on_food_tile");
      break;
    }
  }
  if (Object.values(worldSpecRef!.terrain_types).some((def) => (def.yield?.food ?? 0) > 0)) {
    facts.push("is_on_food_tile");
  }
  if (wood[entityIndex] >= 3) facts.push("has_wood_3");
  facts.push("is_on_grass_tile");
  return facts;
}

function computeInputs(entityIndex: number, width: number) {
  const buffers = buffersRef!;
  const health = buffers.entities.health as Uint8Array;
  const wood = buffers.entities.inventory_wood as Uint8Array;
  return {
    enemy_nearby: 0,
    health: health[entityIndex],
    hunger: 0,
    wood: wood[entityIndex],
    tiles_explored: getTilesExplored(entityIndex)
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
  if (ev.data.type === "sim_tick") {
    const { entityIndices } = ev.data as SimTickMessage;
    if (!buffersRef) return;
    const { width, height } = worldSpecRef!.config.dimensions;
    const ids = buffersRef.entities.id as Uint32Array;
    const planLock = buffersRef.entities.plan_lock_ticks as Uint8Array;
    const currentAction = buffersRef.entities.current_action_id as Uint8Array;
    const indices =
      entityIndices && entityIndices.length > 0
        ? entityIndices
        : Array.from({ length: ids.length }, (_, i) => i);
    for (const idx of indices) {
      if (ids[idx] === 0) continue;
      if (planLock[idx] > 0) planLock[idx] -= 1;
      updateExploration(idx, width);
      if (planLock[idx] === 0) {
        const inputs = computeInputs(idx, width);
        const utilities = computeUtilities(unitBehaviorSpecRef!, inputs);
        const { goalKey, goalEffect } = pickTopGoal(unitBehaviorSpecRef!, utilities);
        const actions: ActionDef[] = Object.entries(unitBehaviorSpecRef!.actions).map(
          ([name, def]) => ({ name, cost: def.cost, pre: def.pre, eff: def.eff })
        );
        const plan = buildPlan(actions, goalEffect, new Set(buildStateFacts(idx, width, height)));
        const nextAction = plan[0]?.name;
        const nextId = nextAction ? actionIdByName.get(nextAction) ?? 0 : 0;
        currentAction[idx] = nextId;
        planLock[idx] = 10;
        logEvent({
          event_type: "AI_PLAN_CHANGE",
          entity_id: idx,
          goal: goalKey,
          utilities,
          plan: plan.map((p) => p.name),
          reason: "utility_top_goal"
        });
        lastDecision.set(idx, { goal: goalKey, plan: plan.map((p) => p.name), utilities });
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
    self.postMessage({ type: "tick", tick: simTick, paths, entityDebug });
    flushLogs();
    return;
  }
  if (ev.data.type === "spawn_unit") {
    if (!buffersRef || !worldSpecRef) return;
    const { width, height } = worldSpecRef.config.dimensions;
    const ids = buffersRef.entities.id as Uint32Array;
    const types = buffersRef.entities.type as Uint8Array;
    const factions = buffersRef.entities.faction_id as Uint8Array;
    const xs = buffersRef.entities.x as Uint16Array;
    const ys = buffersRef.entities.y as Uint16Array;
    const wood = buffersRef.entities.inventory_wood as Uint8Array;
    const food = buffersRef.entities.inventory_food as Uint8Array;
    const actionId = buffersRef.entities.current_action_id as Uint8Array;
    const progress = buffersRef.entities.action_progress as Uint8Array;
    const planLock = buffersRef.entities.plan_lock_ticks as Uint8Array;

    const req = ev.data as SpawnUnitMessage;
    const tryPlaceAt = (x: number, y: number) => {
      if (x < 0 || y < 0 || x >= width || y >= height) return false;
      const idx = y * width + x;
      const terrainId = buffersRef!.terrain[idx];
      const walkable = Object.values(worldSpecRef!.terrain_types).some(
        (t) => t.id === terrainId && t.walkable
      );
      if (!walkable) return false;
      return true;
    };

    for (let i = 0; i < ids.length; i += 1) {
      if (ids[i] !== 0) continue;
      let x = req.x ?? Math.floor(Math.random() * width);
      let y = req.y ?? Math.floor(Math.random() * height);
      if (!tryPlaceAt(x, y)) {
        let placed = false;
        for (let attempts = 0; attempts < 500; attempts += 1) {
          x = Math.floor(Math.random() * width);
          y = Math.floor(Math.random() * height);
          if (tryPlaceAt(x, y)) {
            placed = true;
            break;
          }
        }
        if (!placed) return;
      }
      ids[i] = i + 1;
      types[i] = req.unitType;
      factions[i] = req.factionId;
      if (!homeByFaction.has(req.factionId)) {
        homeByFaction.set(req.factionId, { x, y });
      }
      xs[i] = x;
      ys[i] = y;
      wood[i] = 0;
      food[i] = 0;
      actionId[i] = 0;
      progress[i] = 0;
      planLock[i] = 0;
      logEvent({ event_type: "UNIT_SPAWN", entity_id: i, unit_type: req.unitType });
      flushLogs();
      return;
    }
    return;
  }
  if (ev.data.type !== "init") return;
  try {
    const [worldSpec, stateSpec, techSpec, unitBehaviorSpec] = await Promise.all([
      loadWorldSpec(ev.data.worldSpecUrl),
      loadStateSpec(ev.data.stateSpecUrl),
      loadTechSpec(ev.data.techSpecUrl),
      loadUnitBehaviorSpec(ev.data.unitBehaviorSpecUrl)
    ]);
    const seed = ev.data.seed ?? 1337;
    const useShared = typeof SharedArrayBuffer !== "undefined";
    const buffers = makeStateBuffers(stateSpec, worldSpec, useShared);
    buildTerrain(worldSpec, seed, buffers.terrain.buffer);
    seedForests(worldSpec, buffers, seed);

    const techManager = new TechManager(techSpec);
    techManager.addFaction(0);
    techManager.startResearch(0, "mining");
    techManagerRef = techManager;
    unitBehaviorSpecRef = unitBehaviorSpec;
    buildActionIdMap(unitBehaviorSpec);
    worldSpecRef = worldSpec;
    stateSpecRef = stateSpec;
    buffersRef = buffers;
    spawnInitialUnits();

    logEvent({ kind: "init", message: "world/state/tech loaded" });

    const payload: GenerateResult = {
      type: "state",
      worldSpec,
      stateSpec,
      techSpec,
      unitBehaviorSpec,
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
