// Draws the world onto a low-res canvas (scaled up crisp by CSS) plus a full-res overlay for
// text, tooltips and the pixel cursor. Also owns the free-moving camera.
import { TILE, MAP_W, MAP_H, G_SOIL, G_WATER, ZOOM_LEVELS, DEFAULT_ZOOM } from '../config.js';
import { ART } from '../art/index.js';
import { drawSprite } from '../art/palette.js';
import { stageOf } from '../data/crops.js';
import { ITEMS } from '../data/items.js';
import { LAYOUT } from './world.js';
import { SPRINKLER_RANGE, HAND } from './game.js';
import { hash2, lerp, clamp, makeCanvas, rand } from '../core/util.js';

const SKY = [
  [0, [48, 58, 118]], [4.5, [58, 66, 128]], [5.6, [150, 120, 160]], [6.4, [240, 180, 160]], [7.5, [255, 236, 220]],
  [9, [255, 255, 255]], [16.3, [255, 255, 255]], [17.6, [255, 222, 180]], [18.8, [240, 160, 140]], [19.8, [150, 110, 160]],
  [21, [78, 82, 145]], [24, [48, 58, 118]],
];

function skyTint(hour, rain) {
  let a = SKY[0], b = SKY[SKY.length - 1];
  for (let i = 0; i < SKY.length - 1; i++) if (hour >= SKY[i][0] && hour <= SKY[i + 1][0]) { a = SKY[i]; b = SKY[i + 1]; break; }
  const t = (hour - a[0]) / (b[0] - a[0] || 1);
  let c = [0, 1, 2].map((k) => lerp(a[1][k], b[1][k], t));
  if (rain > 0) c = c.map((v, k) => v * lerp(1, [0.74, 0.78, 0.88][k], rain));
  return c;
}

// white silhouettes for hover outlines, cached per sprite
function silhouette(spr, color) {
  spr._sil ||= {};
  if (!spr._sil[color]) {
    const c = makeCanvas(spr.img.width, spr.img.height);
    const x = c.getContext('2d');
    x.drawImage(spr.img, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = color;
    x.fillRect(0, 0, c.width, c.height);
    spr._sil[color] = c;
  }
  return spr._sil[color];
}

// cursor hotspots (where on the sprite the "click" happens) + resting tilt
const TOOL_CURSOR = {
  hoe: { hx: 13, hy: 3, rot: 0 }, can: { hx: 14, hy: 4, rot: 0 }, bucket: { hx: 8, hy: 12, rot: 0 },
  shovel: { hx: 3, hy: 13, rot: 0 }, sickle: { hx: 4, hy: 4, rot: 0 },
};

export class Renderer {
  constructor(canvas, overlay) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.overlay = overlay;
    this.octx = overlay.getContext('2d');
    this.light = makeCanvas(1, 1);
    this.lctx = this.light.getContext('2d');
    this.cam = { x: 0, y: 0, vx: 0, vy: 0 };
    this.zoom = DEFAULT_ZOOM;
    this.uiScale = 3;
    this.rain = [];
    this.clouds = Array.from({ length: 4 }, (_, i) => ({ x: rand(MAP_W * TILE), y: rand(MAP_H * TILE), r: rand(60, 110), s: rand(4, 8) + i }));
    this.mouse = null;
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const centre = this.vw ? { x: this.cam.x + this.vw / 2, y: this.cam.y + this.vh / 2 } : null;
    const physH = innerHeight * dpr, physW = innerWidth * dpr;
    this.scale = Math.max(1, Math.round(physH / ZOOM_LEVELS[this.zoom]));
    this.vw = Math.ceil(physW / this.scale);
    this.vh = Math.ceil(physH / this.scale);
    this.canvas.width = this.vw;
    this.canvas.height = this.vh;
    this.canvas.style.width = (this.vw * this.scale) / dpr + 'px';
    this.canvas.style.height = (this.vh * this.scale) / dpr + 'px';
    this.overlay.width = Math.round(physW);
    this.overlay.height = Math.round(physH);
    this.overlay.style.width = innerWidth + 'px';
    this.overlay.style.height = innerHeight + 'px';
    this.light.width = this.vw;
    this.light.height = this.vh;
    this.dpr = dpr;
    this.ctx.imageSmoothingEnabled = false;
    this.lctx.imageSmoothingEnabled = false;
    if (centre) this.centerOn(centre.x, centre.y);
  }

  /* ---------------------------- camera ---------------------------- */

  toWorld(sx, sy) {
    return { x: (sx * this.dpr) / this.scale + this.cam.x, y: (sy * this.dpr) / this.scale + this.cam.y };
  }
  toScreen(wx, wy) {
    return { x: ((wx - this.cam.x) * this.scale) / this.dpr, y: ((wy - this.cam.y) * this.scale) / this.dpr };
  }
  clampCam() {
    const W = MAP_W * TILE, H = MAP_H * TILE;
    this.cam.x = this.vw >= W ? (W - this.vw) / 2 : clamp(this.cam.x, 0, W - this.vw);
    this.cam.y = this.vh >= H ? (H - this.vh) / 2 : clamp(this.cam.y, 0, H - this.vh);
  }
  centerOn(wx, wy) {
    this.cam.x = wx - this.vw / 2;
    this.cam.y = wy - this.vh / 2;
    this.cam.vx = this.cam.vy = 0;
    this.clampCam();
    this.snap();
  }
  panWorld(dx, dy) { this.cam.x += dx; this.cam.y += dy; this.cam.vx = this.cam.vy = 0; this.clampCam(); this.snap(); }
  panScreen(dsx, dsy) { this.panWorld((dsx * this.dpr) / this.scale, (dsy * this.dpr) / this.scale); }
  fling(vsx, vsy) {
    this.cam.vx = clamp((vsx * this.dpr) / this.scale, -900, 900);
    this.cam.vy = clamp((vsy * this.dpr) / this.scale, -900, 900);
  }
  zoomBy(steps, sx, sy) {
    const z = clamp(this.zoom + steps, 0, ZOOM_LEVELS.length - 1);
    if (z === this.zoom) return;
    const before = this.toWorld(sx, sy);
    this.zoom = z;
    this.resize();
    this.cam.x = before.x - (sx * this.dpr) / this.scale;
    this.cam.y = before.y - (sy * this.dpr) / this.scale;
    this.clampCam();
    this.snap();
  }
  setZoom(z) { if (z !== this.zoom) { this.zoom = clamp(z, 0, ZOOM_LEVELS.length - 1); this.resize(); } }
  snap() { this.cx = Math.round(this.cam.x); this.cy = Math.round(this.cam.y); }

  updateCamera(dt) {
    if (this.cam.vx || this.cam.vy) {
      this.cam.x += this.cam.vx * dt;
      this.cam.y += this.cam.vy * dt;
      const k = Math.exp(-dt * 5);
      this.cam.vx *= k; this.cam.vy *= k;
      if (Math.abs(this.cam.vx) < 2 && Math.abs(this.cam.vy) < 2) this.cam.vx = this.cam.vy = 0;
      this.clampCam();
    }
    this.snap();
  }

  /** Smooth automatic drift (title screen). */
  glideTo(wx, wy, dt) {
    const tx = wx - this.vw / 2, ty = wy - this.vh / 2;
    const k = 1 - Math.exp(-dt * 2);
    this.cam.x += (tx - this.cam.x) * k;
    this.cam.y += (ty - this.cam.y) * k;
    this.clampCam();
    this.snap();
  }

  isVisibleTile(i) {
    const tx = i % MAP_W, ty = (i / MAP_W) | 0;
    const x = tx * TILE - this.cx, y = ty * TILE - this.cy;
    return x > -16 && y > -24 && x < this.vw && y < this.vh + 8;
  }

  /* ------------------------------------------------------------------ */

  render(game, dt, opts = {}) {
    const ctx = this.ctx;
    const { cx, cy, vw, vh } = this;
    const t = game.t;
    const w = game.world;
    const settings = opts.settings || {};
    this.game = game;
    this.wind = Math.sin(t * 0.7) * 0.6 + Math.sin(t * 1.9) * 0.25 + game.weather.intensity * 0.6;
    const ht = game.hoverInfo && game.hoverInfo.target;
    this.hl = ht ? (ht.kind === 'obj' || ht.kind === 'crop' || ht.kind === 'weed' ? 'i' + ht.i : ht.kind === 'struct' ? 's' + ht.s.type : ht.kind) : null;

    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#1e4a33';
    ctx.fillRect(0, 0, vw, vh);
    ctx.drawImage(game.ground.canvas, cx, cy, vw, vh, 0, 0, vw, vh);

    const tx0 = Math.max(0, Math.floor(cx / TILE) - 1), ty0 = Math.max(0, Math.floor(cy / TILE) - 1);
    const tx1 = Math.min(MAP_W - 1, Math.ceil((cx + vw) / TILE) + 1), ty1 = Math.min(MAP_H - 1, Math.ceil((cy + vh) / TILE) + 4);

    this.drawWater(game, tx0, ty0, tx1, ty1);
    this.drawGroundDetails(game, tx0, ty0, tx1, ty1);
    this.drawShadows(game, tx0, ty0, tx1, ty1);
    if (!opts.title) this.drawTarget(game);

    const list = [];
    for (let ty = ty0; ty <= ty1; ty++)
      for (let tx = tx0; tx <= tx1; tx++) {
        const i = ty * MAP_W + tx;
        const c = w.crops.get(i);
        if (c) list.push({ y: ty * TILE + 13, f: () => this.drawCrop(game, c, tx, ty, i, settings) });
        const o = w.objs.get(i);
        if (o) list.push({ y: ty * TILE + 14, f: () => this.drawObject(game, o, tx, ty, i) });
        const wd = w.weeds.get(i);
        if (wd !== undefined) list.push({ y: ty * TILE + 12, f: () => this.drawWeed(game, wd, tx, ty, i) });
      }
    w.props.forEach((p, pi) => {
      if (p.tx < tx0 - 2 || p.tx > tx1 + 2 || p.ty < ty0 || p.ty > ty1 + 3 || p.type === 'lily') return;
      list.push({ y: p.ty * TILE + (p.type === 'reeds' ? 8 : 14), f: () => this.drawProp(game, p, pi) });
    });
    for (const s of w.structures) list.push({ y: (s.ty + s.h) * TILE - 1, f: () => this.drawStructure(game, s) });
    const g = LAYOUT.granny;
    list.push({ y: g.ty * TILE + 13, f: () => this.drawGranny(game) });
    list.sort((a, b) => a.y - b.y);
    for (const d of list) d.f();

    game.particles.draw(ctx, cx, cy);
    if (game.carry) this.drawCarried(game);
    this.drawButterflies(game);
    this.drawRain(game, dt);
    this.drawClouds(game, dt);
    const dark = this.drawLighting(game, opts);
    this.drawFireflies(game, dark);
    if (!opts.title) this.drawPointer(game);

    // ---------- overlay (full-res) ----------
    const o = this.octx;
    o.setTransform(1, 0, 0, 1, 0, 0);
    o.clearRect(0, 0, this.overlay.width, this.overlay.height);
    if (!opts.title) {
      game.particles.drawTexts(o, cx, cy, this.scale);
      if (!opts.modalOpen) this.drawTooltip(game);
      this.drawCursor(game, opts);
    }
  }

  shakeOf(key) {
    const s = this.game.fx.shake.get(key);
    return s ? Math.round(Math.sin(s * 60) * Math.min(1.5, s * 8)) : 0;
  }

  drawOutlined(spr, x, y, color = '#fff8e0') {
    const ctx = this.ctx;
    const sil = silhouette(spr, color);
    const X = Math.round(x) - spr.pad, Y = Math.round(y) - spr.pad;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) ctx.drawImage(sil, X + dx, Y + dy);
    ctx.drawImage(spr.img, X, Y);
  }

  /* ---------------------------- ground layer ---------------------------- */

  drawWater(game, tx0, ty0, tx1, ty1) {
    const ctx = this.ctx, w = game.world, t = game.t;
    for (let ty = ty0; ty <= ty1; ty++)
      for (let tx = tx0; tx <= tx1; tx++) {
        const i = ty * MAP_W + tx;
        if (w.ground[i] !== G_WATER || w.waterDepth[i] < 1) continue;
        const bx = tx * TILE - this.cx, by = ty * TILE - this.cy;
        for (let k = 0; k < 2; k++) {
          const h1 = hash2(tx, ty, k + 1), h2 = hash2(tx, ty, k + 7);
          const a = Math.sin(t * (0.5 + h1 * 0.6) + h2 * 10);
          if (a < 0.2) continue;
          const x = bx + ((h1 * 16 + t * 3 * (h2 > 0.5 ? 1 : -1)) % 14 + 14) % 14;
          const y = by + 2 + Math.floor(h2 * 12);
          ctx.globalAlpha = (a - 0.2) * 0.9;
          ctx.fillStyle = a > 0.85 ? '#d4efff' : '#7ab4e4';
          ctx.fillRect(Math.round(x), y, a > 0.7 ? 3 : 2, 1);
        }
      }
    ctx.globalAlpha = 1;
    for (const p of w.props) {
      if (p.type !== 'lily' || p.tx < tx0 || p.tx > tx1 || p.ty < ty0 || p.ty > ty1) continue;
      const bob = Math.round(Math.sin(t * 1.2 + p.tx * 1.3 + p.ty) * 0.6);
      drawSprite(ctx, ART.lily[p.v], p.tx * TILE + 4 + p.ox - this.cx, p.ty * TILE + 5 + (p.oy || 0) + bob - this.cy);
    }
  }

  drawGroundDetails(game, tx0, ty0, tx1, ty1) {
    const ctx = this.ctx, w = game.world, t = game.t;
    const deco = ART.deco;
    for (let ty = ty0; ty <= ty1; ty++)
      for (let tx = tx0; tx <= tx1; tx++) {
        const i = ty * MAP_W + tx;
        const bx = tx * TILE - this.cx, by = ty * TILE - this.cy;
        if (w.fert[i] && w.ground[i] === G_SOIL) {
          ctx.fillStyle = '#e8d8a8';
          for (let k = 0; k < 5; k++) ctx.fillRect(bx + 2 + Math.floor(hash2(tx, ty, k) * 12), by + 2 + Math.floor(hash2(tx, ty, k + 9) * 12), 1, 1);
        }
        if (w.ground[i] === G_SOIL && w.wet[i] > 0.85 && !w.crops.has(i)) {
          ctx.fillStyle = 'rgba(160,200,255,0.12)';
          ctx.fillRect(bx + 4 + Math.floor(hash2(tx, ty, 3) * 6), by + 5, 3, 1);
        }
        const d = w.deco[i];
        if (!d) continue;
        const spr = d <= 3 ? deco.tufts[d - 1] : deco.flowers[d - 4];
        const ox = Math.floor(hash2(tx, ty, 4) * 9) + 1, oy = Math.floor(hash2(tx, ty, 5) * 8) + 2;
        this.drawSway(spr, bx + ox, by + oy, Math.sin(t * 1.6 + tx * 0.8 + ty * 0.5) * this.wind);
      }
  }

  drawSway(spr, x, y, amt) {
    const ctx = this.ctx;
    const h = spr.h;
    if (Math.abs(amt) < 0.35) { drawSprite(ctx, spr, x, y); return; }
    const X = Math.round(x) - spr.pad, Y = Math.round(y) - spr.pad;
    for (let row = 0; row < h; row += 2) {
      const k = 1 - row / h;
      const off = Math.round(amt * k * k);
      ctx.drawImage(spr.img, 0, row, spr.w, Math.min(2, h - row), X + off, Y + row, spr.w, Math.min(2, h - row));
    }
  }

  shadow(x, y, rx, ry, a = 0.22) {
    const ctx = this.ctx;
    ctx.fillStyle = `rgba(16,28,24,${a})`;
    x = Math.round(x); y = Math.round(y);
    for (let j = -ry; j <= ry; j++) {
      const half = Math.round(rx * Math.sqrt(1 - (j / (ry + 0.5)) ** 2));
      ctx.fillRect(x - half, y + j, half * 2, 1);
    }
  }

  drawShadows(game, tx0, ty0, tx1, ty1) {
    const w = game.world;
    for (const p of w.props) {
      if (p.tx < tx0 - 2 || p.tx > tx1 + 2 || p.ty < ty0 || p.ty > ty1 + 3) continue;
      const x = p.tx * TILE + 8 + (p.ox || 0) - this.cx, y = p.ty * TILE + 14 - this.cy;
      if (p.type === 'tree') this.shadow(x + 2, y, p.kind === 'pine' ? 10 : 15, 4, 0.25);
      else if (p.type === 'bush') this.shadow(x, y, 9, 2);
      else if (p.type === 'rock' || p.type === 'stump') this.shadow(x, y, 7, 2);
    }
    for (const s of w.structures) this.shadow((s.tx + s.w / 2) * TILE - this.cx, (s.ty + s.h) * TILE - 2 - this.cy, s.w * 8 + 2, s.type === 'sign' ? 1 : 3, 0.2);
    const g = LAYOUT.granny;
    this.shadow(g.tx * TILE + 8 - this.cx, g.ty * TILE + 14 - this.cy, 5, 1, 0.28);
  }

  /** Tile highlight + area previews + placement ghost under the cursor. */
  drawTarget(game) {
    const ctx = this.ctx;
    const h = game.hover;
    if (!h || game.carry || game.pan) return;
    const slot = game.selected;
    const def = slot && ITEMS[slot.id];
    const w = game.world;
    let area = null;
    if (slot && (slot.id === 'bucket' || slot.id === 'sickle')) area = SPRINKLER_RANGE[1].concat([[0, 0]]);
    if (def && def.place === 'sprinkler') area = SPRINKLER_RANGE[def.tier];
    if (area) {
      ctx.fillStyle = def && def.place === 'sprinkler' ? 'rgba(120,190,255,0.22)' : 'rgba(255,255,255,0.12)';
      for (const [dx, dy] of area) ctx.fillRect((h.tx + dx) * TILE - this.cx + 1, (h.ty + dy) * TILE - this.cy + 1, 14, 14);
    }
    // hovering a structure/object/crop already gets an outline instead of a tile bracket
    if (game.hoverInfo && game.hoverInfo.target && game.hoverInfo.target.kind !== 'crop') return;
    if (game.sel === HAND && !(game.hoverInfo && game.hoverInfo.target)) return;
    const x = h.tx * TILE - this.cx, y = h.ty * TILE - this.cy;
    ctx.globalAlpha = 0.55 + Math.sin(game.t * 6) * 0.25;
    ctx.fillStyle = '#fff8e0';
    const L = 4;
    ctx.fillRect(x, y, L, 1); ctx.fillRect(x, y, 1, L);
    ctx.fillRect(x + 16 - L, y, L, 1); ctx.fillRect(x + 15, y, 1, L);
    ctx.fillRect(x, y + 15, L, 1); ctx.fillRect(x, y + 16 - L, 1, L);
    ctx.fillRect(x + 16 - L, y + 15, L, 1); ctx.fillRect(x + 15, y + 16 - L, 1, L);
    ctx.globalAlpha = 1;
    if (def && def.kind === 'place' && def.place !== 'path' && w.isOpen(h.tx, h.ty) && game.canDropAt(h.tx, h.ty)) {
      ctx.globalAlpha = 0.55;
      this.drawObject(game, { type: def.place, tier: def.tier || 0, ghost: true }, h.tx, h.ty, -1);
      ctx.globalAlpha = 1;
    }
  }

  /* ---------------------------- entities ---------------------------- */

  drawCrop(game, c, tx, ty, i, settings) {
    const art = ART.crops[c.id];
    const st = stageOf(c);
    const spr = art.stages[st];
    const rows = art.tall ? 24 : 16;
    const x = tx * TILE - this.cx, y = ty * TILE + 16 - rows - this.cy;
    const hovered = this.hl === 'i' + i;
    let sway = Math.sin(game.t * 1.8 + tx * 0.9 + ty * 0.4) * this.wind * 0.8 * (st >= 2 ? 1 : 0.3);
    const h = game.hover;
    if (h && h.tx === tx && h.ty === ty && !hovered) sway += Math.sin(game.t * 14) * 1.2; // the hand brushes the leaves
    const bounce = st === 4 && Math.sin(game.t * 3 + tx + ty * 2) > 0.92 ? -1 : 0;
    if (hovered) this.drawOutlined(spr, x, y + bounce - 1);
    else this.drawSway(spr, x, y + bounce, sway);
    const sel = game.selected;
    const watering = sel && (sel.id === 'can' || sel.id === 'bucket');
    if (settings.thirsty !== false && (watering || game.tutorial.active) && st < 4 && !(game.world.wet[i] > 0)) {
      const dx = x + 11, dy = y + (art.tall ? 10 : 2) + Math.round(Math.sin(game.t * 3 + tx));
      const ctx = this.ctx;
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = '#1e2a4a';
      ctx.fillRect(dx, dy - 1, 3, 5); ctx.fillRect(dx - 1, dy + 1, 5, 3);
      ctx.fillStyle = '#8ac4f0';
      ctx.fillRect(dx + 1, dy, 1, 3); ctx.fillRect(dx, dy + 2, 3, 1);
      ctx.fillStyle = '#d4efff';
      ctx.fillRect(dx, dy + 1, 1, 1);
      ctx.globalAlpha = 1;
    }
  }

  objectSprite(game, o, tx, ty) {
    switch (o.type) {
      case 'sprinkler': return { spr: ART.sprinklers[o.tier], dy: 0 };
      case 'lamp': return { spr: ART.lamp, dy: -16 };
      case 'scarecrow': return { spr: ART.scarecrow, dy: -12 };
      case 'gnome': return { spr: ART.icons.gnome, dy: 0 };
      case 'flowerpot': return { spr: ART.icons.flowerpot, dy: 0 };
      case 'fence': {
        const w = game.world;
        const isF = (ax, ay) => { const q = w.inBounds(ax, ay) && w.objs.get(w.idx(ax, ay)); return q && q.type === 'fence'; };
        let m = 0;
        if (!o.ghost && tx >= 0) {
          if (isF(tx, ty - 1)) m |= 1; if (isF(tx + 1, ty)) m |= 2; if (isF(tx, ty + 1)) m |= 4; if (isF(tx - 1, ty)) m |= 8;
        }
        return { spr: ART.fences[m], dy: -8 };
      }
    }
    return null;
  }

  drawObject(game, o, tx, ty, i) {
    const x = tx * TILE - this.cx + (i >= 0 ? this.shakeOf(i) : 0), y = ty * TILE - this.cy;
    const hovered = i >= 0 && this.hl === 'i' + i;
    if (o.type === 'crate') {
      const C = o.gift ? ART.giftCrate : ART.crate;
      const drop = game.fx.drop.get(i);
      const fall = drop ? Math.round(drop * drop * 500) : 0;
      if (drop) { this.ctx.globalAlpha = 0.3; this.shadow(x + 8, y + 14, 7 * (1 - drop), 2); this.ctx.globalAlpha = 1; }
      const lift = o.hits ? Math.min(o.hits, 2) : 0;
      if (hovered) { this.drawOutlined(C.body, x, y + 2 - fall); this.drawOutlined(C.lid, x - 1, y - 2 - lift - fall); }
      else { drawSprite(this.ctx, C.body, x, y + 2 - fall); drawSprite(this.ctx, C.lid, x - 1, y - 2 - lift - fall); }
      return;
    }
    const r = this.objectSprite(game, o, tx, ty);
    if (!r) return;
    if (hovered) this.drawOutlined(r.spr, x, y + r.dy);
    else if (o.type === 'flowerpot') this.drawSway(r.spr, x, y, Math.sin(game.t * 1.6 + tx) * this.wind * 0.6);
    else drawSprite(this.ctx, r.spr, x, y + r.dy);
  }

  drawCarried(game) {
    const h = game.hover;
    const o = game.carry.obj;
    if (!h) return;
    const ctx = this.ctx;
    const ok = game.canDropAt(h.tx, h.ty);
    const x = h.tx * TILE - this.cx, y = h.ty * TILE - this.cy;
    ctx.fillStyle = ok ? 'rgba(160,255,160,0.25)' : 'rgba(255,120,120,0.3)';
    ctx.fillRect(x + 1, y + 1, 14, 14);
    // lifted, wobbling a little
    const lift = 6 + Math.round(Math.sin(game.t * 6));
    this.shadow(x + 8, y + 14, 6, 2, 0.3);
    if (o.type === 'crate') {
      const C = o.gift ? ART.giftCrate : ART.crate;
      drawSprite(ctx, C.body, x, y + 2 - lift);
      drawSprite(ctx, C.lid, x - 1, y - 2 - lift);
    } else {
      const r = this.objectSprite(game, { ...o, ghost: true }, h.tx, h.ty);
      if (r) drawSprite(ctx, r.spr, x, y + r.dy - lift);
    }
  }

  drawWeed(game, v, tx, ty, i) {
    const spr = ART.weeds[v];
    const x = tx * TILE + 3 - this.cx, y = ty * TILE + 7 - this.cy;
    if (this.hl === 'i' + i) this.drawOutlined(spr, x, y - 1);
    else this.drawSway(spr, x, y, Math.sin(game.t * 2 + tx) * this.wind);
  }

  drawProp(game, p, pi) {
    const ctx = this.ctx;
    const sh = this.shakeOf('p' + pi);
    const bx = p.tx * TILE - this.cx + (p.ox || 0) + sh, by = p.ty * TILE - this.cy;
    switch (p.type) {
      case 'tree': {
        const spr = ART.trees[p.kind][p.v % ART.trees[p.kind].length];
        const x = bx + 8 - spr.ax, y = by + 14 - spr.ay;
        // fade the canopy when the cursor is working behind it
        const h = game.hover;
        if (h && h.ty < p.ty && h.ty > p.ty - 4 && Math.abs(h.tx - p.tx) <= 1 && !game.drag?.mode?.startsWith('pan')) ctx.globalAlpha = 0.45;
        this.drawTreeSway(spr, x, y, Math.sin(game.t * 0.9 + p.tx * 0.7) * this.wind * 0.9 + sh);
        ctx.globalAlpha = 1;
        if (Math.random() < 0.0015 && p.kind !== 'pine') {
          const col = p.kind === 'cherry' ? '#f2a2c8' : p.kind === 'maple' ? '#f09a4a' : '#5cb04e';
          game.particles.add({ type: 'leaf', x: p.tx * TILE + rand(-10, 20), y: p.ty * TILE - 20, z: 14, vz: -4, g: 0, vx: rand(3, 10), vy: rand(2, 5), life: 4, color: col, drag: 0 });
        }
        break;
      }
      case 'bush': drawSprite(ctx, ART.bushes[p.v], bx - 3, by + 15 - 17); break;
      case 'rock': { const s = ART.rocks[p.v]; drawSprite(ctx, s, bx + 8 - s.w / 2, by + 15 - s.h); break; }
      case 'stump': drawSprite(ctx, ART.stump, bx + 1, by + 4); break;
      case 'reeds': this.drawSway(ART.reeds[p.v], bx + 3, by - 6, Math.sin(game.t * 1.3 + p.tx) * this.wind * 1.2 + sh); break;
    }
  }

  drawTreeSway(spr, x, y, amt) {
    const ctx = this.ctx;
    const X = Math.round(x), Y = Math.round(y);
    const trunkFrom = spr.canopy.y + spr.canopy.h;
    for (let row = 0; row < spr.h; row += 3) {
      const k = row < trunkFrom ? 1 - row / trunkFrom : 0;
      const off = row < trunkFrom ? Math.round(amt * (0.4 + k * 0.6)) : 0;
      const h = Math.min(3, spr.h - row);
      ctx.drawImage(spr.img, 0, row, spr.w, h, X + off, Y + row, spr.w, h);
    }
  }

  drawStructure(game, s) {
    const ctx = this.ctx;
    const sh = this.shakeOf('s' + s.type);
    const bx = s.tx * TILE - this.cx + sh, by = (s.ty + s.h) * TILE - this.cy;
    const dark = this.darkness || 0;
    const hov = this.hl === 's' + s.type;
    const put = (spr, x, y) => (hov ? this.drawOutlined(spr, x, y) : drawSprite(ctx, spr, x, y));
    switch (s.type) {
      case 'house': {
        const H = ART.house;
        const x = bx, y = by - 80;
        const h = game.hover;
        if (h && h.ty < s.ty && h.ty >= s.ty - 3 && h.tx >= s.tx && h.tx < s.tx + s.w) ctx.globalAlpha = 0.5;
        put(H, x, y);
        if (dark > 0.15) {
          ctx.fillStyle = `rgba(255,206,120,${Math.min(0.9, dark * 1.2)})`;
          for (const wd of H.windows) ctx.fillRect(x + wd.x, y + wd.y, wd.w, wd.h);
          ctx.fillStyle = `rgba(150,90,40,${Math.min(0.9, dark * 1.2)})`;
          for (const wd of H.windows) { ctx.fillRect(x + wd.x + 7, y + wd.y, 1, wd.h); ctx.fillRect(x + wd.x, y + wd.y + 6, wd.w, 1); }
        }
        ctx.globalAlpha = 1;
        break;
      }
      case 'stall': {
        const S = ART.stall;
        const x = bx - 2, y = by - 54;
        put(S.back, x, y);
        const m = ART.merchant;
        const h = game.hover;
        const look = !h ? 'down' : h.tx < s.tx ? 'left' : h.tx > s.tx + 2 ? 'right' : 'down';
        const blink = Math.sin(game.t * 0.9) > 0.97;
        const ms = blink && m.blink[look] ? m.blink[look] : m[look][0];
        drawSprite(ctx, ms, x + 18, y + 19 + (Math.sin(game.t * 2) > 0 ? 0 : 1));
        put(S.front, x, y);
        drawSprite(ctx, ART.stallSign, x + 18, y - 6);
        break;
      }
      case 'well': put(ART.well, bx - 1, by - 45); break;
      case 'bin': put(ART.bin, bx, by - 23); break;
      case 'sign': put(ART.sign, bx, by - 20); break;
    }
  }

  drawGranny(game) {
    const g = LAYOUT.granny;
    const x = g.tx * TILE - this.cx, y = g.ty * TILE + 14 - 21 - this.cy;
    const blink = (game.t % 4) < 0.15;
    const breathe = Math.sin(game.t * 1.8) > 0.3 ? -1 : 0;
    const spr = blink ? ART.granny.blink : ART.granny.idle;
    if (this.hl === 'granny') this.drawOutlined(spr, x, y + breathe);
    else drawSprite(this.ctx, spr, x, y + breathe);
    if (game.tutorial.active && !game.tutorial.talked) {
      const by = y - 9 + Math.round(Math.sin(game.t * 5));
      this.ctx.fillStyle = '#241826'; this.ctx.fillRect(x + 6, by - 1, 4, 9);
      this.ctx.fillStyle = '#f5d44a'; this.ctx.fillRect(x + 7, by, 2, 5); this.ctx.fillRect(x + 7, by + 6, 2, 1);
    }
  }

  drawButterflies(game) {
    for (const b of game.critters.butterflies) drawSprite(this.ctx, ART.butterflies[b.v][Math.sin(b.t * 18) > 0 ? 0 : 1], b.x - this.cx, b.y - this.cy);
  }

  /* ---------------------------- weather & light ---------------------------- */

  drawRain(game, dt) {
    const ctx = this.ctx;
    const I = game.weather.intensity;
    const want = Math.floor(I * 160);
    while (this.rain.length < want) this.rain.push({ x: rand(-40, this.vw + 40), y: rand(-this.vh, this.vh), s: rand(170, 230), l: rand(4, 7) });
    if (this.rain.length > want) this.rain.length = want;
    if (!want) return;
    ctx.fillStyle = 'rgba(190,215,255,0.5)';
    for (const r of this.rain) {
      r.y += r.s * dt; r.x -= r.s * 0.18 * dt;
      if (r.y > this.vh + 10) { r.y = rand(-30, 0); r.x = rand(-20, this.vw + 40); }
      ctx.fillRect(Math.round(r.x), Math.round(r.y), 1, r.l);
    }
    ctx.fillStyle = 'rgba(210,230,255,0.6)';
    for (let i = 0; i < I * 6; i++) {
      const x = Math.floor(rand(this.vw)), y = Math.floor(rand(this.vh));
      ctx.fillRect(x - 1, y, 1, 1); ctx.fillRect(x + 1, y, 1, 1); ctx.fillRect(x, y - 1, 1, 1);
    }
  }

  drawClouds(game, dt) {
    const ctx = this.ctx;
    const h = game.hour;
    if (h < 7 || h > 18.5) return;
    const a = game.weather.intensity > 0.3 ? 0.05 : 0.08;
    const W = MAP_W * TILE, H = MAP_H * TILE;
    for (const c of this.clouds) {
      c.x += c.s * dt; c.y += c.s * 0.3 * dt;
      if (c.x - c.r > W) c.x = -c.r;
      if (c.y - c.r > H) c.y = -c.r;
      const x = c.x - this.cx, y = c.y - this.cy;
      if (x + c.r < 0 || y + c.r < 0 || x - c.r > this.vw || y - c.r > this.vh) continue;
      const g = ctx.createRadialGradient(x, y, 0, x, y, c.r);
      g.addColorStop(0, `rgba(20,30,60,${a})`);
      g.addColorStop(0.6, `rgba(20,30,60,${a * 0.7})`);
      g.addColorStop(1, 'rgba(20,30,60,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - c.r, y - c.r, c.r * 2, c.r * 2);
    }
  }

  drawLighting(game, opts) {
    const ctx = this.ctx, l = this.lctx;
    const tint = skyTint(game.hour, game.weather.intensity);
    const dark = clamp(1 - (tint[0] + tint[1] + tint[2]) / 765, 0, 1);
    this.darkness = dark * 1.6;
    if (dark < 0.01) return 0;
    l.globalCompositeOperation = 'source-over';
    l.fillStyle = `rgb(${tint[0] | 0},${tint[1] | 0},${tint[2] | 0})`;
    l.fillRect(0, 0, this.vw, this.vh);
    l.globalCompositeOperation = 'lighter';
    const k = clamp((dark - 0.12) * 1.8, 0, 1);
    if (k > 0) {
      for (const L of this.collectLights(game, opts)) {
        const x = L.x - this.cx, y = L.y - this.cy;
        if (x < -L.r || y < -L.r || x > this.vw + L.r || y > this.vh + L.r) continue;
        const flick = L.flicker ? 1 + Math.sin(game.t * 9 + L.x) * 0.04 : 1;
        const g = l.createRadialGradient(x, y, 0, x, y, L.r * flick);
        const [r, gg, b] = L.c || [255, 190, 110];
        g.addColorStop(0, `rgba(${r},${gg},${b},${0.95 * k * (L.i ?? 1)})`);
        g.addColorStop(0.45, `rgba(${r},${gg},${b},${0.45 * k * (L.i ?? 1)})`);
        g.addColorStop(1, `rgba(${r},${gg},${b},0)`);
        l.fillStyle = g;
        l.fillRect(x - L.r * 1.1, y - L.r * 1.1, L.r * 2.2, L.r * 2.2);
      }
    }
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(this.light, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    if (k > 0) {
      ctx.globalCompositeOperation = 'lighter';
      for (const [i, o] of game.world.objs) {
        if (o.type !== 'lamp') continue;
        const x = (i % MAP_W) * TILE + 8 - this.cx, y = ((i / MAP_W) | 0) * TILE - 11 - this.cy;
        const g = ctx.createRadialGradient(x, y, 0, x, y, 10);
        g.addColorStop(0, `rgba(255,220,140,${0.5 * k})`);
        g.addColorStop(1, 'rgba(255,220,140,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - 10, y - 10, 20, 20);
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    return dark;
  }

  collectLights(game, opts) {
    const out = [];
    const w = game.world;
    for (const s of w.structures) {
      if (s.type === 'house') {
        const x = s.tx * TILE, y = (s.ty + s.h) * TILE - 80;
        for (const L of ART.house.lights) out.push({ x: x + L.x, y: y + L.y + 8, r: L.r + 8, flicker: true });
      }
      if (s.type === 'stall') out.push({ x: (s.tx + 1.5) * TILE, y: s.ty * TILE - 4, r: 40, i: 0.7, flicker: true });
    }
    for (const [i, o] of w.objs) if (o.type === 'lamp') out.push({ x: (i % MAP_W) * TILE + 8, y: ((i / MAP_W) | 0) * TILE - 8, r: 64, flicker: true });
    // your hand carries a little glow at night so you can always see what you're doing
    if (game.hover && !opts.title) out.push({ x: game.hover.wx, y: game.hover.wy, r: 46, i: 0.5, c: [255, 220, 170] });
    for (const f of game.critters.fireflies) out.push({ x: f.x, y: f.y, r: 9, i: 0.5 * (0.5 + 0.5 * Math.sin(f.t * 3)), c: [200, 255, 120] });
    return out;
  }

  drawFireflies(game, dark) {
    if (!game.critters.fireflies.length) return;
    const ctx = this.ctx;
    ctx.globalCompositeOperation = 'lighter';
    for (const f of game.critters.fireflies) {
      const a = (0.5 + 0.5 * Math.sin(f.t * 3)) * Math.min(1, f.life / 2) * clamp(dark * 2, 0, 1);
      const x = Math.round(f.x - this.cx), y = Math.round(f.y - this.cy);
      ctx.fillStyle = `rgba(220,255,140,${a})`;
      ctx.fillRect(x, y, 1, 1);
      ctx.fillStyle = `rgba(180,255,100,${a * 0.35})`;
      ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  drawPointer(game) {
    const ptr = game.tutorial.pointer();
    if (!ptr) return;
    const ctx = this.ctx;
    let x = ptr.x - this.cx, y = ptr.y - this.cy - 6 + Math.round(Math.sin(game.t * 5) * 2);
    const margin = 10;
    const off = x < margin || y < margin || x > this.vw - margin || y > this.vh - margin;
    if (off) { x = clamp(x, margin, this.vw - margin); y = clamp(y, margin, this.vh - margin); }
    ctx.fillStyle = '#241826';
    ctx.fillRect(x - 4, y - 5, 9, 4); ctx.fillRect(x - 3, y - 1, 7, 2); ctx.fillRect(x - 2, y + 1, 5, 2); ctx.fillRect(x - 1, y + 3, 3, 1);
    ctx.fillStyle = off ? '#f08ac0' : '#f5d44a';
    ctx.fillRect(x - 3, y - 4, 7, 2); ctx.fillRect(x - 2, y - 2, 5, 2); ctx.fillRect(x - 1, y, 3, 2); ctx.fillRect(x, y + 2, 1, 1);
    ctx.fillStyle = '#fff3a0';
    ctx.fillRect(x - 3, y - 4, 2, 1);
  }

  /* ---------------------------- overlay: tooltip & cursor ---------------------------- */

  drawTooltip(game) {
    const info = game.hoverInfo;
    const m = this.mouse;
    if (!info || !m || game.pan || (game.drag && game.drag.mode === 'paint')) return;
    const o = this.octx;
    const S = Math.max(2, Math.round(this.uiScale * this.dpr));
    const x0 = Math.round(m.x * this.dpr + 14 * S), y0 = Math.round(m.y * this.dpr + 4 * S);
    o.textAlign = 'left'; o.textBaseline = 'top';
    o.font = `600 ${7 * S}px Pixelify, monospace`;
    const w1 = o.measureText(info.text).width;
    o.font = `${5.5 * S}px Pixelify, monospace`;
    const w2 = info.sub ? o.measureText(info.sub).width : 0;
    const pw = Math.max(w1, w2) + 8 * S, ph = (info.sub ? 19 : 11) * S;
    let x = x0, y = y0;
    if (x + pw > this.overlay.width - 4) x = Math.round(m.x * this.dpr - pw - 6 * S);
    if (y + ph > this.overlay.height - 4) y = this.overlay.height - ph - 4;
    o.fillStyle = 'rgba(20,14,24,0.88)';
    o.fillRect(x + S, y, pw - 2 * S, ph);
    o.fillRect(x, y + S, pw, ph - 2 * S);
    o.fillStyle = info.good ? '#c8ef8a' : info.warn ? '#ffb070' : '#fff3d8';
    o.font = `600 ${7 * S}px Pixelify, monospace`;
    o.fillText(info.text, x + 4 * S, y + 2 * S);
    if (info.sub) {
      o.fillStyle = info.warn ? '#ffd0a0' : '#c8b8d0';
      o.font = `${5.5 * S}px Pixelify, monospace`;
      o.fillText(info.sub, x + 4 * S, y + 11 * S);
    }
  }

  /** The cursor is drawn by the game so tools can tilt, chop and pour. */
  drawCursor(game) {
    const m = this.mouse;
    if (!m || !m.onCanvas) return;
    const o = this.octx;
    o.imageSmoothingEnabled = false;
    const S = Math.max(2, Math.round(this.uiScale * this.dpr));
    const mx = Math.round(m.x * this.dpr), my = Math.round(m.y * this.dpr);
    const fx = game.fx.cursor;
    const k = fx ? fx.t / fx.dur : 0;
    const slot = game.selected;
    if (!slot || game.carry || game.pan) {
      // the hand
      const grabbing = game.carry || game.pan || (game.drag && ['grab', 'harvest'].includes(game.drag.mode));
      const pointy = !grabbing && game.hoverInfo && game.hoverInfo.target;
      const spr = grabbing ? ART.cursor.grab : pointy ? ART.cursor.point : ART.cursor.open;
      let dy = 0;
      if (fx && (fx.kind === 'knock' || fx.kind === 'pick')) dy = Math.round(Math.sin(k * Math.PI) * 3);
      const hx = pointy ? 4 : 7, hy = pointy ? 1 : 5;
      o.drawImage(spr.img, mx - hx * S, my - hy * S + dy * S, spr.img.width * S, spr.img.height * S);
      return;
    }
    const def = ITEMS[slot.id];
    const iconKey = def.icon + (slot.id === 'bucket' && slot.water > 0 ? '_full' : '');
    const spr = ART.icons[iconKey] || ART.icons[def.icon];
    if (!spr) return;
    const hot = TOOL_CURSOR[slot.id] || { hx: 8, hy: 12, rot: 0 };
    let rot = Math.sin(game.t * 2) * 0.04;
    let ox = 0, oy = 0;
    const pouring = slot.id === 'can' && game.drag && game.drag.mode === 'paint' && slot.water > 0;
    if (pouring) rot = -0.55 + Math.sin(game.t * 10) * 0.04;
    if (fx) {
      const s = Math.sin(k * Math.PI);
      switch (fx.kind) {
        case 'chop': rot = -0.9 * s + (k < 0.5 ? 0 : 0); oy = -s * 2; break;
        case 'pour': rot = Math.min(rot, -0.5 * s); break;
        case 'tip': rot = -1.3 * s; break;
        case 'dip': oy = s * 3; rot = 0.3 * s; break;
        case 'shake': ox = Math.sin(k * 30) * 1.5; break;
        case 'swish': rot = 1.2 * s - 0.4; break;
        case 'place': oy = s * 2; break;
        case 'knock': oy = s * 3; break;
        case 'pick': oy = -s * 3; break;
      }
    }
    // hand holding the tool, then the tool rotating around its hotspot
    o.save();
    o.translate(mx, my);
    o.rotate(rot);
    o.drawImage(spr.img, (-hot.hx + ox) * S, (-hot.hy + oy) * S, spr.img.width * S, spr.img.height * S);
    o.restore();
    // stack count for seeds / placeables
    if (isFinite(slot.n) && slot.n > 1 && def.kind !== 'tool') {
      o.font = `600 ${6 * S}px Pixelify, monospace`;
      o.textAlign = 'left'; o.textBaseline = 'top';
      o.fillStyle = '#241826';
      o.fillText(String(slot.n), mx + 7 * S + S * 0.6, my + 3 * S + S * 0.6);
      o.fillStyle = '#fff3d8';
      o.fillText(String(slot.n), mx + 7 * S, my + 3 * S);
    }
    if (def.capacity) {
      const f = Math.max(0, slot.water / def.capacity);
      o.fillStyle = '#241826';
      o.fillRect(mx - 6 * S, my + 6 * S, 12 * S, 2 * S);
      o.fillStyle = '#6ab4f0';
      o.fillRect(mx - 6 * S, my + 6 * S, Math.round(12 * S * f), 2 * S);
    }
  }
}
