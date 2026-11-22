// Global pixel-art palette + a builder that turns string-art into canvases.
import { hexToRgb, makeCanvas, mixRgb } from '../core/util.js';

// One character -> one colour. '.' and ' ' are transparent.
export const PAL = {
  k: '#241826', // near black
  w: '#f6f1e7', W: '#ffffff',
  S: '#cbc7d4', s: '#8f8ba3', d: '#5c586e', D: '#3d3a4c',
  j: '#1e4a33', g: '#2f7a3e', G: '#4fa64a', h: '#8fd65a', q: '#c8ef8a',
  b: '#4a2e22', B: '#7a4a30', n: '#b07a4a', N: '#e0b27a', x: '#f2e2bc',
  r: '#9e2a3a', R: '#e04a4a', p: '#ff8c82',
  o: '#c4561e', O: '#f08a2c', P: '#ffc070',
  y: '#c98f22', Y: '#f5d44a', Z: '#fff3a0',
  v: '#4a2f7a', V: '#7a52c0', l: '#b89af0',
  u: '#2a4a8a', U: '#4a7ad0', c: '#8ac4f0', C: '#d4efff',
  m: '#b8407e', M: '#f08ac0', i: '#ffd0e6',
  f: '#f5c9a0', F: '#d99a74',
  a: '#3a6e8f', A: '#6fb4c8', // teal metal
  // character slots (overridden per character)
  H: '#7a4a2a', e: '#4e2c1a', T: '#5aa05a', t: '#3d7a45',
  E: '#4a72c0', I: '#344f90',
};

const OUTLINE_TINT = [26, 14, 34];
const rgbCache = {};
function rgbOf(hex) {
  return rgbCache[hex] || (rgbCache[hex] = hexToRgb(hex));
}

/**
 * Build a sprite from rows of characters.
 * Returns { img, w, h, pad } where pad is the transparent border added for the outline.
 */
export function sprite(rows, opts = {}) {
  const { outline = true, overrides = null, flip = false, outlineStrength = 0.62 } = opts;
  const pad = outline ? 1 : 0;
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const W = w + pad * 2, Hh = h + pad * 2;
  const c = makeCanvas(W, Hh);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(W, Hh);
  const px = img.data;
  const filled = new Uint8Array(W * Hh);
  for (let y = 0; y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < w; x++) {
      const ch = row[flip ? w - 1 - x : x];
      if (!ch || ch === '.' || ch === ' ') continue;
      const hex = (overrides && overrides[ch]) || PAL[ch];
      if (!hex) continue;
      const [r, g, b] = rgbOf(hex);
      const i = ((y + pad) * W + (x + pad)) * 4;
      px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255;
      filled[(y + pad) * W + x + pad] = 1;
    }
  }
  if (outline) addOutline(px, filled, W, Hh, outlineStrength);
  ctx.putImageData(img, 0, 0);
  return { img: c, w: W, h: Hh, pad };
}

// Selective outline: each empty pixel touching a filled one gets a darkened version of it.
function addOutline(px, filled, W, H, strength) {
  const out = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (filled[y * W + x]) continue;
      let best = -1, bestLum = 1e9;
      const nb = [[0, 1], [0, -1], [1, 0], [-1, 0]];
      for (const [dx, dy] of nb) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const ni = ny * W + nx;
        if (!filled[ni]) continue;
        const j = ni * 4;
        const lum = px[j] * 0.3 + px[j + 1] * 0.59 + px[j + 2] * 0.11;
        if (lum < bestLum) { bestLum = lum; best = j; }
      }
      if (best >= 0) {
        const c = mixRgb([px[best], px[best + 1], px[best + 2]], OUTLINE_TINT, strength);
        out.push([(y * W + x) * 4, c]);
      }
    }
  }
  for (const [i, c] of out) {
    px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = 255;
  }
}

// Outline an arbitrary canvas in place (used by procedural art).
export function outlineCanvas(canvas, strength = 0.62) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const img = ctx.getImageData(0, 0, W, H);
  const filled = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) filled[i] = img.data[i * 4 + 3] > 128 ? 1 : 0;
  addOutline(img.data, filled, W, H, strength);
  ctx.putImageData(img, 0, 0);
  return canvas;
}

export function drawSprite(ctx, spr, x, y, flipX = false) {
  if (!spr) return;
  if (flipX) {
    ctx.save();
    ctx.translate(Math.round(x) + spr.w - spr.pad, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(spr.img, 0, Math.round(y) - spr.pad);
    ctx.restore();
  } else {
    ctx.drawImage(spr.img, Math.round(x) - spr.pad, Math.round(y) - spr.pad);
  }
}

// Pixel-painter helper used for procedural sprites.
export class Painter {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.canvas = makeCanvas(w, h);
    this.ctx = this.canvas.getContext('2d');
    this.img = this.ctx.createImageData(w, h);
  }
  set(x, y, col, a = 255) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || !col) return;
    const c = typeof col === 'string' ? rgbOf(PAL[col] || col) : col;
    const i = (y * this.w + x) * 4;
    this.img.data[i] = c[0]; this.img.data[i + 1] = c[1]; this.img.data[i + 2] = c[2]; this.img.data[i + 3] = a;
  }
  get(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
    const i = (y * this.w + x) * 4;
    return this.img.data[i + 3] ? [this.img.data[i], this.img.data[i + 1], this.img.data[i + 2]] : null;
  }
  rect(x, y, w, h, col) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, col);
  }
  hline(x0, x1, y, col) { for (let x = x0; x <= x1; x++) this.set(x, y, col); }
  vline(x, y0, y1, col) { for (let y = y0; y <= y1; y++) this.set(x, y, col); }
  finish(outline = false, strength) {
    this.ctx.putImageData(this.img, 0, 0);
    if (outline) outlineCanvas(this.canvas, strength);
    return { img: this.canvas, w: this.w, h: this.h, pad: 0 };
  }
}
