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

type StateBuffers = {
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
  entityIndices: number[];
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
  for (let i = 0; i < buffers.feature.length; i += 1) {
    if (buffers.terrain[i] !== grassId) continue;
    if (rng() < 0.08) {
      buffers.feature[i] = 100;
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
        xs[i] = spot[0];
        ys[i] = spot[1];
        wood[i] = 0;
        food[i] = 0;
        actionId[i] = 1;
        progress[i] = 0;
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
  const height = makeTileBuffer(stateSpec.memory_layout.height_buffer.type, tileCount, useShared) as Int8Array;

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

  return { terrain, feature, building, height, entities };
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
  logBuffer.push({ ts: Date.now(), ...entry });
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

let actionById: Map<number, { name: string; progress_step: number }> = new Map();

function buildActionIdMap(spec: UnitBehaviorSpec) {
  actionById = new Map();
  for (const [name, def] of Object.entries(spec.actions)) {
    actionById.set(def.id, { name, progress_step: def.progress_step });
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

function aStarStep(
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
  let current = goalIdx;
  let prev = cameFrom[current];
  while (prev !== -1 && prev !== startIdx) {
    current = prev;
    prev = cameFrom[current];
  }
  const nextX = current % width;
  const nextY = Math.floor(current / width);
  return { x: nextX, y: nextY };
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
  if (actionId === 0) return;
  const actionMeta = actionById.get(actionId);
  const progressStep = actionMeta?.progress_step ?? 0;

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
    const next = aStarStep(x, y, targetX[entityIndex], targetY[entityIndex], width, height, isWalkable, occupied);
    if (next) {
      xs[entityIndex] = next.x;
      ys[entityIndex] = next.y;
    }
  };

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
    }
    return;
  }

  if (actionMeta?.name === "BUILD_HOUSE") {
    ensureTarget((tx, ty) => {
      const terrainId = buffers.terrain[ty * width + tx];
      for (const def of Object.values(worldSpecRef!.terrain_types)) {
        if (def.id === terrainId) return def.id === terrainId && def.walkable && def.yield.food >= 0;
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
      buffers.building[ty * width + tx] = 300;
      inventoryWood[entityIndex] = Math.max(0, inventoryWood[entityIndex] - 3);
      progress[entityIndex] = 0;
      logEvent({ event_type: "UNIT_ACTION", action: "BUILD_HOUSE", entity_id: entityIndex });
    }
  }
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
    for (const idx of entityIndices) {
      tickAction(idx);
    }
    flushLogs();
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
