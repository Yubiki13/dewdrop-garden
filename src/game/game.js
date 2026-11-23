// Core game state + rules. Everything is done with the cursor: there is no player character.
// Rendering and DOM UI live elsewhere and talk to this through `hooks`.
import {
  TILE, MAP_W, MAP_H, ORIG_H, MEADOW_END, HOUR_SECONDS, WET_HOURS, G_GRASS, G_SOIL, G_WATER, F_NONE, F_PATH, VERSION, PAN_SPEED, MEADOW_PRICE,
} from '../config.js';
import { World, LAYOUT } from './world.js';
import { GroundRenderer } from './ground.js';
import { Particles } from './particles.js';
import { Tutorial } from './tutorial.js';
import { CROPS, stageOf } from '../data/crops.js';
import { ITEMS, STACK_MAX, isStackable } from '../data/items.js';
import { ART } from '../art/index.js';
import { audio } from '../core/audio.js';
import { rand, pick } from '../core/util.js';
import { ExpansionMethods } from './expansion.js';
import { AchievementTracker } from './achievements.js';

export const INV_SIZE = 40;
export { MEADOW_PRICE };
const fmt = (n) => Math.floor(n).toLocaleString('en-US');
export const HAND = -1;

export const SPRINKLER_RANGE = [
  [[0, -1], [0, 1], [-1, 0], [1, 0]],
  [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]],
  (() => { const a = []; for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) if (x || y) a.push([x, y]); return a; })(),
  (() => { const a = []; for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) if (x || y) a.push([x, y]); return a; })(),
];
const AREA3 = SPRINKLER_RANGE[1].concat([[0, 0]]);
const PAINTABLE = new Set(['hoe', 'can', 'sickle', 'fertilizer', 'fence', 'path', 'goldhoe', 'goldcan']);

const OBJ_ITEM = { sprinkler: ['sprinkler', 'sprinkler2', 'sprinkler3', 'sprinkler4'] };
const OBJ_NAMES = {
  sprinkler: ['Sprinkler', 'Quality Sprinkler', 'Deluxe Sprinkler', 'Rainbow Sprinkler'], fence: 'Wood Fence', lamp: 'Lamp Post',
  scarecrow: 'Scarecrow', gnome: 'Garden Gnome', flowerpot: 'Flower Pot', beehive: 'Beehive', campfire: 'Campfire', bench: 'Garden Bench',
  birdbath: 'Birdbath', haybale: 'Hay Bale', statue: 'Owl Statue', mushroomlog: 'Mushroom Log', jackolantern: 'Jack-o\'-Lantern',
  stonelantern: 'Stone Lantern', picnic: 'Picnic Blanket', sundial: 'Sundial', goldgnome: 'Golden Gnome', fruittree: 'Fruit Tree',
};
const STRUCT_INFO = {
  house: ['Cottage', 'click to sleep until morning'],
  bin: ['Shipping Bin', 'click to sell, or drag crops onto it'],
  stall: ['Basil\'s Market', 'click to shop'],
  well: ['Well', 'click with a can or bucket to refill'],
  sign: ['Garden sign', 'click to read'],
  gate: ['Meadow gate', 'click to visit the Riverside Meadow'],
  gate2: ['Hills gate', 'click to visit Blossom Hills'],
  wish: ['Wishing Well', 'toss 250 coins and make a wish (once a day)'],
  windmill: ['Windmill', 'click to give the sails a spin'],
};

const GRANNY_TIPS = [
  'Plants only grow while their soil is wet. Dark soil means it still has water in it.',
  'Sprinklers water their area every morning at 6 o\'clock. Very handy for a big garden!',
  'Strawberries, tomatoes, corn and blueberries keep giving after you harvest them.',
  'Fertilizer makes crops grow half again as fast. Sprinkle it on the soil.',
  'If you ever get tired, click the cottage and you\'ll sleep right through to morning.',
  'Pumpkins and watermelons take their sweet time, but they sell for a lot.',
  'Rainy days water everything for free. I love the sound of it on the roof.',
  'A garden is never finished. That\'s the nice part.',
  'Weeds pop up overnight. Pull them with your hand — sometimes there are seeds tangled in the roots!',
  'Hold the mouse button and sweep across the soil. Saves your wrists, dear.',
  'You can pick up anything you\'ve placed with your hand and move it somewhere nicer.',
];

const STARTER = [['hoe', 1], ['can', 1], ['shovel', 1], ['seed_radish', 6], ['seed_carrot', 4]];
const SANDBOX_EXTRA = [
  ['bucket', 1], ['sickle', 1], ['sprinkler2', 12], ['seed_strawberry', 20], ['seed_tomato', 20], ['seed_sunflower', 20],
  ['seed_pumpkin', 20], ['seed_watermelon', 20], ['fertilizer', 30], ['path', 60], ['fence', 60], ['lamp', 6],
  ['flowerpot', 8], ['gnome', 3], ['scarecrow', 2],
];

export class Game {
  constructor(opts) {
    this.hooks = {};
    this.listeners = {};
    this.particles = new Particles();
    this.critters = { butterflies: [], fireflies: [], fish: [] };
    this.fx = { sprinklers: [], shake: new Map(), drop: new Map(), cursor: null };
    this.t = 0;
    this.drag = null;
    this.carry = null;
    this.pan = null;
    this.hover = null;
    this.hoverInfo = null;
    this.panned = 0;
    this.pendingOrder = [];
    this.stats = { harvested: {}, planted: 0, earned: 0, days: 1 };
    if (opts.save) this.fromSave(opts.save);
    else this.newGame(opts);
    this.initExpansion(opts.save);
    this.ground = new GroundRenderer(this.world);
    this.ground.renderAll();
    this.tutorial = new Tutorial(this, opts.save ? opts.save.tutorial : { enabled: opts.tutorial !== false });
    this.initFish();
    this.ach = new AchievementTracker(this, opts.save ? opts.save.achievements : null);
  }

  newGame({ name = 'Gardener', mode = 'cozy', seed = (Math.random() * 1e9) | 0, tutorial = true }) {
    this.name = name;
    this.mode = mode;
    this.world = new World(seed);
    this.coins = mode === 'sandbox' ? 0 : 150;
    this.time = 7 * 60;
    this.weather = { rain: false, intensity: 0, tomorrow: false };
    this.inv = new Array(INV_SIZE).fill(null);
    this.sel = HAND;
    this.meadowOwned = false;
    this.playerId = null;
    const items = STARTER.map((x) => [...x]);
    if (!tutorial) items.push(['bucket', 1], ['sprinkler', 1]);
    if (mode === 'sandbox') for (const [id, n] of SANDBOX_EXTRA) { const e = items.find((x) => x[0] === id); if (e) e[1] = Math.max(e[1], n); else items.push([id, n]); }
    const c = LAYOUT.crate;
    this.world.objs.set(this.world.idx(c.tx, c.ty), { type: 'crate', tier: 0, gift: true, items });
    this.spawnWeeds(7);
  }

  get sandbox() { return this.mode === 'sandbox'; }
  isLocked(tx, ty) { return !this.meadowOwned && ty >= ORIG_H; }

  /* ---------------------------- the Riverside Meadow ---------------------------- */

  buyMeadow() {
    if (this.meadowOwned) return false;
    if (!this.sandbox && this.coins < MEADOW_PRICE) { this.toast('Not enough coins yet — keep growing!'); audio.play('error'); return false; }
    if (!this.sandbox) this.coins -= MEADOW_PRICE;
    this.meadowOwned = true;
    audio.play('quest');
    audio.play('crate');
    const g = LAYOUT.gate;
    this.fx.shake.set('sgate', 0.5);
    this.particles.sparkle((g.tx + 1) * TILE, g.ty * TILE, 20);
    this.particles.burst((g.tx + 1) * TILE, (g.ty + 1) * TILE, 14, { color: ['#d8a868', '#b07a4a', '#8fd65a', '#f08ac0'], speed: 50, vz: 60, g: 200, life: 0.9 });
    this.toast('The Riverside Meadow is yours! The gate is open.');
    this.hooks.coinsChanged?.();
    this.emit('meadow');
    setTimeout(() => this.visitMeadow(), 700);
    return true;
  }

  visitMeadow() {
    if (!this.view) return;
    const v = LAYOUT.meadowView;
    this.view.flyTo(v.tx * TILE + 8, v.ty * TILE + 8);
  }
  get day() { return Math.floor(this.time / 1440) + 1; }
  get minuteOfDay() { return this.time % 1440; }
  get hour() { return (this.time % 1440) / 60; }

  on(ev, fn) { (this.listeners[ev] ||= []).push(fn); }
  emit(ev, data) { for (const fn of this.listeners[ev] || []) fn(data); }
  toast(msg, icon) { this.hooks.toast?.(msg, icon); }

  /* ------------------------------------------------------------------ */
  /* Inventory                                                           */
  /* ------------------------------------------------------------------ */

  newSlot(id, n) {
    const def = ITEMS[id];
    const s = { id, n };
    if (def.capacity) s.water = def.capacity;
    return s;
  }

  /** Adds items, returns how many didn't fit. Fills the hotbar first. */
  addItem(id, n = 1, silent = false) {
    const stack = isStackable(id);
    let left = n;
    if (stack) {
      for (const s of this.inv) {
        if (s && s.id === id && s.n < STACK_MAX) {
          const add = Math.min(left, STACK_MAX - s.n);
          s.n += add; left -= add;
          if (!left) break;
        }
      }
    }
    while (left > 0) {
      const i = this.inv.indexOf(null);
      if (i < 0) break;
      const add = stack ? Math.min(left, STACK_MAX) : 1;
      this.inv[i] = this.newSlot(id, add);
      left -= add;
    }
    if (!silent) this.hooks.invChanged?.();
    return left;
  }

  /** Would a list of [id, n] fit in the bag? */
  freeSlotsFor(items) {
    const inv = this.inv.map((s) => (s ? { ...s } : null));
    for (const [id, n] of items) {
      let left = n;
      if (isStackable(id)) for (const s of inv) if (s && s.id === id && s.n < STACK_MAX) { const a = Math.min(left, STACK_MAX - s.n); s.n += a; left -= a; }
      while (left > 0) {
        const i = inv.indexOf(null);
        if (i < 0) return false;
        const a = isStackable(id) ? Math.min(left, STACK_MAX) : 1;
        inv[i] = { id, n: a }; left -= a;
      }
    }
    return true;
  }

  canFit(id, n = 1) { return this.freeSlotsFor([[id, n]]); }
  count(id) { return this.inv.reduce((a, s) => a + (s && s.id === id ? s.n : 0), 0); }

  consume(slotIdx, n = 1) {
    const s = this.inv[slotIdx];
    if (!s) return;
    s.n -= n;
    if (s.n <= 0) {
      this.inv[slotIdx] = null;
      if (slotIdx === this.sel) this.sel = HAND;
    }
    this.hooks.invChanged?.();
  }

  get selected() { return this.sel >= 0 ? this.inv[this.sel] : null; }
  get selectedDef() { const s = this.selected; return s ? ITEMS[s.id] : null; }

  select(i) {
    if (i >= 0 && !this.inv[i]) i = HAND;
    if (i === this.sel) return;
    this.sel = i;
    audio.play('select');
    this.hooks.invChanged?.();
    this.hooks.selectionChanged?.();
  }

  /* ------------------------------------------------------------------ */
  /* Update                                                              */
  /* ------------------------------------------------------------------ */

  update(dt, input, view) {
    this.t += dt;
    this.view = view;
    const paused = this.hooks.isPaused?.();
    if (paused) {
      this.hover = null; this.hoverInfo = null;
      if (this.carry) this.dropCarry(true);
      this.drag = null; this.pan = null;
      return;
    }
    const prevMin = this.time;
    this.time += (dt / HOUR_SECONDS) * 60;
    this.simulate(dt / HOUR_SECONDS, prevMin, this.time);

    this.updateCamera(dt, input, view);
    this.updateHover(input, view);

    for (let i = 0; i < 10; i++) if (input.hit(String((i + 1) % 10))) this.select(this.sel === i ? HAND : i);
    if (input.hit('q', '`')) this.select(HAND);

    this.updatePointer(dt, input, view);
    this.updateCritters(dt, view);
    this.updateAmbientFx(dt, view);
    for (const [k, v] of this.fx.shake) { if (v - dt <= 0) this.fx.shake.delete(k); else this.fx.shake.set(k, v - dt); }
    for (const [k, v] of this.fx.drop) {
      const nv = v - dt;
      if (nv <= 0) {
        this.fx.drop.delete(k);
        audio.play('thud');
        const tx = k % MAP_W, ty = (k / MAP_W) | 0;
        this.particles.burst(tx * TILE + 8, ty * TILE + 14, 10, { color: ['#e8dcc0', '#c8b890', '#a89870'], speed: 35, vz: 15, g: 120, life: 0.6 });
      } else this.fx.drop.set(k, nv);
    }
    if (this.fx.cursor) { this.fx.cursor.t += dt; if (this.fx.cursor.t > this.fx.cursor.dur) this.fx.cursor = null; }
    this.particles.update(dt);
    this.tutorial.update(dt);
    this.ach.update(dt);
    this.ground.flush();
  }

  updateCamera(dt, input, view) {
    let dx = 0, dy = 0;
    if (input.down('a', 'ArrowLeft')) dx -= 1;
    if (input.down('d', 'ArrowRight')) dx += 1;
    if (input.down('w', 'ArrowUp')) dy -= 1;
    if (input.down('s', 'ArrowDown')) dy += 1;
    if (dx || dy) {
      const sp = PAN_SPEED * (input.down('Shift') ? 2 : 1) * dt;
      const bx = view.cam.x, by = view.cam.y;
      view.panWorld(dx * sp, dy * sp);
      this.notePan(Math.hypot(view.cam.x - bx, view.cam.y - by));
    }
    if (input.wheel) { view.zoomBy(-input.wheel, input.wheelX, input.wheelY); this.emit('zoom'); } // scroll down = zoom out
    if (input.hit('=', '+')) view.zoomBy(-1, innerWidth / 2, innerHeight / 2);
    if (input.hit('-', '_')) view.zoomBy(1, innerWidth / 2, innerHeight / 2);
    const pd = input.pinchDelta;
    if (pd.dx || pd.dy) { view.panScreen(-pd.dx, -pd.dy); this.notePan(Math.hypot(pd.dx, pd.dy)); }
    if (pd.zoom) view.zoomBy(pd.zoom, input.mouse.x, input.mouse.y);
  }

  notePan(d) {
    if (d <= 0) return;
    this.panned += d;
    this.emit('pan', this.panned);
  }

  /* ---------------------------- hover ---------------------------- */

  updateHover(input, view) {
    const m = input.mouse;
    if (!m.onCanvas) { this.hover = null; this.hoverInfo = null; return; }
    const p = view.toWorld(m.x, m.y);
    const tx = Math.floor(p.x / TILE), ty = Math.floor(p.y / TILE);
    if (!this.world.inBounds(tx, ty)) { this.hover = null; this.hoverInfo = null; return; }
    this.hover = { tx, ty, wx: p.x, wy: p.y };
    const info = this.describe(tx, ty);
    const key = info ? info.key : null;
    if (key !== this._hoverKey) {
      if (info && info.target && !this.drag && !this.pan) audio.play('hover');
      this._hoverKey = key;
    }
    this.hoverInfo = info;
  }

  /** Tooltip + highlight target for whatever is under the cursor. */
  describe(tx, ty) {
    const w = this.world;
    const i = w.idx(tx, ty);
    const def = this.selectedDef;
    const hand = this.sel === HAND;
    if (!this.carry) { const ex = this.describeExtra(tx, ty, i); if (ex) return ex; }
    if (this.isLocked(tx, ty)) return { key: 'locked', text: 'Riverside Meadow — for sale', sub: `buy it for ${fmt(MEADOW_PRICE)}c at Basil's market or the gate`, warn: true };
    if (this.carry) return { key: 'carry', text: this.carry.obj.type === 'crate' ? 'Crate' : nameOf(this.carry.obj), sub: 'let go to put it down' };
    if (w.isGranny(tx, ty)) return { key: 'granny', text: 'Granny Willow', sub: 'click to chat', target: { kind: 'granny' } };
    const s = w.structureAt(tx, ty);
    if (s) {
      const [name, sub] = STRUCT_INFO[s.type];
      let sub2 = sub;
      if (s.type === 'gate' && !this.meadowOwned) return { key: 'sgate', text: 'Riverside Meadow — for sale', sub: `click to buy it for ${fmt(MEADOW_PRICE)}c`, target: { kind: 'struct', s } };
      if (s.type === 'bin' && def && def.kind === 'produce') sub2 = `click to sell ${this.selected.n} ${def.name} for ${fmt(def.sell * this.selected.n)}c`;
      return { key: 's' + s.type, text: name, sub: sub2, target: { kind: 'struct', s } };
    }
    const o = w.objs.get(i);
    if (o) {
      if (o.type === 'crate') return { key: 'o' + i, text: o.gift ? 'A gift from Granny' : 'Delivery crate', sub: 'click to open' + (hand ? ' · drag to move' : ''), target: { kind: 'obj', i } };
      return { key: 'o' + i, text: nameOf(o), sub: hand ? 'drag to move it' : 'switch to the hand (Q) to move it', target: hand ? { kind: 'obj', i } : null };
    }
    const c = w.crops.get(i);
    if (c) {
      const cd = CROPS[c.id];
      const st = stageOf(c);
      if (st === 4) return { key: 'c' + i + 'r', text: `Ripe ${cd.name}`, sub: 'click to pick', target: { kind: 'crop', i }, good: true };
      const pct = Math.floor((c.growth / cd.hours) * 100);
      const wet = w.wet[i] > 0;
      const hrs = Math.ceil((cd.hours - c.growth) / (w.fert[i] ? 1.5 : 1));
      return { key: 'c' + i, text: `${cd.name} · ${pct}%`, sub: wet ? `ripe in about ${hrs}h` : 'thirsty! water me', warn: !wet };
    }
    if (w.weeds.has(i)) return { key: 'w' + i, text: 'Weed', sub: hand ? 'click to pull it' : 'pull it with the hand (Q)', target: hand ? { kind: 'weed', i } : null };
    if (w.ground[i] === G_WATER && def && (def.icon === 'can' || def.icon === 'bucket')) return { key: 'water', text: 'Pond', sub: 'click to refill' };
    return null;
  }

  /* ---------------------------- pointer ---------------------------- */

  updatePointer(dt, input, view) {
    const m = input.mouse;
    // camera dragging (right / middle button, or left-drag with the hand on empty ground)
    if ((m.rightPressed || m.middlePressed) && !this.drag) this.pan = { x: m.x, y: m.y, button: m.rightPressed ? 'right' : 'middle', vx: 0, vy: 0 };
    if (this.pan) {
      const held = this.pan.button === 'right' ? m.right : this.pan.button === 'middle' ? m.middle : m.left;
      const dx = m.x - this.pan.x, dy = m.y - this.pan.y;
      if (dx || dy) {
        view.panScreen(-dx, -dy);
        this.notePan(Math.hypot(dx, dy));
        this.pan.vx = this.pan.vx * 0.5 + (-dx / Math.max(dt, 0.001)) * 0.5;
        this.pan.vy = this.pan.vy * 0.5 + (-dy / Math.max(dt, 0.001)) * 0.5;
        this.pan.x = m.x; this.pan.y = m.y;
      } else { this.pan.vx *= 0.7; this.pan.vy *= 0.7; }
      if (!held) {
        if (m.moved > 6) view.fling(this.pan.vx, this.pan.vy);
        else if (this.pan.button === 'right') {
          // a right *click* puts the tool away
          if (this.carry) this.dropCarry(true);
          else this.select(HAND);
        }
        this.pan = null;
        if (this.drag && this.drag.mode === 'pan') this.drag = null;
      }
    }

    if (m.leftPressed && this.hover && !this.pan) this.pointerDown(m);
    if (this.drag) {
      if (m.left) this.pointerHold(m);
      else this.pointerUp(m);
    }
  }

  pointerDown(m) {
    const { tx, ty } = this.hover;
    const w = this.world;
    const i = w.idx(tx, ty);
    const slot = this.selected;
    const def = this.selectedDef;
    const hand = this.sel === HAND;
    this.scareButterflies(this.hover.wx, this.hover.wy);
    if (this.isLocked(tx, ty)) { (this.meadowOwned ? this.hooks.confirmHills : this.hooks.confirmMeadow)?.(); this.drag = { mode: 'none' }; return; }
    if (this.pointerExtra(tx, ty, i)) return;

    if (this.interact(tx, ty)) { this.drag = { mode: 'none' }; return; }
    const o = w.objs.get(i);
    if (o && (hand || o.type === 'crate')) { this.drag = { mode: 'grab', i, obj: o, canCarry: hand }; return; }
    const crop = w.crops.get(i);
    if (crop && stageOf(crop) === 4 && slot?.id !== 'sickle') {
      this.harvest(tx, ty);
      this.cursorAnim('pick', 0.2);
      this.drag = { mode: 'harvest', last: { tx, ty } };
      return;
    }
    if (hand) {
      if (w.weeds.has(i)) { this.pluck(tx, ty); this.drag = { mode: 'harvest', last: { tx, ty } }; return; }
      this.poke(tx, ty);
      this.drag = { mode: 'pan' };
      this.pan = { x: m.x, y: m.y, button: 'left', vx: 0, vy: 0 };
      return;
    }
    this.apply(slot, def, tx, ty, false);
    this.drag = { mode: PAINTABLE.has(slot.id) || def.kind === 'seed' ? 'paint' : 'none', last: { tx, ty } };
  }

  pointerHold(m) {
    const d = this.drag;
    if (d.mode === 'grab') {
      if (d.canCarry && m.moved > 5) {
        this.world.objs.delete(d.i);
        this.carry = { obj: d.obj, from: d.i };
        this.drag = { mode: 'carry' };
        audio.play('pickup');
      }
      return;
    }
    if ((d.mode === 'paint' || d.mode === 'harvest') && this.hover) {
      const { tx, ty } = this.hover;
      if (tx === d.last.tx && ty === d.last.ty) {
        if (this.selected?.id === 'can' && this.selected.water > 0 && Math.random() < 0.5) this.pourDrops(tx, ty);
        return;
      }
      // visit every tile between the last and current one so fast sweeps don't skip any
      const steps = Math.max(Math.abs(tx - d.last.tx), Math.abs(ty - d.last.ty));
      for (let k = 1; k <= steps; k++) {
        const x = Math.round(d.last.tx + ((tx - d.last.tx) * k) / steps), y = Math.round(d.last.ty + ((ty - d.last.ty) * k) / steps);
        if (this.isLocked(x, y)) continue;
        if (d.mode === 'harvest') {
          const i = this.world.idx(x, y);
          const c = this.world.crops.get(i);
          if (c && stageOf(c) === 4) this.harvest(x, y);
          else if (this.sel === HAND && this.world.weeds.has(i)) this.pluck(x, y);
        } else {
          const slot = this.selected;
          if (!slot) { this.drag = null; return; }
          this.apply(slot, ITEMS[slot.id], x, y, true);
        }
      }
      d.last = { tx, ty };
    }
  }

  pointerUp() {
    const d = this.drag;
    this.drag = null;
    if (!d) return;
    if (d.mode === 'grab') {
      if (d.obj.type === 'crate') this.hitCrate(d.i, d.obj);
      else this.pokeObject(d.i, d.obj);
    }
    if (d.mode === 'carry') this.dropCarry(false);
  }

  dropCarry(cancel) {
    const c = this.carry;
    if (!c) return;
    this.carry = null;
    const w = this.world;
    const h = this.hover;
    let dest = c.from;
    if (!cancel && h && this.canDropAt(h.tx, h.ty) && !this.isLocked(h.tx, h.ty)) dest = w.idx(h.tx, h.ty);
    if (w.objs.has(dest)) { const f = w.freeTileNear(dest % MAP_W, (dest / MAP_W) | 0); dest = f ? w.idx(f.tx, f.ty) : c.from; }
    w.objs.set(dest, c.obj);
    audio.play('drop');
    const tx = dest % MAP_W, ty = (dest / MAP_W) | 0;
    this.particles.burst(tx * TILE + 8, ty * TILE + 14, 6, { color: ['#e0b27a', '#cbc7d4', '#8fd65a'], speed: 20, vz: 25, g: 200, life: 0.4 });
    this.fx.shake.set(dest, 0.2);
    if (dest !== c.from) {
      if (c.obj.type === 'sprinkler') this.sprinklerWater(tx, ty, c.obj.tier, false);
      this.emit('move', c.obj.type);
    }
  }

  canDropAt(tx, ty) {
    const w = this.world;
    const i = w.idx(tx, ty);
    return w.isOpen(tx, ty) && !w.crops.has(i) && !w.weeds.has(i);
  }

  cursorAnim(kind, dur = 0.3) { this.fx.cursor = { kind, t: 0, dur }; }

  pourDrops(tx, ty) {
    this.particles.add({
      type: 'drop', x: tx * TILE + 8 + rand(-4, 4), y: ty * TILE + 8 + rand(-3, 3), z: 14, vz: -20, g: 300, life: 0.5,
      color: pick(['#8ac4f0', '#d4efff']), drag: 0,
    });
  }

  /* ------------------------------------------------------------------ */
  /* Simulation                                                          */
  /* ------------------------------------------------------------------ */

  simulate(dtH, prevMin, nowMin) {
    const w = this.world;
    const prevDay = Math.floor((prevMin - 360) / 1440), nowDay = Math.floor((nowMin - 360) / 1440);
    if (nowDay > prevDay) this.onMorning();
    const targetRain = this.weather.rain ? 1 : 0;
    this.weather.intensity += (targetRain - this.weather.intensity) * Math.min(1, dtH * 2);
    const raining = this.weather.intensity > 0.3;
    const N = MAP_W * MAP_H;
    for (let i = 0; i < N; i++) {
      if (w.ground[i] !== G_SOIL) continue;
      const was = w.wet[i] > 0;
      if (raining) w.wet[i] = 1;
      else if (w.wet[i] > 0) w.wet[i] = Math.max(0, w.wet[i] - dtH / WET_HOURS);
      if (was !== w.wet[i] > 0) this.ground.markDirty(i % MAP_W, (i / MAP_W) | 0);
    }
    for (const [i, c] of w.crops) {
      if (!(w.wet[i] > 0)) continue;
      const def = CROPS[c.id];
      if (c.growth >= def.hours) continue;
      const before = stageOf(c);
      c.growth = Math.min(def.hours, c.growth + dtH * (w.fert[i] ? 1.5 : 1));
      const after = stageOf(c);
      if (after !== before && this.hooks.isVisible?.(i)) {
        const tx = i % MAP_W, ty = (i / MAP_W) | 0;
        this.particles.sparkle(tx * TILE + 8, ty * TILE + 8, after === 4 ? 8 : 3, after === 4 ? undefined : ['#c8ef8a', '#8fd65a', '#ffffff']);
        if (after === 4) audio.play('grow');
      }
    }
    this.objsTick(dtH);
  }

  onMorning() {
    this.weather.rain = this.weather.tomorrow;
    this.weather.tomorrow = this.day >= 3 && Math.random() < 0.2;
    this.stats.days = this.day;
    this.runSprinklers(true);
    this.spawnWeeds(2 + Math.floor(Math.random() * 3));
    this.dailyExtra();
    this.hooks.newDay?.();
  }

  spawnWeeds(n) {
    const w = this.world;
    const G = LAYOUT.garden;
    if (w.weeds.size > 24) return;
    for (let k = 0; k < 80 && n > 0; k++) {
      const Z = this.meadowOwned && Math.random() < 0.45 ? LAYOUT.meadow : G;
      const tx = Z.x0 - 3 + Math.floor(Math.random() * (Z.x1 - Z.x0 + 7));
      const ty = Z.y0 - 2 + Math.floor(Math.random() * (Z.y1 - Z.y0 + 5));
      if (this.isLocked(tx, ty)) continue;
      const i = w.idx(tx, ty);
      if (!w.isOpen(tx, ty) || w.crops.has(i) || w.weeds.has(i) || w.floor[i]) continue;
      w.weeds.set(i, Math.floor(Math.random() * ART.weeds.length));
      w.deco[i] = 0;
      n--;
    }
  }

  runSprinklers(withFx) {
    for (const [i, o] of this.world.objs) if (o.type === 'sprinkler') this.sprinklerWater(i % MAP_W, (i / MAP_W) | 0, o.tier, withFx);
  }

  sprinklerWater(tx, ty, tier, withFx) {
    const w = this.world;
    for (const [dx, dy] of SPRINKLER_RANGE[tier]) {
      const x = tx + dx, y = ty + dy;
      if (!w.inBounds(x, y)) continue;
      const j = w.idx(x, y);
      if (w.ground[j] === G_SOIL) {
        if (!(w.wet[j] > 0)) this.ground.markDirty(x, y);
        w.wet[j] = 1;
      }
    }
    if (withFx) this.fx.sprinklers.push({ tx, ty, tier, t: 0 });
  }

  advanceTime(minutes) {
    let left = minutes;
    while (left > 0) {
      const m = Math.min(15, left);
      const prev = this.time;
      this.time += m;
      this.simulate(m / 60, prev, this.time);
      left -= m;
    }
    this.ground.flush();
  }

  sleep() {
    const m = this.minuteOfDay;
    this.advanceTime(m < 360 ? 360 - m : 1440 - m + 360);
    this.fx.sprinklers.length = 0;
    this.emit('sleep');
  }

  /* ------------------------------------------------------------------ */
  /* Actions                                                             */
  /* ------------------------------------------------------------------ */

  /** Use an item on a tile. `painting` = called while sweeping, so stay quiet on failure. */
  apply(slot, def, tx, ty, painting) {
    const w = this.world;
    if (!w.inBounds(tx, ty)) return;
    const i = w.idx(tx, ty);
    const cx = tx * TILE + 8, cy = ty * TILE + 8;
    const hint = (msg) => { if (!painting) this.hint(msg); };
    switch (def.kind) {
      case 'tool':
        this.useTool(slot, tx, ty, i, cx, cy, painting);
        break;
      case 'seed':
        if (w.weeds.has(i)) { hint('Pull the weed first (use the hand).'); break; }
        if (w.ground[i] === G_SOIL && !w.crops.has(i) && !w.objs.has(i)) {
          w.crops.set(i, { id: def.crop, growth: 0, harvests: 0 });
          this.consume(this.sel);
          audio.play('plant');
          this.cursorAnim('shake', 0.25);
          this.particles.burst(cx, cy + 2, 5, { color: ['#e0b27a', '#b07a4a'], speed: 15, vz: 30, g: 200, life: 0.4 });
          this.stats.planted++;
          this.emit('plant', def.crop);
        } else if (w.ground[i] === G_GRASS && w.isOpen(tx, ty)) hint('Till the grass with the Hoe first.');
        else if (w.crops.has(i)) hint('Something is already growing here.');
        break;
      case 'use':
        if (w.ground[i] === G_SOIL && !w.fert[i]) {
          w.fert[i] = 1;
          this.consume(this.sel);
          this.cursorAnim('shake', 0.25);
          this.particles.burst(cx, cy, 10, { color: ['#e0b27a', '#f2e2bc', '#8fd65a'], speed: 18, vz: 30, g: 150, life: 0.6 });
          audio.play('plant');
        } else if (w.fert[i]) hint('This soil is already fertilized.');
        else hint('Fertilizer goes on tilled soil.');
        break;
      case 'place':
        this.place(def, tx, ty, i, painting);
        break;
      case 'produce':
        hint(`Drag your ${def.name} onto the Shipping Bin to sell it.`);
        break;
    }
  }

  hint(msg) {
    if (this.lastHint === msg && this.t - this.lastHintT < 3) return;
    this.lastHint = msg; this.lastHintT = this.t;
    this.toast(msg);
  }

  isWaterSource(tx, ty) {
    const w = this.world;
    if (w.groundAt(tx, ty) === G_WATER) return true;
    const s = w.structureAt(tx, ty);
    return !!(s && s.type === 'well');
  }

  useTool(slot, tx, ty, i, cx, cy, painting) {
    if (this.useGoldTool(slot, tx, ty, painting)) return;
    const w = this.world;
    const id = slot.id;
    if (id === 'hoe') {
      if (w.ground[i] === G_GRASS && w.isOpen(tx, ty) && w.floor[i] === F_NONE) {
        w.ground[i] = G_SOIL;
        w.deco[i] = 0;
        if (w.weeds.delete(i)) this.particles.leafPuff(cx, cy);
        w.wet[i] = this.weather.intensity > 0.3 ? 1 : 0;
        this.ground.markDirty(tx, ty);
        this.particles.dirt(cx, cy);
        audio.play('till');
        this.cursorAnim('chop', 0.25);
        this.emit('till');
      } else if (!painting) {
        this.cursorAnim('chop', 0.25);
        audio.play('tok');
        if (w.floor[i] === F_PATH) this.hint('Use the Shovel to pick up paths.');
      }
      return;
    }
    if (id === 'can' || id === 'bucket') {
      const cap = ITEMS[id].capacity;
      if (this.isWaterSource(tx, ty)) {
        if (slot.water >= cap && painting) return;
        slot.water = cap;
        audio.play('fill');
        this.particles.water(cx, cy, 8);
        this.particles.text(cx, cy - 10, 'Refilled!', '#d4efff');
        this.cursorAnim('dip', 0.4);
        this.emit('fill', id);
        this.hooks.invChanged?.();
        return;
      }
      if (slot.water <= 0) {
        if (!painting) {
          this.hint(id === 'can' ? 'Your can is empty — click the pond or the well to refill it.' : 'The bucket is empty — click the pond or the well to fill it.');
          audio.play('error');
        }
        return;
      }
      slot.water--;
      const tiles = id === 'bucket' ? AREA3 : [[0, 0]];
      let crops = 0;
      for (const [dx, dy] of tiles) {
        const x = tx + dx, y = ty + dy;
        if (!w.inBounds(x, y)) continue;
        const j = w.idx(x, y);
        if (w.ground[j] === G_SOIL) {
          if (!(w.wet[j] > 0)) this.ground.markDirty(x, y);
          w.wet[j] = 1;
          if (w.crops.has(j)) crops++;
        }
        if (w.ground[j] !== G_WATER) this.particles.water(x * TILE + 8, y * TILE + 8, id === 'bucket' ? 6 : 8);
      }
      audio.play(id === 'bucket' ? 'splash' : 'water');
      this.cursorAnim(id === 'bucket' ? 'tip' : 'pour', id === 'bucket' ? 0.45 : 0.3);
      this.emit(id === 'bucket' ? 'bucket' : 'water', { crops });
      if (id === 'bucket') this.emit('water', { crops });
      this.hooks.invChanged?.();
      return;
    }
    if (id === 'shovel') {
      this.cursorAnim('chop', 0.3);
      const crop = w.crops.get(i);
      if (crop) {
        w.crops.delete(i);
        if (stageOf(crop) === 0) this.addItem('seed_' + crop.id, 1);
        this.particles.leafPuff(cx, cy);
        audio.play('dig');
        return;
      }
      const o = w.objs.get(i);
      if (o && o.type !== 'crate') {
        const itemId = OBJ_ITEM[o.type] ? OBJ_ITEM[o.type][o.tier] : o.type === 'fruittree' ? 'sapling_' + o.tree : o.type;
        if (!this.canFit(itemId)) { this.hint('Your bag is full.'); return; }
        w.objs.delete(i);
        this.addItem(itemId, 1);
        this.flyToBag(ART.icons[ITEMS[itemId].icon], cx, cy);
        audio.play('dig');
        return;
      }
      if (w.weeds.delete(i)) { this.particles.leafPuff(cx, cy); audio.play('pluck'); return; }
      if (w.floor[i] === F_PATH) {
        if (!this.canFit('path')) { this.hint('Your bag is full.'); return; }
        w.floor[i] = F_NONE;
        this.ground.markDirty(tx, ty);
        this.addItem('path', 1);
        this.particles.burst(cx, cy, 8, { color: ['#a9a5a8', '#7e7a80'], speed: 30, vz: 40, g: 250, life: 0.5 });
        audio.play('dig');
        return;
      }
      if (w.ground[i] === G_SOIL) {
        w.ground[i] = G_GRASS;
        w.fert[i] = 0;
        w.wet[i] = 0;
        this.ground.markDirty(tx, ty);
        this.particles.dirt(cx, cy);
        audio.play('dig');
      }
      return;
    }
    if (id === 'sickle') {
      this.cursorAnim('swish', 0.3);
      let got = 0;
      for (const [dx, dy] of AREA3) {
        const x = tx + dx, y = ty + dy;
        if (!w.inBounds(x, y)) continue;
        const j = w.idx(x, y);
        const c = w.crops.get(j);
        if (c && stageOf(c) === 4 && this.harvest(x, y, true)) got++;
        if (w.weeds.delete(j)) this.particles.leafPuff(x * TILE + 8, y * TILE + 10);
        if (w.deco[j] && w.deco[j] <= 3) { w.deco[j] = 0; this.particles.leafPuff(x * TILE + 8, y * TILE + 10); }
      }
      if (!painting || got) audio.play(got ? 'harvest' : 'swing');
    }
  }

  place(def, tx, ty, i, painting) {
    const w = this.world;
    if (def.place === 'path') {
      if (w.ground[i] === G_GRASS && w.floor[i] === F_NONE && w.isOpen(tx, ty)) {
        w.floor[i] = F_PATH;
        w.deco[i] = 0;
        w.weeds.delete(i);
        this.ground.markDirty(tx, ty);
        this.consume(this.sel);
        audio.play('place');
        this.cursorAnim('place', 0.2);
      } else if (!painting && w.ground[i] === G_SOIL) this.hint('Paths go on grass.');
      return;
    }
    if (!this.canDropAt(tx, ty)) {
      if (!painting) this.hint(w.crops.has(i) ? 'Something is growing there.' : w.weeds.has(i) ? 'Pull the weed first.' : 'That spot is taken.');
      return;
    }
    w.objs.set(i, { type: def.place, tier: def.tier || 0, ...(def.tree ? { tree: def.tree, age: 0 } : {}), ...(def.place === 'beehive' ? { honeyT: 0 } : {}) });
    w.deco[i] = 0;
    this.consume(this.sel);
    audio.play('place');
    this.cursorAnim('place', 0.2);
    this.fx.shake.set(i, 0.2);
    this.particles.burst(tx * TILE + 8, ty * TILE + 12, 6, { color: ['#e0b27a', '#cbc7d4'], speed: 20, vz: 30, g: 200, life: 0.4 });
    if (def.place === 'sprinkler') {
      this.sprinklerWater(tx, ty, def.tier, true);
      audio.play('sprinkler');
    }
    this.emit('place', def.place);
  }

  harvest(tx, ty, quiet = false) {
    const w = this.world;
    const i = w.idx(tx, ty);
    const c = w.crops.get(i);
    if (!c) return false;
    const def = CROPS[c.id];
    const n = def.yield || 1;
    if (!this.canFit(c.id, n)) { this.hint('Your bag is full! Sell something at the Shipping Bin.'); return false; }
    this.addItem(c.id, n);
    const cx = tx * TILE + 8, cy = ty * TILE + 6;
    this.flyToBag(ART.crops[c.id].icon, cx, cy);
    this.particles.sparkle(cx, cy, 6);
    this.particles.leafPuff(cx, cy + 4);
    this.particles.text(cx, cy - 10, `+${n} ${def.name}`, '#fff3a0');
    if (!quiet) audio.play('harvest');
    this.stats.harvested[c.id] = (this.stats.harvested[c.id] || 0) + n;
    if (def.regrow) {
      c.growth = def.hours - def.regrow;
      c.harvests = (c.harvests || 0) + 1;
    } else w.crops.delete(i);
    this.emit('harvest', c.id);
    return true;
  }

  pluck(tx, ty) {
    const w = this.world;
    const i = w.idx(tx, ty);
    if (!w.weeds.delete(i)) return;
    const cx = tx * TILE + 8, cy = ty * TILE + 10;
    this.particles.leafPuff(cx, cy);
    this.particles.burst(cx, cy, 4, { color: ['#7a4c30', '#946040'], speed: 20, vz: 40, g: 250, life: 0.4 });
    audio.play('pluck');
    this.cursorAnim('pick', 0.2);
    const r = Math.random();
    if (r < 0.22) {
      const id = pick(['seed_radish', 'seed_carrot', 'seed_lettuce', 'seed_potato']);
      if (this.canFit(id)) {
        this.addItem(id, 1);
        this.flyToBag(ART.icons[id], cx, cy);
        this.particles.text(cx, cy - 12, 'Found a seed!', '#c8ef8a');
      }
    } else if (r < 0.32 && !this.sandbox) {
      this.coins += 5;
      this.hooks.coinsChanged?.();
      this.particles.text(cx, cy - 12, '+5c', '#fff3a0');
      audio.play('coin');
    }
    this.emit('pluck');
  }

  /** Little tactile reactions when the hand clicks the scenery. */
  poke(tx, ty) {
    const w = this.world;
    const i = w.idx(tx, ty);
    const cx = tx * TILE + 8, cy = ty * TILE + 8;
    // tree canopies cover the tiles above their trunk, so look a few rows down too
    for (let dy = 0; dy <= 3; dy++) {
      const p = w.inBounds(tx, ty + dy) ? w.prop[w.idx(tx, ty + dy)] : -1;
      if (p >= 0 && (dy === 0 || w.props[p].type === 'tree')) {
        const pr = w.props[p];
        if (pr.type === 'lily') break;
        this.fx.shake.set('p' + p, 0.35);
        if (pr.type === 'tree' || pr.type === 'bush' || pr.type === 'reeds') {
          audio.play('rustle');
          const col = pr.kind === 'cherry' ? '#f2a2c8' : pr.kind === 'maple' ? '#f09a4a' : pr.kind === 'pine' ? '#25664a' : '#5cb04e';
          for (let k = 0; k < (pr.type === 'tree' ? 6 : 3); k++) {
            this.particles.add({ type: 'leaf', x: cx + rand(-12, 12), y: pr.ty * TILE + rand(-4, 8), z: pr.type === 'tree' ? rand(16, 30) : 8, vz: rand(-6, 0), g: 0, vx: rand(-8, 8), vy: rand(1, 5), life: 2.5, color: col, drag: 0.2 });
          }
        } else audio.play('tok');
        return;
      }
    }
    if (w.ground[i] === G_WATER) {
      audio.play('plop');
      this.scareFish(this.hover.wx, this.hover.wy);
      this.particles.add({ type: 'ripple', x: this.hover.wx, y: this.hover.wy, life: 0.8, r: 10, color: '#d4efff' });
      this.particles.add({ type: 'ripple', x: this.hover.wx, y: this.hover.wy, life: 0.5, r: 5, color: '#d4efff' });
      return;
    }
    if (w.deco[i]) {
      this.particles.leafPuff(cx, cy + 4);
      audio.play('rustle');
    }
  }

  pokeObject(i, o) {
    if (this.pokeObjectExtra(i, o)) return;
    this.fx.shake.set(i, 0.25);
    audio.play('tok');
    if (o.type === 'sprinkler') this.fx.sprinklers.push({ tx: i % MAP_W, ty: (i / MAP_W) | 0, tier: o.tier, t: 0.7 });
  }

  scareButterflies(x, y) {
    for (const b of this.critters.butterflies) if (Math.hypot(b.x - x, b.y - y) < 18) { b.leaving = true; b.retarget = 0; }
  }

  /** Item icon hops from the world into the toolbar. */
  flyToBag(spr, x, y) {
    const tgt = this.hooks.toolbarWorldPos?.() || { x, y: y - 40 };
    this.particles.pickup(spr, x, y, tgt);
  }

  /* ---------------------------- crates ---------------------------- */

  hitCrate(i, o) {
    o.hits = (o.hits || 0) + 1;
    this.fx.shake.set(i, 0.25);
    const tx = i % MAP_W, ty = (i / MAP_W) | 0;
    this.particles.burst(tx * TILE + 8, ty * TILE + 6, 4, { color: ['#d8a868', '#b07a4a'], speed: 30, vz: 40, g: 250, life: 0.4 });
    this.cursorAnim('knock', 0.18);
    if (o.hits < 3) { audio.play('knock', { n: o.hits }); return; }
    // unpack whatever fits; anything left stays in the crate
    const got = [], left = [];
    for (const [id, n] of o.items) {
      let fit = 0;
      for (let k = n; k > 0; k = Math.floor(k / 2)) if (this.freeSlotsFor([...got, [id, k]])) { fit = k; break; }
      while (fit < n && this.freeSlotsFor([...got, [id, fit + 1]])) fit++;
      if (fit) got.push([id, fit]);
      if (fit < n) left.push([id, n - fit]);
    }
    if (!got.length) {
      o.hits = 2;
      audio.play('error');
      this.hint('Your bag is full — sell or tidy some things, then knock again.');
      return;
    }
    if (left.length) {
      o.items = left;
      o.hits = 2;
      audio.play('crate');
      got.forEach(([id, n], k) => { this.addItem(id, n, true); setTimeout(() => this.flyToBag(ART.icons[ITEMS[id].icon], tx * TILE + 8, ty * TILE + 2), k * 110); });
      this.hooks.invChanged?.();
      this.hint('Your bag filled up! The rest is still in the crate — knock again when you have room.');
      return;
    }
    this.world.objs.delete(i);
    audio.play('crate');
    const cx = tx * TILE + 8, cy = ty * TILE + 8;
    this.particles.add({ type: 'item', spr: (o.gift ? ART.giftCrate : ART.crate).lid, x: cx, y: cy - 4, z: 0, vz: 120, g: 380, life: 0.9, target: { x: cx + 22, y: cy + 20 }, sx: cx, sy: cy - 4 });
    for (let k = 0; k < 6; k++) this.particles.add({ type: 'px', x: cx + rand(-6, 6), y: cy + rand(-4, 4), vx: rand(-40, 40), vy: rand(-20, 20), z: 4, vz: rand(40, 80), g: 300, life: 0.8, color: pick(['#d8a868', '#b07a4a', '#7a4a30']), size: 2, drag: 1 });
    this.particles.sparkle(cx, cy - 4, 10);
    o.items.forEach(([id, n], k) => {
      this.addItem(id, n, true);
      setTimeout(() => this.flyToBag(ART.icons[ITEMS[id].icon], cx + rand(-4, 4), cy - 6), k * 110);
    });
    this.hooks.invChanged?.();
    const names = o.items.map(([id, n]) => (n > 1 ? `${n} ${ITEMS[id].name}` : ITEMS[id].name));
    this.toast('Unpacked: ' + (names.length > 4 ? names.slice(0, 4).join(', ') + ` and ${names.length - 4} more` : names.join(', ')));
    this.emit('crate');
  }

  /** Purchases are collected while the shop is open and delivered in one crate. */
  flushOrder() {
    if (!this.pendingOrder.length) return;
    const w = this.world;
    const d = LAYOUT.delivery;
    const spot = w.freeTileNear(d.tx, d.ty);
    if (!spot) { for (const [id, n] of this.pendingOrder) this.addItem(id, n); this.pendingOrder = []; return; }
    const i = w.idx(spot.tx, spot.ty);
    w.objs.set(i, { type: 'crate', tier: 0, items: this.pendingOrder });
    w.deco[i] = 0;
    this.pendingOrder = [];
    this.fx.drop.set(i, 0.55);
    this.toast('Your order is here! Click the crate to unpack it.');
    this.emit('delivered');
  }

  /* ------------------------------------------------------------------ */
  /* Buildings & Granny                                                  */
  /* ------------------------------------------------------------------ */

  interact(tx, ty) {
    const w = this.world;
    if (w.isGranny(tx, ty)) { this.talkToGranny(); return true; }
    const s = w.structureAt(tx, ty);
    if (!s) return false;
    if (this.interactExtra(s, tx, ty)) { this.fx.shake.set('s' + s.type, 0.2); return true; }
    const slot = this.selected;
    switch (s.type) {
      case 'house': this.hooks.confirmSleep?.(); break;
      case 'stall': this.hooks.openShop?.(); break;
      case 'bin':
        if (slot && ITEMS[slot.id].kind === 'produce') this.binFx(s, this.sellSlot(this.sel, slot.n));
        else this.hooks.openSell?.();
        break;
      case 'well':
        if (slot && (slot.id === 'can' || slot.id === 'bucket')) this.useTool(slot, tx, ty, w.idx(tx, ty), tx * TILE + 8, ty * TILE + 8, false);
        else { audio.play('plop'); this.hint('A cool, deep well. Click it with a watering can or bucket to refill.'); }
        break;
      case 'sign':
        this.hooks.dialog?.('Sign', ['"Willow Garden — plant with love, water with patience."'], null);
        break;
      case 'gate':
        if (this.meadowOwned) this.visitMeadow();
        else this.hooks.confirmMeadow?.();
        break;
    }
    this.fx.shake.set('s' + s.type, 0.2);
    return true;
  }

  binFx(s, gain) {
    if (!gain) return;
    const x = (s.tx + 1) * TILE, y = s.ty * TILE;
    this.particles.text(x, y - 6, `+${fmt(gain)}c`, '#fff3a0');
    this.particles.sparkle(x, y, 8);
    this.fx.shake.set('s' + s.type, 0.25);
  }

  /** Dropping a toolbar item onto the world (drag & drop from the UI). */
  dropSlotAt(slotIdx, sx, sy) {
    if (!this.view) return;
    const p = this.view.toWorld(sx, sy);
    const tx = Math.floor(p.x / TILE), ty = Math.floor(p.y / TILE);
    const w = this.world;
    if (!w.inBounds(tx, ty)) return;
    const s = this.inv[slotIdx];
    if (!s) return;
    const def = ITEMS[s.id];
    const st = w.structureAt(tx, ty);
    if (st && st.type === 'bin') {
      if (def.kind === 'produce') this.binFx(st, this.sellSlot(slotIdx, s.n));
      else { this.hint('Only crops can go in the Shipping Bin.'); audio.play('error'); }
      return;
    }
    this.sel = slotIdx;
    this.hooks.invChanged?.();
    if (st || w.isGranny(tx, ty)) return;
    this.apply(s, def, tx, ty, false);
  }

  talkToGranny() {
    audio.play('talk', { pitch: 380 });
    this.emit('talk');
    if (this.tutorial.active) { this.tutorial.repeat(); return; }
    const hr = this.hour;
    const greet = hr < 11 ? `Good morning, ${this.name}!` : hr < 17 ? `Hello, ${this.name}.` : hr < 21 ? 'Lovely evening, isn\'t it?' : 'You\'re up late! Don\'t forget to rest.';
    this.hooks.dialog?.('Granny Willow', [greet, pick(GRANNY_TIPS)], 'granny');
  }

  /* ------------------------------------------------------------------ */
  /* Shop & selling                                                      */
  /* ------------------------------------------------------------------ */

  buy(id, n = 1) {
    const def = ITEMS[id];
    n = Math.max(1, Math.min(9999, Math.floor(Number(n) || 1)));
    if (def.kind === 'tool') {
      const inCrates = [...this.world.objs.values()].some((o) => o.type === 'crate' && o.items.some(([x]) => x === id));
      if (this.count(id) > 0 || inCrates || this.pendingOrder.some(([x]) => x === id)) { this.toast(`You already have a ${def.name}.`); audio.play('error'); return false; }
      n = 1;
    }
    const cost = this.sandbox ? 0 : def.price * n;
    if (cost > this.coins) { this.toast('Not enough coins.'); audio.play('error'); return false; }
    this.coins -= cost;
    const e = this.pendingOrder.find(([x]) => x === id);
    if (e) e[1] += n; else this.pendingOrder.push([id, n]);
    audio.play('buy');
    this.emit('buy', id);
    this.hooks.coinsChanged?.();
    return true;
  }

  sellSlot(i, n = 1) {
    const s = this.inv[i];
    if (!s) return 0;
    const def = ITEMS[s.id];
    if (def.kind !== 'produce') return 0;
    n = Math.min(n, s.n);
    const gain = def.sell * n;
    this.coins += gain;
    this.stats.earned += gain;
    this.consume(i, n);
    audio.play('coin');
    this.emit('sell', { id: s.id, n, gain });
    this.hooks.coinsChanged?.();
    return gain;
  }

  sellAllProduce() {
    let total = 0;
    for (let i = 0; i < this.inv.length; i++) {
      const s = this.inv[i];
      if (s && ITEMS[s.id].kind === 'produce') {
        const g = ITEMS[s.id].sell * s.n;
        total += g;
        this.emit('sell', { id: s.id, n: s.n, gain: g });
        this.inv[i] = null;
        if (this.sel === i) this.sel = HAND;
      }
    }
    if (total) {
      this.coins += total;
      this.stats.earned += total;
      audio.play('coin');
      this.hooks.invChanged?.();
      this.hooks.coinsChanged?.();
    }
    return total;
  }

  /* ------------------------------------------------------------------ */
  /* Critters & ambient effects                                          */
  /* ------------------------------------------------------------------ */

  updateCritters(dt, view) {
    if (!view) return;
    this.updateCat(dt);
    this.respawnFish(dt);
    const V = { x: view.cx, y: view.cy, w: view.vw, h: view.vh };
    const h = this.hour;
    const day = h > 6.5 && h < 19 && this.weather.intensity < 0.3;
    const night = (h > 20 || h < 4.5) && this.weather.intensity < 0.3;
    const B = this.critters.butterflies;
    if (day && B.length < 7 && Math.random() < dt * 0.6) {
      B.push({ x: V.x + rand(V.w), y: V.y + rand(V.h), tx: 0, ty: 0, retarget: 0, v: Math.floor(rand(ART.butterflies.length)), t: rand(10), leaving: false });
    }
    for (const b of B) {
      b.t += dt;
      b.retarget -= dt;
      if (!day) b.leaving = true;
      if (b.retarget <= 0) {
        b.retarget = rand(1.5, 4);
        b.tx = b.leaving ? b.x + rand(-1, 1) * 400 : b.x + rand(-60, 60);
        b.ty = b.leaving ? b.y - 300 : b.y + rand(-40, 40);
      }
      const dx = b.tx - b.x, dy = b.ty - b.y, d = Math.hypot(dx, dy) || 1;
      const sp = b.leaving ? 60 : 18;
      b.x += (dx / d) * sp * dt + Math.sin(b.t * 3) * 6 * dt;
      b.y += (dy / d) * sp * dt + Math.cos(b.t * 7) * 10 * dt;
    }
    this.critters.butterflies = B.filter((b) => !b.leaving || (b.x > V.x - 80 && b.x < V.x + V.w + 80 && b.y > V.y - 80));

    const F = this.critters.fireflies;
    if (night && F.length < 26 && Math.random() < dt * 4) F.push({ x: V.x + rand(V.w), y: V.y + rand(V.h), t: rand(10), life: rand(8, 16), vx: 0, vy: 0 });
    for (const f of F) {
      f.t += dt; f.life -= dt;
      f.vx += rand(-1, 1) * 20 * dt; f.vy += rand(-1, 1) * 20 * dt;
      f.vx *= 0.98; f.vy *= 0.98;
      f.x += f.vx * dt + Math.sin(f.t * 0.7) * 4 * dt;
      f.y += f.vy * dt + Math.cos(f.t * 0.5) * 3 * dt;
    }
    this.critters.fireflies = F.filter((f) => f.life > 0 && (night || f.life > 4));
  }

  /* ---------------------------- fish ---------------------------- */

  initFish() {
    const w = this.world;
    this.deepWater = [];
    for (let i = 0; i < w.waterDepth.length; i++) if (w.ground[i] === G_WATER && w.waterDepth[i] >= 1 && w.waterDepth[i] < 255) this.deepWater.push(i);
    const F = (this.critters.fish = []);
    const bodies = [[LAYOUT.pond.cx, LAYOUT.pond.cy, 9], [LAYOUT.lake.cx, LAYOUT.lake.cy, 5]];
    for (const [cx, cy, n] of bodies) {
      const near = this.deepWater.filter((i) => Math.hypot((i % MAP_W) - cx, ((i / MAP_W) | 0) - cy) < 8);
      for (let k = 0; k < n && near.length; k++) {
        const i = pick(near);
        F.push({
          x: (i % MAP_W) * TILE + rand(3, 13), y: ((i / MAP_W) | 0) * TILE + rand(3, 13), a: rand(Math.PI * 2), sp: rand(5, 11),
          tx: 0, ty: 0, retarget: 0, v: Math.random() < 0.25 ? 4 : Math.floor(rand(4)), t: rand(10), flee: 0, hidden: 0, jumpT: rand(8, 30),
        });
      }
    }
  }

  isDeep(x, y) {
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    if (!this.world.inBounds(tx, ty)) return false;
    const i = this.world.idx(tx, ty);
    return this.world.ground[i] === G_WATER && this.world.waterDepth[i] >= 1;
  }

  updateFish(dt) {
    for (const f of this.critters.fish) {
      f.t += dt;
      if (f.hidden > 0) { f.hidden -= dt; continue; }
      f.retarget -= dt;
      f.flee = Math.max(0, f.flee - dt);
      if (f.retarget <= 0 || Math.hypot(f.tx - f.x, f.ty - f.y) < 3) {
        for (let k = 0; k < 12; k++) {
          const nx = f.x + rand(-50, 50), ny = f.y + rand(-40, 40);
          if (this.isDeep(nx, ny)) { f.tx = nx; f.ty = ny; break; }
        }
        f.retarget = rand(2, 7);
      }
      const want = Math.atan2(f.ty - f.y, f.tx - f.x);
      let da = want - f.a;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      f.a += da * Math.min(1, dt * (f.flee ? 8 : 2));
      const sp = f.sp * (f.flee ? 5 : 1) * (0.7 + 0.3 * Math.sin(f.t * 3));
      const nx = f.x + Math.cos(f.a) * sp * dt, ny = f.y + Math.sin(f.a) * sp * dt;
      if (this.isDeep(nx, ny)) { f.x = nx; f.y = ny; } else { f.a += Math.PI * 0.6; f.retarget = 0; }
      // the occasional happy leap
      f.jumpT -= dt;
      if (f.jumpT <= 0) {
        f.jumpT = rand(10, 35);
        const tx = Math.floor(f.x / TILE), ty = Math.floor(f.y / TILE);
        if (this.hooks.isVisible?.(this.world.idx(tx, ty)) && !this.isLocked(tx, ty)) {
          f.hidden = 0.75;
          const dir = Math.cos(f.a) >= 0 ? 1 : -1;
          this.particles.add({ type: 'ripple', x: f.x, y: f.y + 2, life: 0.6, r: 7, color: '#d4efff' });
          this.particles.add({
            type: 'fish', spr: ART.fish[f.v], flip: dir < 0, x: f.x, y: f.y, vx: dir * 14, vy: 0, z: 0, vz: 75, g: 200, life: 0.75, drag: 0,
            onEnd: (p) => { this.particles.water(p.x, p.y + 2, 6); f.x = this.isDeep(p.x, p.y) ? p.x : f.x; },
          });
          audio.play('plop');
        }
      }
    }
  }

  scareFish(x, y) {
    for (const f of this.critters.fish) {
      const d = Math.hypot(f.x - x, f.y - y);
      if (d < 36) {
        f.flee = 1.2;
        f.tx = f.x + ((f.x - x) / (d || 1)) * 40;
        f.ty = f.y + ((f.y - y) / (d || 1)) * 40;
        f.retarget = 1.2;
      }
    }
  }

  updateAmbientFx(dt, view) {
    this.updateFish(dt);
    const H = this.world.structures.find((s) => s.type === 'house');
    if (H && Math.random() < dt * 3) {
      const ch = ART.house.chimney;
      this.particles.add({
        type: 'smoke', x: H.tx * TILE + ch.x + rand(-1, 1), y: (H.ty + H.h) * TILE - 80 + ch.y, vx: rand(2, 6), vy: rand(-10, -6),
        life: rand(2, 3.2), color: '#e8e4ee', drag: 0.2,
      });
    }
    for (const s of this.fx.sprinklers) {
      s.t += dt;
      if (s.t > 1.4) continue;
      const range = SPRINKLER_RANGE[s.tier];
      for (let k = 0; k < 2; k++) {
        const [dx, dy] = pick(range);
        const sx = s.tx * TILE + 8, sy = s.ty * TILE + 8;
        const ex = (s.tx + dx) * TILE + 8 + rand(-5, 5), ey = (s.ty + dy) * TILE + 8 + rand(-4, 4);
        this.particles.add({ type: 'drop', x: sx, y: sy, vx: (ex - sx) / 0.5, vy: (ey - sy) / 0.5, z: 6, vz: 40, g: 160, life: 0.55, color: pick(['#8ac4f0', '#d4efff']), drag: 0 });
      }
    }
    this.fx.sprinklers = this.fx.sprinklers.filter((s) => s.t < 1.4);
    if (view && Math.random() < dt * 2) {
      for (const [i, c] of this.world.crops) {
        const glow = CROPS[c.id].glow;
        if (stageOf(c) !== 4 || Math.random() > (glow ? 0.25 : 0.08) || !this.hooks.isVisible?.(i)) continue;
        const tx = i % MAP_W, ty = (i / MAP_W) | 0;
        const col = glow ? [`rgb(${glow.join(',')})`, '#ffffff'] : undefined;
        this.particles.sparkle(tx * TILE + 8 + rand(-5, 5), ty * TILE + rand(CROPS[c.id].rare ? -6 : 0, 8), 1, col);
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* Save / load                                                         */
  /* ------------------------------------------------------------------ */

  serialize() {
    if (this.carry) this.dropCarry(true);
    if (this.pendingOrder.length) this.flushOrder();
    return {
      version: VERSION, savedAt: Date.now(), name: this.name, mode: this.mode, coins: this.coins, time: this.time,
      weather: this.weather, inv: this.inv, sel: this.sel, cam: this.view ? { x: this.view.cam.x, y: this.view.cam.y } : null,
      world: this.world.serialize(), tutorial: this.tutorial.serialize(), stats: this.stats,
      meadow: this.meadowOwned, playerId: this.playerId, hills: this.hillsOwned, mail: this.mail, mailIdx: this.mailIdx, wishDay: this.wishDay,
      achievements: this.ach ? this.ach.serialize() : {},
    };
  }

  fromSave(d) {
    this.name = d.name || 'Gardener';
    this.mode = d.mode || 'cozy';
    this.world = new World(d.world.seed);
    this.world.load(d.world);
    this.coins = d.coins;
    this.time = d.time;
    this.weather = { rain: false, intensity: 0, tomorrow: false, ...d.weather };
    this.inv = d.inv.map((s) => (s && ITEMS[s.id] ? s : null));
    while (this.inv.length < INV_SIZE) this.inv.push(null);
    this.sel = d.sel ?? HAND;
    if (this.sel >= 0 && !this.inv[this.sel]) this.sel = HAND;
    this.savedCam = d.cam;
    this.meadowOwned = !!d.meadow;
    this.playerId = d.playerId || null;
    this.stats = { ...this.stats, ...d.stats };
  }
}

function nameOf(o) {
  const n = OBJ_NAMES[o.type];
  return Array.isArray(n) ? n[o.tier || 0] : n || o.type;
}

Object.assign(Game.prototype, ExpansionMethods);
