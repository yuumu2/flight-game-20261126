// Supplies deterministic random values and the atoll's portable value noise.
import { TERRAIN, WORLD_SEED } from './config.js';

export function createRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let bits = Math.imul(state ^ (state >>> 15), state | 1);
    bits ^= bits + Math.imul(bits ^ (bits >>> 7), bits | 61);
    return ((bits ^ (bits >>> 14)) >>> 0) / 4294967296;
  };
}

export function smoothstep(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export function latticeValue(ix, iy, seed = WORLD_SEED) {
  let n = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263)
    + Math.imul(seed, 1442695041)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

export function valueNoise(x, y, seed = WORLD_SEED) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const tx = smoothstep(0, 1, x - ix);
  const ty = smoothstep(0, 1, y - iy);
  const a = latticeValue(ix, iy, seed);
  const b = latticeValue(ix + 1, iy, seed);
  const c = latticeValue(ix, iy + 1, seed);
  const d = latticeValue(ix + 1, iy + 1, seed);
  const top = a + (b - a) * tx;
  const bottom = c + (d - c) * tx;
  return top + (bottom - top) * ty;
}

export function fbm(x, y, seed = WORLD_SEED) {
  let total = 0;
  let weight = 0;
  let amplitude = 1;
  let frequency = 1;
  for (let octave = 0; octave < TERRAIN.octaves; octave++) {
    total += amplitude * valueNoise(x * frequency, y * frequency, seed);
    weight += amplitude;
    amplitude *= TERRAIN.gain;
    frequency *= TERRAIN.lacunarity;
  }
  return total / weight;
}
