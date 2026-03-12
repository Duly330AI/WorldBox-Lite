import type { StateView } from "../state/StateView";

type LogFn = (entry: Record<string, unknown>) => void;

type FireOptions = {
  logEvent?: LogFn;
  buildingOwner?: Map<number, number>;
  rng?: () => number;
};

type LavaOptions = {
  logEvent?: LogFn;
};

type TreeOptions = {
  rng?: () => number;
};

export function stepFire(view: StateView, options: FireOptions = {}) {
  const width = view.width;
  const height = view.height;
  const rng = options.rng ?? Math.random;
  const fireToSpread: Array<[number, number]> = [];
  for (let i = 0; i < width * height; i += 1) {
    if (view.getFeature(i) === 110) {
      fireToSpread.push([i % width, Math.floor(i / width)]);
    }
    if (view.getFeature(i) === 100 && rng() < 0.001) {
      view.setFeature(i, 110);
    }
  }
  const burnTargets: number[] = [];
  for (const [fx, fy] of fireToSpread) {
    const neighbors = [
      [fx + 1, fy],
      [fx - 1, fy],
      [fx, fy + 1],
      [fx, fy - 1]
    ];
    for (const [nx, ny] of neighbors) {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const idx = view.tileIndex(nx, ny);
      if (view.getFeature(idx) === 100 || view.getBuilding(idx) === 300) {
        view.setFeature(idx, 110);
        view.setBuilding(idx, 0);
        burnTargets.push(idx);
      }
    }
  }
  for (const [fx, fy] of fireToSpread) {
    const idx = view.tileIndex(fx, fy);
    view.setFeature(idx, 0);
    view.setTerrain(idx, 2);
    options.buildingOwner?.delete(idx);
    options.logEvent?.({ event_type: "WORLD_EVENT", level: "INFO", event: "fire_burnout", x: fx, y: fy });
  }
  for (const idx of burnTargets) {
    view.setTerrain(idx, 2);
    if (view.getBuilding(idx) === 0) {
      options.buildingOwner?.delete(idx);
    }
    options.logEvent?.({ event_type: "WORLD_EVENT", level: "INFO", event: "fire_spread", idx });
  }
}

export function stepLavaHeat(view: StateView, options: LavaOptions = {}) {
  const width = view.width;
  const height = view.height;
  for (let i = 0; i < width * height; i += 1) {
    if (view.getTerrain(i) !== 8) continue;
    const x = i % width;
    const y = Math.floor(i / width);
    const neighbors = [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1]
    ];
    for (const [nx, ny] of neighbors) {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const idx = view.tileIndex(nx, ny);
      if (view.getTerrain(idx) === 0) {
        view.setTerrain(idx, 2);
        options.logEvent?.({ event_type: "WORLD_EVENT", level: "INFO", event: "lava_heat", x: nx, y: ny });
      }
    }
  }
}

export function stepTreeGrowth(view: StateView, options: TreeOptions = {}) {
  const width = view.width;
  const height = view.height;
  const rng = options.rng ?? Math.random;
  for (let i = 0; i < width * height; i += 1) {
    if (view.getTerrain(i) !== 0) continue;
    if (view.getFeature(i) !== 0) continue;
    if (rng() < 0.005) {
      view.setFeature(i, 100);
    }
  }
}
