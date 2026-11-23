// The garden map: terrain, buildings, trees, decor, crops and placed objects.
import {
  MAP_W, MAP_H, ORIG_H, G_GRASS, G_SOIL, G_WATER, F_PATH,
} from '../config.js';
import { makeRng, fbm, hash2 } from '../core/util.js';

export const STRUCT_DEFS = {
  house: { w: 5, h: 3 },
  stall: { w: 3, h: 2 },
  well: { w: 2, h: 2 },
  bin: { w: 2, h: 1 },
  sign: { w: 1, h: 1 },
  gate: { w: 2, h: 1 },
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
};

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
    return this.ground[i] !== G_WATER && this.struct[i] < 0 && this.prop[i] < 0 && !this.objs.has(i) && !this.isGranny(tx, ty);
  }

  isGranny(tx, ty) { return tx === LAYOUT.granny.tx && ty === LAYOUT.granny.ty; }

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
      for (let x = 0; x < MAP_W; x++) {
        const dx = (x + 0.5 - P.cx) / P.rx, dy = (y + 0.5 - P.cy) / P.ry;
        const wob = (fbm(x / 4, y / 4, this.seed + 40, 2) - 0.5) * 0.5;
        if (dx * dx + dy * dy < 1 + wob) this.ground[this.idx(x, y)] = G_WATER;
      }
    // little inlet stream
    for (let x = Math.floor(P.cx + P.rx - 2); x < MAP_W; x++) {
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
      for (let tx = 0; tx < MAP_W + 2; tx += 2) {
        const jx = tx + Math.floor(rng() * 2), jy = ty + Math.floor(rng() * 2);
        if (jx >= MAP_W || jy >= ORIG_H) continue;
        const e = Math.min(jx, jy, MAP_W - 1 - jx, ORIG_H - 1 - jy);
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
      const tx = 2 + Math.floor(rng() * (MAP_W - 4)), ty = 2 + Math.floor(rng() * (ORIG_H - 4));
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
    this.carvePassage();
    this.computeWaterDepth();
  }

  lilyAndReeds(rng, y0, y1) {
    for (let ty = y0; ty < y1; ty++)
      for (let tx = 1; tx < MAP_W - 1; tx++) {
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
      for (let tx = 0; tx < MAP_W; tx++) {
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
    for (let y = Y0; y < MAP_H; y++)
      for (let x = 0; x < MAP_W; x++) {
        const dx = (x + 0.5 - K.cx) / K.rx, dy = (y + 0.5 - K.cy) / K.ry;
        const wob = (fbm(x / 3, y / 3, this.seed + 77, 2) - 0.5) * 0.5;
        if (dx * dx + dy * dy < 1 + wob) this.ground[this.idx(x, y)] = G_WATER;
      }
    for (let x = Math.floor(K.cx + K.rx - 1); x < MAP_W; x++) {
      const y = Math.round(K.cy + 1 + Math.sin(x * 0.32) * 1.6 + Math.max(0, x - 40) * 0.12);
      for (const yy of [y, y + 1]) if (yy < MAP_H) this.ground[this.idx(x, yy)] = G_WATER;
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
    for (let ty = Y0; ty < MAP_H + 2; ty += 2)
      for (let tx = 0; tx < MAP_W + 2; tx += 2) {
        const jx = tx + Math.floor(rng() * 2), jy = ty + Math.floor(rng() * 2);
        if (jx >= MAP_W || jy >= MAP_H) continue;
        const e = Math.min(jx, MAP_W - 1 - jx, MAP_H - 1 - jy, (jy - Y0) * 1.6);
        const band = 2.2 + fbm(jx / 6, jy / 6, this.seed + 70, 2) * 3.2;
        if (e > band) continue;
        placeTree(rng() < 0.4 ? 'pine' : rng() < 0.2 ? 'cherry' : 'oak', jx, jy);
      }
    for (const [k, x, y] of [['cherry', 8, 50], ['maple', 52, 49], ['cherry', 22, 66], ['oak', 44, 66], ['maple', 5, 63], ['cherry', 55, 60]]) placeTree(k, x, y);
    for (let i = 0; i < 26; i++) {
      const tx = 2 + Math.floor(rng() * (MAP_W - 4)), ty = Y0 + 1 + Math.floor(rng() * (MAP_H - Y0 - 3));
      const ii = this.idx(tx, ty);
      if (clear[ii] || this.prop[ii] >= 0 || this.ground[ii] === G_WATER) continue;
      const r = rng();
      this.addProp(r < 0.6 ? { type: 'bush', v: Math.floor(rng() * 5), tx, ty, solid: true, ox: Math.floor(rng() * 4) - 2 }
        : { type: 'rock', v: Math.floor(rng() * 4), tx, ty, solid: true, ox: Math.floor(rng() * 4) - 2 });
    }
    this.computeWaterDepth();
    this.lilyAndReeds(rng, Y0, MAP_H - 1);
    this.decorate(Y0, MAP_H, M, 0.4);
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
    for (let y = 34; y <= ORIG_H + 3; y++)
      for (const x of [g.tx, g.tx + 1]) {
        const i = this.idx(x, y);
        if (y === g.ty || this.ground[i] !== G_GRASS || this.objs.has(i) || this.crops.has(i)) continue;
        this.floor[i] = F_PATH;
        this.deco[i] = 0;
      }
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
      crops, objs, weeds: [...this.weeds],
    };
  }

  load(d) {
    this.ground.set(unb64(d.ground));
    this.floor.set(unb64(d.floor));
    const wet = unb64(d.wet);
    for (let i = 0; i < wet.length; i++) this.wet[i] = wet[i] / 255;
    this.fert.set(unb64(d.fert));
    this.deco.set(unb64(d.deco));
    this.crops.clear();
    for (const [i, id, growth, harvests] of d.crops) this.crops.set(i, { id, growth, harvests });
    this.objs.clear();
    for (const [i, type, tier, extra] of d.objs) this.objs.set(i, { type, tier, ...(extra || {}) });
    this.weeds = new Map(d.weeds || []);
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
