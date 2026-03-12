import type { WorldSpec } from "../io/specLoader";

function hash2d(x: number, y: number, seed: number) {
  let h = x * 374761393 + y * 668265263 + seed * 374761393;
  h = (h ^ (h >> 13)) * 1274126177;
  return (h ^ (h >> 16)) >>> 0;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function smoothstep(t: number) {
  return t * t * (3 - 2 * t);
}

function valueNoise(x: number, y: number, seed: number) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = x0 + 1;
  const y1 = y0 + 1;

  const sx = smoothstep(x - x0);
  const sy = smoothstep(y - y0);

  const n00 = (hash2d(x0, y0, seed) % 1000) / 1000;
  const n10 = (hash2d(x1, y0, seed) % 1000) / 1000;
  const n01 = (hash2d(x0, y1, seed) % 1000) / 1000;
  const n11 = (hash2d(x1, y1, seed) % 1000) / 1000;

  const ix0 = lerp(n00, n10, sx);
  const ix1 = lerp(n01, n11, sx);
  return lerp(ix0, ix1, sy);
}

function fractalNoise(x: number, y: number, seed: number, octaves = 4, lacunarity = 2, gain = 0.5) {
  let amplitude = 1;
  let frequency = 1;
  let sum = 0;
  let max = 0;
  for (let i = 0; i < octaves; i += 1) {
    sum += valueNoise(x * frequency, y * frequency, seed + i * 1013) * amplitude;
    max += amplitude;
    amplitude *= gain;
    frequency *= lacunarity;
  }
  return sum / max;
}

function idByName(spec: WorldSpec, name: string, fallback: number) {
  return spec.terrain_types[name]?.id ?? fallback;
}

export function buildTerrain(spec: WorldSpec, seed: number, buffer?: ArrayBuffer): Uint8Array {
  const { width, height } = spec.config.dimensions;
  const terrain = buffer ? new Uint8Array(buffer) : new Uint8Array(width * height);

  const waterId = idByName(spec, "water", 5);
  const oceanId = idByName(spec, "ocean", waterId);
  const sandId = idByName(spec, "desert", 2);
  const grassId = idByName(spec, "grass", 0);
  const plainsId = idByName(spec, "plains", grassId);
  const peakId = idByName(spec, "peak", 7);

  const scale = 0.08;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const n = fractalNoise(x * scale, y * scale, seed, 5, 2, 0.5);
      const idx = y * width + x;
      if (n < 0.15) terrain[idx] = oceanId;
      else if (n < 0.3) terrain[idx] = waterId;
      else if (n < 0.4) terrain[idx] = sandId;
      else if (n < 0.7) terrain[idx] = grassId;
      else if (n < 0.8) terrain[idx] = plainsId;
      else terrain[idx] = peakId;
    }
  }
  return terrain;
}
