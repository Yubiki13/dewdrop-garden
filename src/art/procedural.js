// Procedurally painted pixel art for big things (trees, buildings) + small decor.
import { Painter, sprite } from './palette.js';
import { hexToRgb, BAYER4, makeRng } from '../core/util.js';

const rgb = (h) => hexToRgb(h);

/* ---------------------------- Trees ---------------------------- */

const TREE_TONES = {
  oak: ['#173d2c', '#22603a', '#368a43', '#5cb04e', '#9ad660'],
  cherry: ['#6e2f58', '#a84a82', '#d873a8', '#f2a2c8', '#ffd6ea'],
  maple: ['#6a2a1e', '#a8442a', '#d8683a', '#f09a4a', '#ffc870'],
};

function shadeBlobs(p, circles, tones, rng, ox = 0, oy = 0) {
  const T = tones.map(rgb);
  // front-most circle (largest cy + r) wins
  const sorted = [...circles].sort((a, b) => a.y + a.r - (b.y + b.r));
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      let hit = null;
      for (const c of sorted) {
        const dx = x + 0.5 - c.x, dy = y + 0.5 - c.y;
        if (dx * dx + dy * dy <= c.r * c.r) hit = { c, dx, dy };
      }
      if (!hit) continue;
      const { c, dx, dy } = hit;
      let l = -(dx * 0.55 + dy * 0.85) / c.r; // light from top-left
      l += (rng() - 0.5) * 0.25;
      l = l * 1.6 + 1.9 + BAYER4[(y + oy) & 3][(x + ox) & 3] - 0.5;
      const idx = Math.max(0, Math.min(T.length - 1, Math.floor(l)));
      p.set(x, y, T[idx]);
    }
}

function trunk(p, cx, top, bottom, w = 6) {
  const bark = ['#4a2e22', '#6a4430', '#8a5a3a'].map(rgb);
  for (let y = top; y <= bottom; y++) {
    const half = w / 2 + (y > bottom - 3 ? (y - (bottom - 3)) * 0.7 : 0); // roots flare out
    for (let x = Math.floor(cx - half); x < Math.ceil(cx + half); x++) {
      const rel = (x - (cx - half)) / (half * 2);
      let t = rel < 0.3 ? 2 : rel < 0.75 ? 1 : 0;
      if ((x * 7 + y * 3) % 11 === 0) t = Math.max(0, t - 1);
      p.set(x, y, bark[t]);
    }
  }
}

export function makeTree(kind, seed) {
  const rng = makeRng(seed);
  if (kind === 'pine') return makePine(rng);
  const W = 44, H = 58;
  const p = new Painter(W, H);
  const cx = 22, baseY = 55;
  const CY = 26;
  trunk(p, cx, 32, baseY, 6);
  // a couple of branches
  p.set(cx - 4, 40, '#6a4430'); p.set(cx - 5, 39, '#6a4430');
  p.set(cx + 4, 39, '#6a4430'); p.set(cx + 5, 38, '#6a4430');
  const circles = [{ x: cx, y: CY, r: 14.5 }];
  const n = 6 + Math.floor(rng() * 3);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rng() * 0.6;
    const d = 9 + rng() * 4;
    circles.push({ x: cx + Math.cos(a) * d * 1.1, y: CY + Math.sin(a) * d * 0.8, r: 6.5 + rng() * 3 });
  }
  circles.push({ x: cx - 5, y: CY - 8, r: 8 }, { x: cx + 6, y: CY - 6, r: 8 });
  shadeBlobs(p, circles, TREE_TONES[kind] || TREE_TONES.oak, rng);
  // blossom / fruit speckles
  if (kind === 'cherry') {
    for (let i = 0; i < 26; i++) {
      const x = Math.floor(cx - 16 + rng() * 32), y = Math.floor(CY - 14 + rng() * 26);
      if (p.get(x, y)) p.set(x, y, rng() < 0.5 ? '#ffffff' : '#ffd6ea');
    }
  }
  const s = p.finish(true, 0.55);
  return { ...s, ax: cx, ay: baseY, canopy: { x: 0, y: 4, w: 44, h: 38 } };
}

function makePine(rng) {
  const W = 34, H = 60;
  const p = new Painter(W, H);
  const cx = 17, baseY = 57;
  trunk(p, cx, 44, baseY, 5);
  const T = ['#12302a', '#1a4a38', '#25664a', '#3a8a5a', '#6ab878'].map(rgb);
  const layers = 5;
  for (let L = 0; L < layers; L++) {
    const top = 2 + L * 8, bot = top + 16;
    for (let y = top; y < bot; y++) {
      const t = (y - top) / (bot - top);
      const half = 3 + t * (6 + L * 2.3);
      for (let x = Math.floor(cx - half); x <= Math.ceil(cx + half); x++) {
        const rel = (x - cx) / half;
        if (Math.abs(rel) > 1) continue;
        // jagged bottom edge
        if (y === bot - 1 && (x + L) % 3 === 0) continue;
        let l = -rel * 1.3 + (1 - t) * 1.2 + 1.6 + BAYER4[y & 3][x & 3] - 0.5 + (rng() - 0.5) * 0.4;
        if (y > bot - 3) l -= 1;
        p.set(x, y, T[Math.max(0, Math.min(4, Math.floor(l)))]);
      }
    }
  }
  const s = p.finish(true, 0.55);
  return { ...s, ax: cx, ay: baseY, canopy: { x: 0, y: 0, w: 34, h: 46 } };
}

export function makeBush(seed, flowers) {
  const rng = makeRng(seed);
  const p = new Painter(22, 17);
  const circles = [{ x: 11, y: 10, r: 6.5 }, { x: 6.5, y: 11, r: 4.5 }, { x: 15.5, y: 11, r: 4.5 }, { x: 11, y: 6.5, r: 4.5 }];
  shadeBlobs(p, circles, TREE_TONES.oak, rng);
  if (flowers) {
    const cols = flowers === 'berry' ? ['#e04a4a', '#9e2a3a'] : flowers === 'blue' ? ['#8ac4f0', '#4a7ad0'] : ['#ffffff', '#ffd0e6'];
    for (let i = 0; i < 7; i++) {
      const x = 3 + Math.floor(rng() * 16), y = 3 + Math.floor(rng() * 11);
      if (p.get(x, y)) { p.set(x, y, cols[0]); if (p.get(x + 1, y + 1)) p.set(x + 1, y + 1, cols[1]); }
    }
  }
  return p.finish(true, 0.55);
}

export function makeRock(seed, big = false) {
  const rng = makeRng(seed);
  const W = big ? 18 : 12, H = big ? 14 : 10;
  const p = new Painter(W, H);
  const T = ['#4a475a', '#6e6a80', '#9490a6', '#bcb8cc'].map(rgb);
  const cx = W / 2, cy = H / 2 + 1, rx = W / 2 - 1, ry = H / 2 - 1;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      const wob = Math.sin(x * 1.7 + seed) * 0.08;
      if (dx * dx + dy * dy > 1 + wob) continue;
      let l = -(dx * 0.6 + dy * 1.0) * 1.3 + 1.6 + BAYER4[y & 3][x & 3] - 0.5;
      p.set(x, y, T[Math.max(0, Math.min(3, Math.floor(l)))]);
    }
  if (rng() < 0.5) { p.set(Math.floor(cx - 1), Math.floor(cy - 2), '#5cb04e'); p.set(Math.floor(cx), Math.floor(cy - 2), '#368a43'); }
  return p.finish(true, 0.6);
}

export function makeStump() {
  const p = new Painter(14, 11);
  const bark = ['#4a2e22', '#6a4430', '#8a5a3a'].map(rgb);
  for (let y = 3; y < 11; y++)
    for (let x = 1; x < 13; x++) p.set(x, y, bark[x < 4 ? 2 : x < 10 ? 1 : 0]);
  for (let y = 0; y < 6; y++)
    for (let x = 1; x < 13; x++) {
      const dx = (x + 0.5 - 7) / 6, dy = (y + 0.5 - 3) / 2.6;
      const d = dx * dx + dy * dy;
      if (d <= 1) p.set(x, y, d > 0.6 ? '#c8945a' : (Math.floor(d * 6) % 2 ? '#d8aa70' : '#b88048'));
    }
  return p.finish(true, 0.6);
}

/* ---------------------------- Buildings ---------------------------- */

export function makeHouse() {
  const W = 80, H = 86;
  const p = new Painter(W, H);
  // chimney (behind roof)
  for (let y = 2; y < 20; y++)
    for (let x = 58; x < 66; x++) p.set(x, y, ((y >> 1) + (x >> 2)) % 2 ? '#8a8090' : '#746a7c');
  p.rect(57, 0, 10, 3, '#5a5060');
  // roof
  const roofTop = 6, roofBot = 44;
  for (let y = roofTop; y < roofBot; y++) {
    const t = (y - roofTop) / (roofBot - roofTop);
    const inset = Math.round((1 - t) * 7);
    const row = Math.floor((y - roofTop) / 5), off = (row % 2) * 4, ry = (y - roofTop) % 5;
    for (let x = inset; x < W - inset; x++) {
      let c = ry === 0 ? '#d8664c' : ry === 4 ? '#7e2e2a' : '#b54a3a';
      if ((x + off) % 8 === 0 && ry > 0) c = '#8e3530';
      if (t > 0.85 && ry > 1) c = ry === 4 ? '#6e2626' : '#a04034';
      if (x === inset || x === W - inset - 1) c = '#6e2626';
      p.set(x, y, c);
    }
  }
  p.rect(7, roofTop - 2, W - 14, 3, '#6e2a28');
  p.hline(7, W - 8, roofTop - 2, '#8e3530');
  // walls
  for (let y = 44; y < 80; y++)
    for (let x = 4; x < 76; x++) {
      const n = (x * 13 + y * 7) % 17 === 0;
      p.set(x, y, n ? '#e2d0a8' : y < 47 ? '#cdb890' : '#efe0bc');
    }
  // timber frame
  for (const bx of [4, 29, 50, 74]) p.rect(bx, 44, 2, 34, '#7a4a30');
  p.rect(4, 44, 72, 2, '#7a4a30');
  p.rect(4, 70, 72, 1, '#9a6440');
  // foundation
  for (let y = 78; y < 82; y++)
    for (let x = 3; x < 77; x++) p.set(x, y, ((x >> 2) + (y >> 1)) % 2 ? '#9a96a6' : '#827e92');
  // door
  for (let y = 54; y < 80; y++)
    for (let x = 33; x < 47; x++) {
      if (y < 57 && (x - 40) * (x - 40) + (y - 57) * (y - 57) * 4 > 50) continue;
      p.set(x, y, x % 3 === 0 ? '#6a4024' : '#8a5a34');
    }
  for (let y = 54; y < 80; y++) { p.set(32, y, '#5a3420'); p.set(47, y, '#5a3420'); }
  p.hline(33, 46, 53, '#5a3420');
  p.set(44, 67, '#f5d44a'); p.set(44, 68, '#c98f22');
  // step
  for (let y = 80; y < 86; y++) for (let x = 30; x < 50; x++) p.set(x, y, y === 80 ? '#c8c4d4' : y < 84 ? '#aaa6b8' : '#8a869a');
  // windows
  for (const wx of [10, 55]) {
    p.rect(wx - 1, 49, 17, 16, '#7a4a30');
    for (let y = 50; y < 64; y++)
      for (let x = wx; x < wx + 15; x++) {
        const diag = (x - wx) - (y - 50);
        p.set(x, y, diag > 2 && diag < 6 ? '#d4efff' : '#8ac4f0');
      }
    p.rect(wx + 7, 50, 1, 14, '#7a4a30');
    p.rect(wx, 56, 15, 1, '#7a4a30');
    // flower box
    p.rect(wx - 2, 64, 19, 4, '#8a5a34');
    p.hline(wx - 2, wx + 16, 67, '#5a3420');
    const fl = ['#f08ac0', '#ffffff', '#f5d44a', '#e04a4a'];
    for (let i = 0; i < 9; i++) {
      const fx = wx - 1 + i * 2;
      p.set(fx, 63, '#4fa64a');
      p.set(fx, 62, fl[i % 4]);
      if (i % 2) p.set(fx + 1, 63, '#2f7a3e');
    }
  }
  // wall lantern by the door
  p.rect(26, 52, 3, 1, '#3d3a4c');
  p.rect(25, 53, 5, 5, '#3d3a4c');
  p.rect(26, 54, 3, 3, '#f5d44a');
  const s = p.finish(true, 0.55);
  return {
    ...s,
    windows: [{ x: 10, y: 50, w: 15, h: 14 }, { x: 55, y: 50, w: 15, h: 14 }],
    lights: [{ x: 27, y: 55, r: 34 }, { x: 17, y: 57, r: 30 }, { x: 62, y: 57, r: 30 }],
    chimney: { x: 62, y: 0 },
  };
}

export function makeStall() {
  const W = 52, H = 58;
  const back = new Painter(W, H);
  const front = new Painter(W, H);
  // posts
  for (const px of [3, 46]) for (let y = 10; y < 54; y++) for (let x = px; x < px + 3; x++) back.set(x, y, x === px ? '#b07a4a' : '#7a4a30');
  // back wall
  for (let y = 20; y < 40; y++) for (let x = 6; x < 46; x++) back.set(x, y, y % 6 === 0 ? '#3e2618' : '#5a3a26');
  // shelf jars
  const jar = ['#e04a4a', '#f5d44a', '#8ac4f0', '#4fa64a', '#f08ac0', '#f08a2c'];
  for (let i = 0; i < 9; i++) {
    const x = 8 + i * 4 + (i > 4 ? 1 : 0);
    back.rect(x, 21, 3, 4, jar[i % 6]);
    back.set(x, 21, '#f6f1e7');
    back.rect(x, 27, 3, 4, jar[(i + 3) % 6]);
    back.set(x + 2, 27, '#f6f1e7');
  }
  // awning
  for (let y = 4; y < 20; y++) {
    const inset = Math.max(0, 4 - y);
    for (let x = inset; x < W - inset; x++) {
      const stripe = Math.floor(x / 6) % 2;
      let c = stripe ? '#f6f1e7' : '#e04a4a';
      if (y < 7) c = stripe ? '#d8d0c8' : '#b83a3a';
      if (y === 4) c = '#7e2626';
      back.set(x, y, c);
    }
  }
  for (let x = 0; x < W; x++) {
    const stripe = Math.floor(x / 6) % 2;
    const lx = x % 6;
    const dip = lx === 0 || lx === 5 ? 0 : lx === 1 || lx === 4 ? 1 : 2;
    for (let y = 20; y < 20 + dip; y++) back.set(x, y, stripe ? '#f6f1e7' : '#e04a4a');
  }
  // hanging sign
  back.rect(20, 0, 1, 4, '#4a2e22'); back.rect(31, 0, 1, 4, '#4a2e22');
  // counter (front layer)
  for (let y = 38; y < 54; y++)
    for (let x = 1; x < W - 1; x++) {
      let c = y < 41 ? (y === 38 ? '#e0b27a' : '#c08a58') : x % 8 === 0 ? '#5a3a26' : '#8a5a3a';
      if (y === 53) c = '#4a2e22';
      front.set(x, y, c);
    }
  // produce crates on counter
  const crate = (x0, cols) => {
    front.rect(x0, 33, 12, 6, '#9a6440');
    front.hline(x0, x0 + 11, 33, '#c08a58');
    for (let i = 0; i < 5; i++) {
      front.set(x0 + 1 + i * 2, 32, cols[0]); front.set(x0 + 2 + i * 2, 32, cols[1]);
      front.set(x0 + 2 + i * 2, 31, cols[0]);
    }
  };
  crate(4, ['#e04a4a', '#9e2a3a']);
  crate(36, ['#f08a2c', '#c4561e']);
  // seed packets on the counter
  for (let i = 0; i < 4; i++) {
    const x = 19 + i * 4;
    front.rect(x, 33, 3, 5, '#f2e2bc');
    front.set(x + 1, 35, ['#4fa64a', '#e04a4a', '#f5d44a', '#7a52c0'][i]);
  }
  return { back: back.finish(true, 0.55), front: front.finish(true, 0.55), w: W, h: H };
}

export function makeStallSign() {
  const p = new Painter(16, 10);
  p.rect(0, 0, 16, 10, '#8a5a34');
  p.rect(1, 1, 14, 8, '#c08a58');
  // tiny sprout icon
  p.set(7, 2, '#8fd65a'); p.set(8, 2, '#4fa64a'); p.set(6, 3, '#4fa64a'); p.set(9, 3, '#8fd65a');
  p.vline(7, 3, 6, '#2f7a3e');
  p.rect(5, 6, 6, 2, '#7a4a30');
  return p.finish(true, 0.55);
}

export function makeWell() {
  const W = 34, H = 46;
  const p = new Painter(W, H);
  // posts
  for (const px of [4, 27]) for (let y = 8; y < 34; y++) { p.set(px, y, '#b07a4a'); p.set(px + 1, y, '#8a5a3a'); p.set(px + 2, y, '#6a4430'); }
  // roof
  for (let y = 0; y < 12; y++) {
    const half = 6 + y * 1.25;
    for (let x = Math.floor(17 - half); x < Math.ceil(17 + half); x++) {
      const c = y === 11 ? '#6e2626' : (x + (y % 2) * 2) % 4 === 0 ? '#8e3530' : y % 3 === 0 ? '#d8664c' : '#b54a3a';
      p.set(x, y, c);
    }
  }
  // crossbar + rope + bucket
  p.rect(6, 13, 22, 2, '#7a4a30');
  p.vline(17, 15, 22, '#e0b27a');
  p.rect(14, 22, 7, 5, '#8f8ba3'); p.hline(14, 20, 22, '#cbc7d4'); p.hline(14, 20, 26, '#5c586e');
  // stone ring
  for (let y = 26; y < 45; y++)
    for (let x = 2; x < 32; x++) {
      const dx = (x + 0.5 - 17) / 15, top = (y + 0.5 - 30) / 4.5;
      if (y < 30 && dx * dx + top * top > 1) continue;
      const inner = dx * dx / 0.7 + ((y + 0.5 - 30) / 2.8) ** 2 < 1 && y < 32;
      if (inner) { p.set(x, y, y < 30 ? '#1e3a5a' : '#2a4a6a'); continue; }
      const brick = ((Math.floor(y / 3) % 2) * 3 + x) % 6 === 0 || y % 3 === 0;
      p.set(x, y, brick ? '#6e6a80' : x < 12 ? '#bcb8cc' : '#9490a6');
    }
  p.rect(2, 44, 30, 1, '#4a475a');
  return { ...p.finish(true, 0.55), ax: 17 };
}

export function makeBin() {
  const W = 32, H = 24;
  const p = new Painter(W, H);
  // lid
  for (let y = 2; y < 8; y++) for (let x = 1; x < 31; x++) p.set(x, y, y === 2 ? '#e0b27a' : y < 5 ? '#b07a4a' : '#8a5a3a');
  // body
  for (let y = 8; y < 23; y++)
    for (let x = 2; x < 30; x++) {
      let c = y % 5 === 0 ? '#5a3a26' : '#8a5a3a';
      if (x < 5) c = '#b07a4a';
      p.set(x, y, c);
    }
  // metal corners
  for (const cx of [2, 27]) { p.rect(cx, 8, 3, 15, '#8f8ba3'); p.vline(cx, 8, 22, '#cbc7d4'); }
  p.rect(1, 7, 30, 1, '#5c586e');
  // coin emblem
  p.rect(13, 12, 6, 6, '#c98f22'); p.rect(14, 13, 4, 4, '#f5d44a'); p.set(14, 13, '#fff3a0');
  return p.finish(true, 0.55);
}

export function makeSign() {
  const p = new Painter(16, 20);
  p.rect(7, 9, 2, 11, '#6a4430');
  p.rect(1, 2, 14, 9, '#8a5a34');
  p.rect(2, 3, 12, 7, '#c08a58');
  p.hline(4, 11, 5, '#6a4430'); p.hline(4, 9, 7, '#6a4430');
  return p.finish(true, 0.55);
}

/* ---------------------------- Small decor ---------------------------- */

export function makeLilyPad(flower) {
  const p = new Painter(9, 6);
  for (let y = 0; y < 6; y++)
    for (let x = 0; x < 9; x++) {
      const dx = (x + 0.5 - 4.5) / 4.5, dy = (y + 0.5 - 3) / 3;
      if (dx * dx + dy * dy > 1) continue;
      if (x >= 4 && x <= 5 && y < 3 && x - 4 <= y) continue; // notch
      p.set(x, y, dy < -0.2 ? '#6ab84a' : '#4a9a3e');
    }
  if (flower) { p.set(2, 1, '#ffd0e6'); p.set(3, 1, '#f08ac0'); p.set(2, 0, '#ffffff'); p.set(3, 2, '#f5d44a'); }
  return p.finish(true, 0.5);
}

export function makeReeds(seed) {
  const rng = makeRng(seed);
  const p = new Painter(11, 16);
  for (let i = 0; i < 4; i++) {
    const x = 1 + i * 3 - (i > 1 ? 1 : 0);
    const top = 3 + Math.floor(rng() * 5);
    for (let y = top; y < 16; y++) p.set(x, y, y > 12 ? '#2f7a3e' : '#4fa64a');
    if (i % 2 === 0) { p.set(x, top - 1, '#6a4430'); p.set(x, top - 2, '#6a4430'); p.set(x, top, '#7a4a30'); }
  }
  return p.finish(true, 0.5);
}

export function makeDeco() {
  const tuft = (rows) => sprite(rows, { outlineStrength: 0.4 });
  const flower = (c1, c2) =>
    sprite(['.' + c1 + '.', c1 + c2 + c1, '.' + c1 + 'h', '.Gh', '.G.'], { outlineStrength: 0.45 });
  return {
    tufts: [
      tuft(['..h..', 'h.G.h', '.hGh.', 'hGgGh']),
      tuft(['.h...h', '.G.h.G', 'hGhGhG', 'GgGgGg']),
      tuft(['h.h', 'GhG', 'gGg']),
    ],
    flowers: [flower('w', 'Y'), flower('Y', 'o'), flower('M', 'Y'), flower('c', 'w'), flower('l', 'Y'), flower('R', 'Y')],
  };
}

export function makeButterfly(c1, c2) {
  const open = sprite([c1 + '.' + c1, c2 + 'k' + c2, '.k.'], { outlineStrength: 0.5 });
  const shut = sprite(['.' + c1 + '.', '.k.', '.k.'], { outlineStrength: 0.5 });
  return [open, shut];
}

// Fence piece for a 4-bit neighbour mask (N=1,E=2,S=4,W=8)
export function makeFence(mask) {
  const p = new Painter(16, 24);
  const L = '#c8945a', M = '#9a6440', D = '#6a4430';
  const rail = (y) => {
    if (mask & 8) { p.hline(0, 6, y, L); p.hline(0, 6, y + 1, D); }
    if (mask & 2) { p.hline(9, 15, y, L); p.hline(9, 15, y + 1, D); }
  };
  rail(12); rail(17);
  if (mask & 1) { p.rect(7, 0, 2, 12, M); p.vline(7, 0, 11, L); }
  if (mask & 4) { p.rect(7, 22, 2, 2, M); p.vline(7, 22, 23, L); }
  // post
  p.rect(6, 8, 4, 15, M);
  p.vline(6, 8, 22, L);
  p.vline(9, 8, 22, D);
  p.hline(6, 9, 8, '#e0b27a');
  return p.finish(true, 0.55);
}


/* ---------------------------- Delivery crate ---------------------------- */

export function makeCrate(gift) {
  const body = new Painter(16, 14);
  const L = '#d8a868', M = '#b07a4a', D = '#7a4a30', K = '#5a3420';
  for (let y = 0; y < 13; y++)
    for (let x = 1; x < 15; x++) {
      let c = y % 4 === 3 ? D : y % 4 === 0 ? L : M;
      if (x < 3 || x > 12) c = y % 2 ? D : M;
      body.set(x, y, c);
    }
  // diagonal brace
  for (let i = 0; i < 10; i++) { body.set(3 + i, 11 - i, L); body.set(3 + i, 12 - i, K); }
  for (const [x, y] of [[2, 1], [13, 1], [2, 11], [13, 11]]) body.set(x, y, '#cbc7d4');
  body.hline(1, 14, 13, K);
  if (gift) {
    body.rect(7, 0, 2, 13, '#f08ac0'); body.vline(7, 0, 12, '#ffb0d0');
  }
  const lid = new Painter(18, 5);
  for (let x = 0; x < 18; x++) {
    lid.set(x, 1, L); lid.set(x, 2, M); lid.set(x, 3, M); lid.set(x, 4, D);
    if (x % 6 === 5) { lid.set(x, 2, D); lid.set(x, 3, D); }
  }
  if (gift) {
    lid.rect(8, 0, 2, 5, '#f08ac0'); lid.vline(8, 0, 4, '#ffb0d0');
    // bow
    for (const [x, y] of [[5, 0], [6, 0], [6, 1], [7, 1], [10, 1], [11, 1], [11, 0], [12, 0]]) lid.set(x, y, '#f08ac0');
  }
  const plank = new Painter(6, 2);
  plank.rect(0, 0, 6, 1, L); plank.rect(0, 1, 6, 1, D);
  return { body: body.finish(true, 0.55), lid: lid.finish(true, 0.55), plank: plank.finish(false) };
}
