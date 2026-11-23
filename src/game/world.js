// The garden map: terrain, buildings, trees, decor, crops and placed objects.
import {
  MAP_W, MAP_H, ORIG_W, WILD_X, ORIG_H, MEADOW_END, G_GRASS, G_SOIL, G_WATER, F_PATH,
} from '../config.js';
import { makeRng, fbm, hash2 } from '../core/util.js';

export const STRUCT_DEFS = {
  house: { w: 5, h: 3 },
  stall: { w: 3, h: 2 },
  well: { w: 2, h: 2 },
  bin: { w: 2, h: 1 },
  sign: { w: 1, h: 1 },
  hut: { w: 3, h: 2 },
  shrine: { w: 2, h: 2 },
  gate: { w: 2, h: 1 },
  gate2: { w: 2, h: 1 },
  wish: { w: 2, h: 2 },
  windmill: { w: 3, h: 2 },
};

export const LAYOUT = {
  house: { tx: 10, ty: 5 },
  door: { tx: 12, ty: 7 },
  bin: { tx: 16, ty: 7 },
  well: { tx: 23, ty: 12 },
  stall: { tx: 36, ty: 6 },
  sign: { tx: 15, ty: 13 },
  granny: { tx: 14, ty: 9 },
  crate: { tx: 18, ty: 12 },
  delivery: { tx: 35, ty: 9 },
  view: { tx: 17, ty: 11 },
  pond: { cx: 46, cy: 30, rx: 7.6, ry: 5.4 },
  garden: { x0: 14, y0: 14, x1: 36, y1: 33 },
  // ---- Riverside Meadow (second plot, rows ORIG_H.. ) ----
  gate: { tx: 29, ty: 42 },
  bin2: { tx: 32, ty: 47 },
  meadow: { x0: 6, y0: 48, x1: 53, y1: 65 },
  lake: { cx: 13, cy: 59, rx: 5.2, ry: 3.6 },
  meadowView: { tx: 30, ty: 54 },
  // ---- Blossom Hills (third plot, rows MEADOW_END..) ----
  gate2: { tx: 30, ty: 68 },
  bin3: { tx: 33, ty: 73 },
  wish: { tx: 21, ty: 79 },
  windmill: { tx: 9, ty: 77 },
  hillPond: { cx: 44, cy: 87, rx: 6.4, ry: 4.4 },
  hills: { x0: 5, y0: 74, x1: 54, y1: 95 },
  hillsView: { tx: 30, ty: 83 },
  mailbox: { tx: 10, ty: 7 }, // on the cottage's front corner
  // ---- the Wildwood (columns WILD_X.., free to explore) ----
  hut: { tx: 73, ty: 15 },
  fern: { tx: 75, ty: 17 },
  shrine: { tx: 86, ty: 55 },
  wildView: { tx: 70, ty: 14 },
};

export const WILD_CHUNK = 5; // fog-of-war cell size (tiles)
export const isWild = (tx) => tx >= WILD_X;

export class World {
  constructor(seed) {
    this.seed = seed >>> 0;
    const N = MAP_W * MAP_H;
    this.ground = new Uint8Array(N);
    this.floor = new Uint8Array(N);
    this.wet = new Float32Array(N);
    this.fert = new Uint8Array(N);
    this.deco = new Uint8Array(N);
    this.struct = new Int16Array(N).fill(-1);
    this.prop = new Int16Array(N).fill(-1);
    this.waterDepth = new Uint8Array(N);
    this.structures = [];
    this.props = [];
    this.crops = new Map(); // idx -> { id, growth, harvests }
    this.objs = new Map(); // idx -> { type, tier, ...extra } (crates carry { items, gift })
    this.weeds = new Map(); // idx -> variant
    this.wildState = {}; // "tx,ty" -> { hp, regrow, day, opened } for Wildwood trees, rocks, forage and chests
    this.explored = new Uint8Array(Math.ceil((MAP_W - WILD_X) / WILD_CHUNK) * Math.ceil(MAP_H / WILD_CHUNK));
    this.generate();
  }

  idx(tx, ty) { return ty * MAP_W + tx; }
  inBounds(tx, ty) { return tx >= 0 && ty >= 0 && tx < MAP_W && ty < MAP_H; }
  groundAt(tx, ty) { return this.inBounds(tx, ty) ? this.ground[ty * MAP_W + tx] : -1; }
  floorAt(tx, ty) { return this.inBounds(tx, ty) ? this.floor[ty * MAP_W + tx] : -1; }

  /** Free grass/soil tile without anything on it. */
  isOpen(tx, ty) {
    if (!this.inBounds(tx, ty)) return false;
    const i = ty * MAP_W + tx;
    return this.ground[i] !== G_WATER && this.struct[i] < 0 && this.prop[i] < 0 && !this.objs.has(i) && !this.isGranny(tx, ty) && !this.isFern(tx, ty);
  }

  isGranny(tx, ty) { return tx === LAYOUT.granny.tx && ty === LAYOUT.granny.ty; }
  isFern(tx, ty) { return tx === LAYOUT.fern.tx && ty === LAYOUT.fern.ty; }

  /** Nearest free tile to (tx,ty) for dropping a crate. */
  freeTileNear(tx, ty) {
    for (let r = 0; r < 8; r++)
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = tx + dx, y = ty + dy;
          if (this.isOpen(x, y) && !this.crops.has(this.idx(x, y)) && !this.weeds.has(this.idx(x, y))) return { tx: x, ty: y };
        }
    return null;
  }

  structureAt(tx, ty) {
    if (!this.inBounds(tx, ty)) return null;
    const s = this.struct[ty * MAP_W + tx];
    return s >= 0 ? this.structures[s] : null;
  }

  /* ----------------------------- generation ----------------------------- */

  generate() {
    const rng = makeRng(this.seed);
    const L = LAYOUT;
    const clear = new Uint8Array(MAP_W * MAP_H); // 1 = keep free of props
    const markClear = (x0, y0, x1, y1) => {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (this.inBounds(x, y)) clear[this.idx(x, y)] = 1;
    };

    // pond
    const P = L.pond;
    for (let y = 0; y < ORIG_H; y++)
      for (let x = 0; x < ORIG_W; x++) {
        const dx = (x + 0.5 - P.cx) / P.rx, dy = (y + 0.5 - P.cy) / P.ry;
        const wob = (fbm(x / 4, y / 4, this.seed + 40, 2) - 0.5) * 0.5;
        if (dx * dx + dy * dy < 1 + wob) this.ground[this.idx(x, y)] = G_WATER;
      }
    // little inlet stream
    for (let x = Math.floor(P.cx + P.rx - 2); x < ORIG_W; x++) {
      const y = Math.round(P.cy + 1 + Math.sin(x * 0.5) * 0.8);
      this.ground[this.idx(x, y)] = G_WATER;
      this.ground[this.idx(x, y + 1)] = G_WATER;
    }
    this.computeWaterDepth();
    markClear(Math.floor(P.cx - P.rx - 2), Math.floor(P.cy - P.ry - 2), Math.ceil(P.cx + P.rx + 1), Math.ceil(P.cy + P.ry + 1));

    // structures
    this.addStructure('house', L.house.tx, L.house.ty);
    this.addStructure('bin', L.bin.tx, L.bin.ty);
    this.addStructure('well', L.well.tx, L.well.ty);
    this.addStructure('stall', L.stall.tx, L.stall.ty);
    this.addStructure('sign', L.sign.tx, L.sign.ty);
    for (const s of this.structures) markClear(s.tx - 1, s.ty - 2, s.tx + s.w, s.ty + s.h + 1);
    markClear(L.house.tx - 1, L.house.ty - 3, L.house.tx + 5, L.house.ty + 4);
    markClear(L.granny.tx - 1, L.granny.ty - 1, L.granny.tx + 1, L.granny.ty + 1);

    // paths
    const path = (x, y) => { this.floor[this.idx(x, y)] = F_PATH; markClear(x - 1, y - 1, x + 1, y + 1); };
    for (let y = L.door.ty + 1; y <= 10; y++) path(L.door.tx, y);
    for (let x = L.door.tx; x <= 39; x++) path(x, 10);
    for (let y = L.stall.ty + 2; y <= 10; y++) { path(L.stall.tx + 1, y); }
    for (let x = L.bin.tx; x <= L.bin.tx + 1; x++) path(x, L.bin.ty + 1);
    for (let y = 11; y <= L.well.ty + 1; y++) path(L.well.tx - 1, y);
    // a little trail down to the pond
    for (let y = 11; y < ORIG_H; y++) {
      const x = 39 + (y > 17 ? 1 : 0) + (y > 21 ? 1 : 0);
      path(39 + (y > 18 ? 1 : 0) + (y > 22 ? 1 : 0), y);
      if (this.ground[this.idx(x, y)] === G_WATER || this.ground[this.idx(x, y + 1)] === G_WATER) { path(x, y); break; }
      path(x, y);
    }
    const G = L.garden;
    markClear(G.x0, G.y0, G.x1, G.y1);

    // forest border
    const placeTree = (kind, tx, ty, v) => {
      if (!this.inBounds(tx, ty) || clear[this.idx(tx, ty)] || this.prop[this.idx(tx, ty)] >= 0) return false;
      if (this.ground[this.idx(tx, ty)] === G_WATER) return false;
      this.addProp({ type: 'tree', kind, v, tx, ty, solid: true, ox: 0 });
      return true;
    };
    // NOTE: the original area must generate exactly as it always has (saves don't store trees),
    // so these loops stay bounded to ORIG_H and consume the random numbers in the same order.
    for (let ty = 0; ty < ORIG_H + 2; ty += 2)
      for (let tx = 0; tx < ORIG_W + 2; tx += 2) {
        const jx = tx + Math.floor(rng() * 2), jy = ty + Math.floor(rng() * 2);
        if (jx >= ORIG_W || jy >= ORIG_H) continue;
        const e = Math.min(jx, jy, ORIG_W - 1 - jx, ORIG_H - 1 - jy);
        const band = 2.2 + fbm(jx / 6, jy / 6, this.seed + 7, 2) * 3.2;
        if (e > band) continue;
        const kind = rng() < 0.45 ? 'pine' : rng() < 0.1 ? 'maple' : 'oak';
        placeTree(kind, jx, jy, Math.floor(rng() * 6));
      }
    // feature trees
    const feature = [
      ['cherry', 7, 11], ['cherry', 8, 15], ['maple', 42, 6], ['oak', 31, 4], ['cherry', 53, 22],
      ['oak', 37, 39], ['maple', 9, 31], ['oak', 5, 22], ['cherry', 26, 38], ['pine', 54, 14],
      ['oak', 46, 12], ['cherry', 20, 6],
    ];
    for (const [k, x, y] of feature) placeTree(k, x, y, Math.floor(rng() * 6));

    // bushes, rocks, stumps
    for (let i = 0; i < 70; i++) {
      const tx = 2 + Math.floor(rng() * (ORIG_W - 4)), ty = 2 + Math.floor(rng() * (ORIG_H - 4));
      const ii = this.idx(tx, ty);
      if (clear[ii] || this.prop[ii] >= 0 || this.ground[ii] === G_WATER || this.floor[ii]) continue;
      const r = rng();
      if (r < 0.55) this.addProp({ type: 'bush', v: Math.floor(rng() * 5), tx, ty, solid: true, ox: Math.floor(rng() * 4) - 2 });
      else if (r < 0.88) this.addProp({ type: 'rock', v: Math.floor(rng() * 4), tx, ty, solid: true, ox: Math.floor(rng() * 4) - 2 });
      else this.addProp({ type: 'stump', v: 0, tx, ty, solid: true, ox: 0 });
    }
    // reeds + lily pads around the pond
    this.lilyAndReeds(rng, 1, ORIG_H - 1);

    // grass decoration (tufts 1-3, flowers 4-9)
    this.decorate(0, ORIG_H, G, 0.18);

    this.generateMeadow();
    this.generateHills();
    this.generateWildwood();
    this.carvePassage();
    this.computeWaterDepth();
  }

  lilyAndReeds(rng, y0, y1) {
    for (let ty = y0; ty < y1; ty++)
      for (let tx = 1; tx < ORIG_W - 1; tx++) {
        const i = this.idx(tx, ty);
        if (this.ground[i] === G_WATER) {
          if (this.waterDepth[i] >= 2 && rng() < 0.13) this.addProp({ type: 'lily', v: rng() < 0.3 ? 1 : 0, tx, ty, solid: false, ox: Math.floor(rng() * 6) - 3, oy: Math.floor(rng() * 6) - 3 });
          continue;
        }
        if (this.prop[i] >= 0 || this.floor[i] || this.struct[i] >= 0) continue;
        const nearWater = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => this.ground[this.idx(tx + dx, ty + dy)] === G_WATER);
        if (nearWater && rng() < 0.35) this.addProp({ type: 'reeds', v: Math.floor(rng() * 3), tx, ty, solid: false, ox: Math.floor(rng() * 6) - 3 });
      }
  }

  decorate(y0, y1, G, flowerBoost) {
    for (let ty = y0; ty < y1; ty++)
      for (let tx = 0; tx < ORIG_W; tx++) {
        const i = this.idx(tx, ty);
        if (this.ground[i] !== G_GRASS || this.floor[i] || this.struct[i] >= 0 || this.prop[i] >= 0) continue;
        const meadow = fbm(tx / 7, ty / 7, this.seed + 21, 2);
        const h = hash2(tx, ty, this.seed + 3);
        const inGarden = tx >= G.x0 && tx <= G.x1 && ty >= G.y0 && ty <= G.y1;
        if (h < (inGarden ? 0.07 : 0.16)) this.deco[i] = 1 + Math.floor(hash2(tx, ty, 8) * 3);
        else if (h < (inGarden ? 0.09 : 0.16 + meadow * flowerBoost)) this.deco[i] = 4 + Math.floor(hash2(tx, ty, 9) * 6);
      }
  }

  /** The Riverside Meadow: a second plot south of the forest. Uses its own random stream. */
  generateMeadow() {
    const rng = makeRng((this.seed ^ 0x9e3779b9) >>> 0);
    const Y0 = ORIG_H;
    const M = LAYOUT.meadow;
    const clear = new Uint8Array(MAP_W * MAP_H);
    const markClear = (x0, y0, x1, y1) => {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (this.inBounds(x, y)) clear[this.idx(x, y)] = 1;
    };
    // lake + a stream winding in from the east
    const K = LAYOUT.lake;
    for (let y = Y0; y < MEADOW_END; y++)
      for (let x = 0; x < ORIG_W; x++) {
        const dx = (x + 0.5 - K.cx) / K.rx, dy = (y + 0.5 - K.cy) / K.ry;
        const wob = (fbm(x / 3, y / 3, this.seed + 77, 2) - 0.5) * 0.5;
        if (dx * dx + dy * dy < 1 + wob) this.ground[this.idx(x, y)] = G_WATER;
      }
    for (let x = Math.floor(K.cx + K.rx - 1); x < ORIG_W; x++) {
      const y = Math.round(K.cy + 1 + Math.sin(x * 0.32) * 1.6 + Math.max(0, x - 40) * 0.12);
      for (const yy of [y, y + 1]) if (yy < MEADOW_END) this.ground[this.idx(x, yy)] = G_WATER;
    }
    markClear(M.x0, M.y0, M.x1, M.y1);
    markClear(Math.floor(K.cx - K.rx - 1), Math.floor(K.cy - K.ry - 1), Math.ceil(K.cx + K.rx + 1), Math.ceil(K.cy + K.ry + 1));
    markClear(26, Y0, 34, M.y0);

    // second shipping bin by the entrance
    this.addStructure('bin', LAYOUT.bin2.tx, LAYOUT.bin2.ty);
    markClear(LAYOUT.bin2.tx - 1, LAYOUT.bin2.ty - 2, LAYOUT.bin2.tx + 2, LAYOUT.bin2.ty + 1);

    const placeTree = (kind, tx, ty) => {
      if (!this.inBounds(tx, ty) || ty < Y0 || clear[this.idx(tx, ty)] || this.prop[this.idx(tx, ty)] >= 0) return;
      if (this.ground[this.idx(tx, ty)] === G_WATER) return;
      this.addProp({ type: 'tree', kind, v: Math.floor(rng() * 6), tx, ty, solid: true, ox: 0 });
    };
    // forest on the sides and bottom (the top is the old forest edge)
    for (let ty = Y0; ty < MEADOW_END + 2; ty += 2)
      for (let tx = 0; tx < ORIG_W + 2; tx += 2) {
        const jx = tx + Math.floor(rng() * 2), jy = ty + Math.floor(rng() * 2);
        if (jx >= ORIG_W || jy >= MEADOW_END) continue;
        const e = Math.min(jx, ORIG_W - 1 - jx, MEADOW_END - 1 - jy, (jy - Y0) * 1.6);
        const band = 2.2 + fbm(jx / 6, jy / 6, this.seed + 70, 2) * 3.2;
        if (e > band) continue;
        placeTree(rng() < 0.4 ? 'pine' : rng() < 0.2 ? 'cherry' : 'oak', jx, jy);
      }
    for (const [k, x, y] of [['cherry', 8, 50], ['maple', 52, 49], ['cherry', 22, 66], ['oak', 44, 66], ['maple', 5, 63], ['cherry', 55, 60]]) placeTree(k, x, y);
    for (let i = 0; i < 26; i++) {
      const tx = 2 + Math.floor(rng() * (ORIG_W - 4)), ty = Y0 + 1 + Math.floor(rng() * (MEADOW_END - Y0 - 3));
      const ii = this.idx(tx, ty);
      if (clear[ii] || this.prop[ii] >= 0 || this.ground[ii] === G_WATER) continue;
      const r = rng();
      this.addProp(r < 0.6 ? { type: 'bush', v: Math.floor(rng() * 5), tx, ty, solid: true, ox: Math.floor(rng() * 4) - 2 }
        : { type: 'rock', v: Math.floor(rng() * 4), tx, ty, solid: true, ox: Math.floor(rng() * 4) - 2 });
    }
    this.computeWaterDepth();
    this.lilyAndReeds(rng, Y0, MEADOW_END - 1);
    this.decorate(Y0, MEADOW_END, M, 0.4);
  }

  /** Blossom Hills: the third plot. Its own random stream, so it never disturbs the areas above. */
  generateHills() {
    const rng = makeRng((this.seed ^ 0x51ed270b) >>> 0);
    const Y0 = MEADOW_END;
    const Hz = LAYOUT.hills;
    const clear = new Uint8Array(MAP_W * MAP_H);
    const markClear = (x0, y0, x1, y1) => {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (this.inBounds(x, y)) clear[this.idx(x, y)] = 1;
    };
    // pond with a little island in the middle
    const P = LAYOUT.hillPond;
    for (let y = Y0; y < MAP_H; y++)
      for (let x = 0; x < ORIG_W; x++) {
        const dx = (x + 0.5 - P.cx) / P.rx, dy = (y + 0.5 - P.cy) / P.ry;
        const d = dx * dx + dy * dy + (fbm(x / 3, y / 3, this.seed + 91, 2) - 0.5) * 0.4;
        if (d < 1 && d > 0.09) this.ground[this.idx(x, y)] = G_WATER;
      }
    markClear(Hz.x0, Hz.y0, Hz.x1, Hz.y1);
    markClear(26, Y0, 34, Hz.y0);
    markClear(Math.floor(P.cx - P.rx - 1), Math.floor(P.cy - P.ry - 1), Math.ceil(P.cx + P.rx + 1), Math.ceil(P.cy + P.ry + 1));
    // landmarks
    this.addStructure('bin', LAYOUT.bin3.tx, LAYOUT.bin3.ty);
    this.addStructure('wish', LAYOUT.wish.tx, LAYOUT.wish.ty);
    this.addStructure('windmill', LAYOUT.windmill.tx, LAYOUT.windmill.ty);
    // a cherry tree on the island
    const isl = this.idx(Math.floor(P.cx), Math.floor(P.cy));
    if (this.ground[isl] !== G_WATER) this.addProp({ type: 'tree', kind: 'cherry', v: 1, tx: Math.floor(P.cx), ty: Math.floor(P.cy), solid: true, ox: 0 });
    const placeTree = (kind, tx, ty) => {
      if (!this.inBounds(tx, ty) || ty < Y0 || clear[this.idx(tx, ty)] || this.prop[this.idx(tx, ty)] >= 0) return;
      if (this.ground[this.idx(tx, ty)] === G_WATER) return;
      this.addProp({ type: 'tree', kind, v: Math.floor(rng() * 6), tx, ty, solid: true, ox: 0 });
    };
    for (let ty = Y0; ty < MAP_H + 2; ty += 2)
      for (let tx = 0; tx < ORIG_W + 2; tx += 2) {
        const jx = tx + Math.floor(rng() * 2), jy = ty + Math.floor(rng() * 2);
        if (jx >= ORIG_W || jy >= MAP_H) continue;
        const e = Math.min(jx, ORIG_W - 1 - jx, MAP_H - 1 - jy, (jy - Y0) * 1.6);
        const band = 2.2 + fbm(jx / 6, jy / 6, this.seed + 95, 2) * 3.2;
        if (e > band) continue;
        placeTree(rng() < 0.35 ? 'cherry' : rng() < 0.3 ? 'maple' : rng() < 0.5 ? 'pine' : 'oak', jx, jy);
      }
    for (let i = 0; i < 22; i++) {
      const tx = 2 + Math.floor(rng() * (ORIG_W - 4)), ty = Y0 + 1 + Math.floor(rng() * (MAP_H - Y0 - 3));
      const ii = this.idx(tx, ty);
      if (clear[ii] || this.prop[ii] >= 0 || this.ground[ii] === G_WATER) continue;
      this.addProp(rng() < 0.65 ? { type: 'bush', v: Math.floor(rng() * 5), tx, ty, solid: true, ox: Math.floor(rng() * 4) - 2 }
        : { type: 'rock', v: Math.floor(rng() * 4), tx, ty, solid: true, ox: Math.floor(rng() * 4) - 2 });
    }
    this.computeWaterDepth();
    this.lilyAndReeds(rng, Y0, MAP_H - 1);
    this.decorate(Y0, MAP_H, Hz, 0.7);
  }

  /** The Wildwood: a wild forest east of the farm, full of things to gather and find. */
  generateWildwood() {
    const rng = makeRng((this.seed ^ 0x7a11d00d) >>> 0);
    const X0 = WILD_X;
    const free = (x, y) => {
      const i = this.idx(x, y);
      return this.ground[i] !== G_WATER && this.prop[i] < 0 && this.struct[i] < 0 && !this.isFern(x, y);
    };
    // rivers continuing the farm's streams eastward
    const river = (y0, amp, f, seed) => {
      let first = null;
      for (let x = X0; x < MAP_W; x++) {
        const y = Math.round(y0 + Math.sin(x * f + seed) * amp + Math.sin(x * f * 2.3) * 0.8);
        if (first === null) first = y;
        for (const yy of [y, y + 1]) if (this.inBounds(x, yy)) this.ground[this.idx(x, yy)] = G_WATER;
      }
      // join up with the farm's stream where it leaves the farm (without touching the farm itself)
      for (let y = y0 - 6; y <= y0 + 6; y++) {
        if (this.groundAt(X0 - 1, y) !== G_WATER) continue;
        const lo = Math.min(y, first), hi = Math.max(y, first + 1);
        for (let yy = lo; yy <= hi; yy++) this.ground[this.idx(X0, yy)] = G_WATER;
      }
    };
    river(31, 2.2, 0.21, 1);
    river(63, 2, 0.18, 4);
    // a quiet pool deep in the woods
    for (let y = 72; y < 84; y++)
      for (let x = 74; x < 92; x++) {
        const dx = (x + 0.5 - 82) / 6.5, dy = (y + 0.5 - 78) / 4.2;
        if (dx * dx + dy * dy < 1 + (fbm(x / 3, y / 3, this.seed + 131, 2) - 0.5) * 0.5) this.ground[this.idx(x, y)] = G_WATER;
      }
    this.addStructure('hut', LAYOUT.hut.tx, LAYOUT.hut.ty);
    this.addStructure('shrine', LAYOUT.shrine.tx, LAYOUT.shrine.ty);
    const keepClear = (x, y) =>
      (x <= X0 + 4 && y >= 7 && y <= 13) || // the entrance trail
      (Math.abs(x - (LAYOUT.hut.tx + 1)) <= 3 && y >= LAYOUT.hut.ty - 3 && y <= LAYOUT.hut.ty + 5) ||
      (Math.abs(x - (LAYOUT.shrine.tx + 1)) <= 3 && y >= LAYOUT.shrine.ty - 3 && y <= LAYOUT.shrine.ty + 4);
    // the forest: dense in places, open glades in others; the outer rim is old untouchable woods
    for (let y = 0; y < MAP_H; y++)
      for (let x = X0; x < MAP_W; x++) {
        if (!free(x, y) || keepClear(x, y)) continue;
        const rim = x >= MAP_W - 3 || y >= MAP_H - 2 || y <= 1;
        const dens = fbm(x / 9, y / 9, this.seed + 141, 3);
        const chance = rim ? 0.55 : dens > 0.55 ? 0.5 : dens > 0.47 ? 0.22 : 0.04;
        if ((x + y) % 2 === 0 && rng() < chance) {
          const kind = rng() < 0.45 ? 'pine' : rng() < 0.15 ? 'maple' : rng() < 0.1 ? 'cherry' : 'oak';
          this.addProp({ type: 'tree', kind, v: Math.floor(rng() * 6), tx: x, ty: y, solid: true, ox: 0, wild: !rim });
        }
      }
    // rocks, ore, forage spots and treasure chests in the open ground
    const spots = [];
    for (let y = 2; y < MAP_H - 2; y++) for (let x = X0 + 1; x < MAP_W - 3; x++) if (free(x, y) && !keepClear(x, y)) spots.push([x, y]);
    const take = () => {
      for (let k = 0; k < 40 && spots.length; k++) {
        const j = Math.floor(rng() * spots.length);
        const [x, y] = spots[j];
        spots.splice(j, 1);
        if (free(x, y)) return [x, y];
      }
      return null;
    };
    const depthKind = (y) => {
      const r = rng() + y / MAP_H * 0.6;
      return r > 1.35 ? 'crystal' : r > 1.0 ? 'gold' : r > 0.62 ? 'iron' : 'copper';
    };
    for (let k = 0; k < 60; k++) { const p = take(); if (p) this.addProp({ type: 'rock', v: Math.floor(rng() * 4), tx: p[0], ty: p[1], solid: true, ox: 0, wild: true }); }
    for (let k = 0; k < 50; k++) { const p = take(); if (p) this.addProp({ type: 'ore', kind: depthKind(p[1]), tx: p[0], ty: p[1], solid: true, ox: 0, wild: true }); }
    for (let k = 0; k < 55; k++) { const p = take(); if (p) this.addProp({ type: 'forage', kind: rng.pick(['herbs', 'mushrooms', 'berries']), tx: p[0], ty: p[1], solid: false, ox: 0, wild: true }); }
    for (let k = 0; k < 9; k++) {
      // spread the chests out from top to bottom
      const band = spots.filter(([, y]) => y >= k * 11 && y < k * 11 + 11);
      if (!band.length) continue;
      const [x, y] = band[Math.floor(rng() * band.length)];
      if (free(x, y)) this.addProp({ type: 'chest', tx: x, ty: y, solid: true, ox: 0, wild: true, tier: Math.min(2, Math.floor(y / 34)) });
    }
    this.computeWaterDepth();
    // reeds along the wild rivers + lots of flowers
    for (let y = 1; y < MAP_H - 1; y++)
      for (let x = X0; x < MAP_W - 1; x++) {
        const i = this.idx(x, y);
        if (this.ground[i] === G_WATER || this.prop[i] >= 0 || this.struct[i] >= 0) continue;
        const nearWater = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => this.ground[this.idx(x + dx, y + dy)] === G_WATER);
        if (nearWater && rng() < 0.3) { this.addProp({ type: 'reeds', v: Math.floor(rng() * 3), tx: x, ty: y, solid: false, ox: 0 }); continue; }
        const h = hash2(x, y, this.seed + 151);
        if (h < 0.2) this.deco[i] = 1 + Math.floor(hash2(x, y, 8) * 3);
        else if (h < 0.3) this.deco[i] = 4 + Math.floor(hash2(x, y, 9) * 6);
      }
  }

  /** Cut a path through the old forest edge down to the meadow gate. Safe to re-run after loading a save. */
  carvePassage() {
    const g = LAYOUT.gate;
    const keep = this.props.filter((p) => !(p.tx >= g.tx - 2 && p.tx <= g.tx + 3 && p.ty >= 34 && p.ty <= ORIG_H + 3));
    if (keep.length !== this.props.length) {
      this.props = keep;
      this.prop.fill(-1);
      this.props.forEach((p, i) => { this.prop[this.idx(p.tx, p.ty)] = i; });
    }
    if (!this.structures.some((s) => s.type === 'gate')) this.addStructure('gate', g.tx, g.ty);
    const pave = (x, y) => {
      const i = this.idx(x, y);
      if (this.ground[i] !== G_GRASS || this.objs.has(i) || this.crops.has(i) || this.struct[i] >= 0) return;
      this.floor[i] = F_PATH;
      this.deco[i] = 0;
    };
    for (let y = 34; y <= ORIG_H + 3; y++) if (y !== g.ty) { pave(g.tx, y); pave(g.tx + 1, y); }
    // ...and from the bottom of the meadow down to Blossom Hills
    const g2 = LAYOUT.gate2;
    const keep2 = this.props.filter((p) => !(p.tx >= g2.tx - 2 && p.tx <= g2.tx + 3 && p.ty >= 63 && p.ty <= MEADOW_END + 3));
    if (keep2.length !== this.props.length) {
      this.props = keep2;
      this.prop.fill(-1);
      this.props.forEach((p, i) => { this.prop[this.idx(p.tx, p.ty)] = i; });
    }
    if (!this.structures.some((s) => s.type === 'gate2')) this.addStructure('gate2', g2.tx, g2.ty);
    for (let y = 66; y <= MEADOW_END + 3; y++) if (y !== g2.ty) { pave(g2.tx, y); pave(g2.tx + 1, y); }
    // ...and the trail east into the Wildwood
    const keep3 = this.props.filter((p) => !(p.tx >= 51 && p.tx <= WILD_X + 3 && p.ty >= 8 && p.ty <= 12));
    if (keep3.length !== this.props.length) {
      this.props = keep3;
      this.prop.fill(-1);
      this.props.forEach((p, i) => { this.prop[this.idx(p.tx, p.ty)] = i; });
    }
    for (let x = 40; x <= WILD_X + 3; x++) pave(x, 10);
  }

  addStructure(type, tx, ty) {
    const d = STRUCT_DEFS[type];
    const s = { type, tx, ty, w: d.w, h: d.h };
    const id = this.structures.push(s) - 1;
    for (let y = ty; y < ty + d.h; y++) for (let x = tx; x < tx + d.w; x++) {
      const i = this.idx(x, y);
      this.struct[i] = id;
      this.deco[i] = 0;
    }
    return s;
  }

  addProp(p) {
    const id = this.props.push(p) - 1;
    this.prop[this.idx(p.tx, p.ty)] = id;
    return p;
  }

  computeWaterDepth() {
    // BFS distance (in tiles) from land
    const q = [];
    for (let y = 0; y < MAP_H; y++)
      for (let x = 0; x < MAP_W; x++) {
        const i = this.idx(x, y);
        if (this.ground[i] !== G_WATER) continue;
        const shore = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
          const g = this.groundAt(x + dx, y + dy);
          return g !== G_WATER && g !== -1;
        });
        this.waterDepth[i] = shore ? 0 : 255;
        if (shore) q.push(i);
      }
    while (q.length) {
      const i = q.shift();
      const x = i % MAP_W, y = (i / MAP_W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (!this.inBounds(x + dx, y + dy)) continue;
        const j = this.idx(x + dx, y + dy);
        if (this.ground[j] === G_WATER && this.waterDepth[j] > this.waterDepth[i] + 1) {
          this.waterDepth[j] = this.waterDepth[i] + 1;
          q.push(j);
        }
      }
    }
  }

  /* ----------------------------- save / load ----------------------------- */

  serialize() {
    const crops = [];
    for (const [i, c] of this.crops) crops.push([i, c.id, Math.round(c.growth * 100) / 100, c.harvests || 0]);
    const objs = [];
    for (const [i, o] of this.objs) {
      const { type, tier, ...extra } = o;
      objs.push(Object.keys(extra).length ? [i, type, tier || 0, extra] : [i, type, tier || 0]);
    }
    const wet = new Uint8Array(this.wet.length);
    for (let i = 0; i < wet.length; i++) wet[i] = Math.round(Math.max(0, Math.min(1, this.wet[i])) * 255);
    return {
      seed: this.seed,
      ground: b64(this.ground), floor: b64(this.floor), wet: b64(wet), fert: b64(this.fert), deco: b64(this.deco),
      crops, objs, weeds: [...this.weeds], w: MAP_W, wild: this.wildState, explored: b64(this.explored),
    };
  }

  load(d) {
    // saves from before the Wildwood were 60 tiles wide: copy them row by row into the wider map
    const w = d.w || ORIG_W;
    const put = (dst, src) => {
      if (w === MAP_W) { dst.set(src.subarray(0, Math.min(src.length, dst.length))); return; }
      const rows = Math.floor(src.length / w);
      for (let y = 0; y < rows && y < MAP_H; y++) dst.set(src.subarray(y * w, y * w + Math.min(w, MAP_W)), y * MAP_W);
    };
    const re = (i) => (w === MAP_W ? i : Math.floor(i / w) * MAP_W + (i % w));
    put(this.ground, unb64(d.ground));
    put(this.floor, unb64(d.floor));
    const wet = new Uint8Array(this.wet.length);
    put(wet, unb64(d.wet));
    for (let i = 0; i < wet.length; i++) this.wet[i] = wet[i] / 255;
    put(this.fert, unb64(d.fert));
    put(this.deco, unb64(d.deco));
    this.crops.clear();
    for (const [i, id, growth, harvests] of d.crops) this.crops.set(re(i), { id, growth, harvests });
    this.objs.clear();
    for (const [i, type, tier, extra] of d.objs) this.objs.set(re(i), { type, tier, ...(extra || {}) });
    this.weeds = new Map((d.weeds || []).map(([i, v]) => [re(i), v]));
    this.wildState = d.wild || {};
    if (d.explored) this.explored.set(unb64(d.explored).subarray(0, this.explored.length));
    // anything an old save had where a building now stands gets removed
    for (const m of [this.crops, this.objs, this.weeds])
      for (const i of [...m.keys()]) if (i >= this.struct.length || this.struct[i] >= 0 || (this.prop[i] >= 0 && this.props[this.prop[i]].solid)) m.delete(i);
    this.carvePassage();
  }
}

function b64(u8) {
  let s = '';
  for (let i = 0; i < u8.length; i += 4096) s += String.fromCharCode.apply(null, u8.subarray(i, i + 4096));
  return btoa(s);
}
function unb64(str) {
  const s = atob(str);
  const u8 = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
  return u8;
}
