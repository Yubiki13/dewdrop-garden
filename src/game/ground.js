// Pixel-level ground renderer: grass, tilled soil, water and stone paths with rounded auto-tiling.
// Writes into one big cached canvas; only dirty tiles are repainted when the world changes.
import { TILE, MAP_W, MAP_H, G_SOIL, G_WATER, F_PATH } from '../config.js';
import { fbm, hash2, hexToRgb, BAYER4, makeCanvas } from '../core/util.js';

const C = (h) => hexToRgb(h);
const GRASS = ['#3b7b3a', '#478d42', '#54a049', '#63ae52'].map(C);
const GRASS_LIGHT = C('#88c964'), GRASS_DARK = C('#2f6a35'), GRASS_EDGE = C('#336f37');
const SOIL_DRY = { rim: C('#5e3a26'), dark: C('#7a4c30'), base: C('#946040'), light: C('#a8724a'), speck: C('#b8845a') };
const SOIL_WET = { rim: C('#36221a'), dark: C('#4a2e22'), base: C('#5a3828'), light: C('#6a4430'), speck: C('#7a5038') };
const BANK = C('#7a5c40'), BANK_D = C('#4f3a2a');
const WATER_SHADOW = C('#2b5c92');
const WATER = [C('#3c80be'), C('#3674b2'), C('#3068a6'), C('#2c5f9c')];
const STONE = ['#a9a5a8', '#9c979b', '#b6b2b2', '#a3a09a'].map(C);
const STONE_HI = C('#cdc9c6'), STONE_LO = C('#7e7a80'), MORTAR = C('#5f5b52');

export class GroundRenderer {
  constructor(world) {
    this.world = world;
    this.canvas = makeCanvas(MAP_W * TILE, MAP_H * TILE);
    this.ctx = this.canvas.getContext('2d');
    this.img = this.ctx.createImageData(MAP_W * TILE, MAP_H * TILE);
    this.dirty = new Set();
  }

  renderAll() {
    for (let ty = 0; ty < MAP_H; ty++) for (let tx = 0; tx < MAP_W; tx++) this.paintTile(tx, ty);
    this.ctx.putImageData(this.img, 0, 0);
    this.dirty.clear();
  }

  /** Mark a tile (and its neighbours, since edges depend on them) for repaint. */
  markDirty(tx, ty) {
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const x = tx + dx, y = ty + dy;
        if (x >= 0 && y >= 0 && x < MAP_W && y < MAP_H) this.dirty.add(y * MAP_W + x);
      }
  }

  flush() {
    if (!this.dirty.size) return;
    let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    for (const i of this.dirty) {
      const tx = i % MAP_W, ty = (i / MAP_W) | 0;
      this.paintTile(tx, ty);
      x0 = Math.min(x0, tx); y0 = Math.min(y0, ty); x1 = Math.max(x1, tx); y1 = Math.max(y1, ty);
    }
    this.ctx.putImageData(this.img, 0, 0, x0 * TILE, y0 * TILE, (x1 - x0 + 1) * TILE, (y1 - y0 + 1) * TILE);
    this.dirty.clear();
  }

  paintTile(tx, ty) {
    const w = this.world;
    const i = ty * MAP_W + tx;
    const g = w.ground[i];
    const path = w.floor[i] === F_PATH;
    const data = this.img.data;
    const stride = MAP_W * TILE;
    let same = null;
    if (g === G_SOIL) same = (x, y) => w.groundAt(x, y) === G_SOIL;
    else if (g === G_WATER) same = (x, y) => w.groundAt(x, y) === G_WATER || !w.inBounds(x, y);
    else if (path) same = (x, y) => w.floorAt(x, y) === F_PATH;
    const nb = same ? neighbours(same, tx, ty) : null;
    const wet = w.wet[i] > 0;
    const depth = w.waterDepth[i];
    for (let ly = 0; ly < TILE; ly++)
      for (let lx = 0; lx < TILE; lx++) {
        const x = tx * TILE + lx, y = ty * TILE + ly;
        let c;
        if (!nb) c = grassPixel(x, y, w.seed);
        else {
          const d = edgeDist(lx, ly, nb, g === G_WATER ? 6 : 3);
          if (g === G_SOIL) c = d < 0 ? grassPixel(x, y, w.seed) : soilPixel(x, y, lx, ly, d, wet ? SOIL_WET : SOIL_DRY);
          else if (g === G_WATER) c = waterPixel(x, y, d, depth, w.seed);
          else c = d < 0 ? grassPixel(x, y, w.seed) : d < 0.8 ? GRASS_EDGE : stonePixel(x, y);
        }
        const o = (y * stride + x) * 4;
        data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2]; data[o + 3] = 255;
      }
  }
}

function neighbours(same, tx, ty) {
  return {
    n: same(tx, ty - 1), s: same(tx, ty + 1), e: same(tx + 1, ty), w: same(tx - 1, ty),
    ne: same(tx + 1, ty - 1), nw: same(tx - 1, ty - 1), se: same(tx + 1, ty + 1), sw: same(tx - 1, ty + 1),
  };
}

/** Distance (px) from a pixel to the nearest "other" region, with rounded convex corners. Negative = outside. */
function edgeDist(lx, ly, nb, R) {
  const px = lx + 0.5, py = ly + 0.5, T = TILE;
  let d = 99;
  if (!nb.n) d = Math.min(d, py);
  if (!nb.s) d = Math.min(d, T - py);
  if (!nb.w) d = Math.min(d, px);
  if (!nb.e) d = Math.min(d, T - px);
  const round = (cx, cy) => {
    const ddx = Math.abs(px - cx), ddy = Math.abs(py - cy);
    if (ddx < R && ddy < R) d = Math.min(d, R - Math.hypot(R - ddx, R - ddy));
  };
  if (!nb.n && !nb.w) round(0, 0);
  if (!nb.n && !nb.e) round(T, 0);
  if (!nb.s && !nb.w) round(0, T);
  if (!nb.s && !nb.e) round(T, T);
  // concave corners
  if (nb.n && nb.w && !nb.nw) d = Math.min(d, Math.hypot(px, py) - 0.5);
  if (nb.n && nb.e && !nb.ne) d = Math.min(d, Math.hypot(T - px, py) - 0.5);
  if (nb.s && nb.w && !nb.sw) d = Math.min(d, Math.hypot(px, T - py) - 0.5);
  if (nb.s && nb.e && !nb.se) d = Math.min(d, Math.hypot(T - px, T - py) - 0.5);
  return d;
}

export function grassPixel(x, y, seed) {
  const n = fbm(x / 52, y / 52, seed, 3);
  const h = hash2(x, y, seed + 5);
  if (h < 0.012) return GRASS_LIGHT;
  if (h > 0.992) return GRASS_DARK;
  // little vertical blades
  if (hash2(x >> 1, y >> 2, seed + 9) < 0.035 && (y & 3) < 2) return (x & 1) ? GRASS[3] : GRASS[0];
  let v = (n - 0.5) * 3.4 + 1.6 + (BAYER4[y & 3][x & 3] - 0.5) * 0.9 + (h - 0.5) * 0.35;
  v = v < 0 ? 0 : v > 3 ? 3 : v;
  return GRASS[v | 0];
}

function soilPixel(x, y, lx, ly, d, P) {
  if (d < 1) return P.rim;
  const h = hash2(x, y, 77);
  if (h < 0.04) return P.speck;
  const row = (ly + ((hash2(x >> 2, 3, 1) * 2) | 0)) % 4;
  let c = row === 0 ? P.dark : row === 1 ? P.base : row === 2 ? P.base : P.light;
  if (d < 2 && ly < 3) c = P.dark;
  if (h > 0.93) c = c === P.light ? P.base : P.dark;
  return c;
}

function waterPixel(x, y, d, depth, seed) {
  if (d < 0) return grassPixel(x, y, seed);
  if (d < 1) return GRASS_EDGE;
  if (d < 2.5) return BANK;
  if (d < 3.5) return BANK_D;
  if (d < 5) return WATER_SHADOW;
  let lvl = Math.min(3, depth) + (BAYER4[y & 3][x & 3] - 0.5) * 0.9 + (fbm(x / 20, y / 20, seed + 3, 2) - 0.5) * 1.2;
  if (d < 8) lvl -= 0.6;
  lvl = Math.max(0, Math.min(3, Math.round(lvl)));
  return WATER[lvl];
}

function stonePixel(x, y) {
  const S = 6;
  const cx = Math.floor(x / S), cy = Math.floor(y / S);
  let d1 = 1e9, d2 = 1e9, best = null;
  for (let j = -1; j <= 1; j++)
    for (let i = -1; i <= 1; i++) {
      const gx = cx + i, gy = cy + j;
      const fx = gx * S + 1 + hash2(gx, gy, 11) * (S - 2);
      const fy = gy * S + 1 + hash2(gx, gy, 12) * (S - 2);
      const dd = Math.hypot(x + 0.5 - fx, y + 0.5 - fy);
      if (dd < d1) { d2 = d1; d1 = dd; best = { gx, gy, fx, fy }; } else if (dd < d2) d2 = dd;
    }
  if (d2 - d1 < 1.15) return MORTAR;
  const base = STONE[(hash2(best.gx, best.gy, 13) * STONE.length) | 0];
  const rel = y + 0.5 - best.fy + (x + 0.5 - best.fx) * 0.4;
  if (rel < -1.8 && d2 - d1 > 2) return STONE_HI;
  if (rel > 1.8 && d2 - d1 < 2.2) return STONE_LO;
  return base;
}
