// v1.3 "Wildwood" gameplay, mixed into Game.prototype: tool levels + durability, the Wildwood
// (chopping, mining, foraging, treasure chests, Fern's trades, the shrine), the workbench, the
// seed maker, special harvesting tools, the fog of war, and the bedtime rule.
import { TILE, MAP_W, MAP_H, WILD_X, G_SOIL, G_WATER } from '../config.js';
import { LAYOUT, WILD_CHUNK, isWild } from './world.js';
import { ITEMS, TREES } from '../data/items.js';
import { CROPS, CROP_IDS } from '../data/crops.js';
import {
  MATERIALS, LEVEL_NAMES, HARVEST_TOOLS, BONUS_YIELD, levelOf, hasDurability, maxDur, durOf, capacityOf, toolName,
  hitPower, UPGRADE_COST, repairCost, RECIPES, TRADES, WILD_ONLY, FORAGE_SEEDS,
} from '../data/tools.js';
import { ART } from '../art/index.js';
import { audio } from '../core/audio.js';
import { rand, pick } from '../core/util.js';

const fmt = (n) => Math.floor(n).toLocaleString('en-US');
const PROP_HP = { tree: 6, rock: 4, ore: 7 };
const REGROW_H = { tree: 72, rock: 48, ore: 72 };
const CHUNKS_X = Math.ceil((MAP_W - WILD_X) / WILD_CHUNK);

export const WildMethods = {
  initWild(save) {
    const s = this.stats;
    for (const k of ['chopped', 'mined', 'foraged', 'chestsOpened', 'crafted', 'trades', 'upgrades', 'repairs', 'seedsMade', 'crystals', 'goldTools']) if (s[k] == null) s[k] = 0;
    this.shrineDay = save ? save.shrineDay || 0 : 0;
    // tools from older saves get a level and full durability
    for (const slot of this.inv) if (slot && hasDurability(slot)) { slot.lvl ||= levelOf(slot); if (slot.dur == null) slot.dur = maxDur(slot); }
  },

  /* ---------------------------- tools: levels + durability ---------------------------- */

  /** Use up one point of durability. Returns false (and complains) if the tool is broken. */
  wear(slot, n = 1) {
    if (!slot || !hasDurability(slot) || this.sandbox) return true;
    const d = durOf(slot);
    if (d <= 0) {
      this.hint(`Your ${toolName(slot, ITEMS)} is broken! Repair it at a Workbench.`);
      audio.play('error');
      return false;
    }
    slot.dur = Math.max(0, d - n);
    if (slot.dur === 0) {
      this.toast(`Your ${toolName(slot, ITEMS)} broke! Repair it at a Workbench.`, slot.id);
      audio.play('error');
    }
    this.hooks.invChanged?.();
    return true;
  },

  isBroken(slot) { return hasDurability(slot) && !this.sandbox && durOf(slot) <= 0; },

  /** Hoe and watering cans of every level (replaces the old golden-tool logic). */
  useLeveledTool(slot, tx, ty, painting) {
    const id = slot.id;
    if (!['hoe', 'can', 'goldhoe', 'goldcan'].includes(id)) return false;
    const w = this.world;
    const area = areaFor(slot);
    if (id === 'hoe' || id === 'goldhoe') {
      if (isWild(tx)) { if (!painting) this.hint('The Wildwood is too wild to farm. Explore it instead!'); return true; }
      let n = 0;
      for (const [dx, dy] of area) if (this.canTill(tx + dx, ty + dy)) n++;
      if (!n) { if (!painting) { audio.play('tok'); this.cursorAnim('chop', 0.25); } return true; }
      if (!this.wear(slot)) return true;
      for (const [dx, dy] of area) this.tillTile(tx + dx, ty + dy);
      this.cursorAnim('chop', 0.25);
      audio.play('till');
      return true;
    }
    // watering cans
    const cap = capacityOf(slot, ITEMS);
    if (this.isWaterSource(tx, ty)) {
      if (slot.water >= cap && painting) return true;
      slot.water = cap;
      audio.play('fill');
      this.particles.water(tx * TILE + 8, ty * TILE + 8, 10);
      this.particles.text(tx * TILE + 8, ty * TILE - 2, 'Refilled!', '#d4efff');
      this.cursorAnim('dip', 0.4);
      this.emit('fill', id);
      this.hooks.invChanged?.();
      return true;
    }
    if (slot.water <= 0) { if (!painting) { this.hint('Your can is empty — click the pond or the well to refill it.'); audio.play('error'); } return true; }
    if (!this.wear(slot)) return true;
    slot.water--;
    let crops = 0;
    for (const [dx, dy] of area) {
      const x = tx + dx, y = ty + dy;
      if (!w.inBounds(x, y) || this.isLocked(x, y)) continue;
      const j = w.idx(x, y);
      if (w.ground[j] === G_SOIL) {
        if (!(w.wet[j] > 0)) this.ground.markDirty(x, y);
        w.wet[j] = 1;
        if (w.crops.has(j)) crops++;
      }
      if (w.ground[j] !== G_WATER && (area.length === 1 || Math.random() < 0.5)) this.particles.water(x * TILE + 8, y * TILE + 8, area.length === 1 ? 10 : 4);
    }
    audio.play('water');
    this.cursorAnim('pour', 0.3);
    this.emit('water', { crops });
    this.hooks.invChanged?.();
    return true;
  },

  canTill(tx, ty) {
    const w = this.world;
    if (!w.inBounds(tx, ty) || this.isLocked(tx, ty) || isWild(tx)) return false;
    const i = w.idx(tx, ty);
    return w.ground[i] === 0 && w.isOpen(tx, ty) && w.floor[i] === 0;
  },

  /** Count a material across the bag. */
  has(mats) {
    for (const [k, n] of Object.entries(mats)) {
      if (k === 'coins') { if (!this.sandbox && this.coins < n) return false; continue; }
      if (this.count(k) < n) return false;
    }
    return true;
  },

  spend(mats) {
    for (const [k, n] of Object.entries(mats)) {
      if (k === 'coins') { if (!this.sandbox) this.coins -= n; continue; }
      let left = n;
      for (let i = this.inv.length - 1; i >= 0 && left > 0; i--) {
        const s = this.inv[i];
        if (!s || s.id !== k) continue;
        const take = Math.min(left, s.n);
        s.n -= take; left -= take;
        if (s.n <= 0) { this.inv[i] = null; if (this.sel === i) this.sel = -1; }
      }
    }
    this.hooks.invChanged?.();
    this.hooks.coinsChanged?.();
  },

  /* ---------------------------- workbench ---------------------------- */

  craft(recipe) {
    if (!this.has(recipe.mats)) { audio.play('error'); this.toast('You don\'t have enough materials.'); return false; }
    const n = recipe.n || 1;
    if (!this.canFit(recipe.id, n)) { audio.play('error'); this.toast('Your bag is full.'); return false; }
    this.spend(recipe.mats);
    this.addItem(recipe.id, n);
    this.stats.crafted++;
    audio.play('place');
    audio.play('buy');
    this.toast(`Crafted ${n > 1 ? n + '× ' : ''}${ITEMS[recipe.id].name}!`, recipe.id);
    this.emit('craft', recipe.id);
    return true;
  },

  upgradeTool(slot) {
    const l = levelOf(slot);
    if (l >= 4 || slot.id === 'goldhoe' || slot.id === 'goldcan') return false;
    const cost = UPGRADE_COST[l + 1];
    if (!this.has(cost)) { audio.play('error'); this.toast('Not enough coins or materials for that upgrade.'); return false; }
    this.spend(cost);
    slot.lvl = l + 1;
    slot.dur = maxDur(slot);
    if (slot.water != null) slot.water = capacityOf(slot, ITEMS);
    this.stats.upgrades++;
    if (slot.lvl === 4) this.stats.goldTools++;
    audio.play('quest');
    this.toast(`Upgraded to ${toolName(slot, ITEMS)}!`, slot.id);
    this.emit('upgrade', slot.id);
    this.hooks.invChanged?.();
    return true;
  },

  repairTool(slot) {
    if (!hasDurability(slot) || durOf(slot) >= maxDur(slot)) return false;
    const cost = repairCost(slot);
    if (!this.has(cost)) { audio.play('error'); this.toast('Not enough coins or wood to repair that.'); return false; }
    this.spend(cost);
    slot.dur = maxDur(slot);
    this.stats.repairs++;
    audio.play('place');
    this.emit('repair', slot.id);
    this.hooks.invChanged?.();
    return true;
  },

  /* ---------------------------- the Wildwood ---------------------------- */

  wildKey(p) { return p.tx + ',' + p.ty; },
  wildState(p) { return this.world.wildState[this.wildKey(p)] || {}; },
  setWild(p, st) { this.world.wildState[this.wildKey(p)] = st; },

  /** The wild prop under (or, for tall trees, just below) a tile. */
  wildPropAt(tx, ty) {
    const w = this.world;
    for (let dy = 0; dy <= 3; dy++) {
      if (!w.inBounds(tx, ty + dy)) break;
      const pi = w.prop[w.idx(tx, ty + dy)];
      if (pi < 0) continue;
      const p = w.props[pi];
      if (!p.wild) { if (dy === 0) return null; continue; }
      if (dy === 0 || (p.type === 'tree' && !(this.wildState(p).regrow > 0))) return { p, pi };
    }
    return null;
  },

  isExplored(tx, ty) {
    if (!isWild(tx)) return true;
    const cx = Math.floor((tx - WILD_X) / WILD_CHUNK), cy = Math.floor(ty / WILD_CHUNK);
    return !!this.world.explored[cy * CHUNKS_X + cx];
  },

  updateExplore(view) {
    if (!view || view.cx + view.vw < WILD_X * TILE) return;
    const m = 0.12;
    const x0 = Math.floor((view.cx + view.vw * m) / TILE), x1 = Math.floor((view.cx + view.vw * (1 - m)) / TILE);
    const y0 = Math.floor((view.cy + view.vh * m) / TILE), y1 = Math.floor((view.cy + view.vh * (1 - m)) / TILE);
    let changed = false;
    for (let ty = Math.max(0, y0); ty <= Math.min(MAP_H - 1, y1); ty += 2)
      for (let tx = Math.max(WILD_X, x0); tx <= Math.min(MAP_W - 1, x1); tx += 2) {
        if (this.isLocked(tx, ty)) continue;
        const k = Math.floor(ty / WILD_CHUNK) * CHUNKS_X + Math.floor((tx - WILD_X) / WILD_CHUNK);
        if (!this.world.explored[k]) { this.world.explored[k] = 1; changed = true; }
      }
    if (changed) this.emit('explore');
  },

  exploredCount() { return this.world.explored.reduce((a, b) => a + b, 0); },
  get chunkTotal() { return this.world.explored.length; },
  get chestTotal() { return this.world.props.filter((p) => p.type === 'chest').length; },

  describeWild(tx, ty, i) {
    const w = this.world;
    if (w.isFern(tx, ty)) return { key: 'fern', text: 'Fern the Forager', sub: 'click to trade materials for rare seeds', target: { kind: 'fern' } };
    if (isWild(tx) && !this.isExplored(tx, ty)) return { key: 'fog', text: 'Unexplored', sub: 'scroll the view over here to explore', warn: true };
    const o = w.objs.get(i);
    if (o && o.type === 'workbench') return { key: 'o' + i, text: 'Workbench', sub: this.sel < 0 ? 'click to craft, upgrade & repair · drag to move' : 'click to craft, upgrade & repair', target: { kind: 'obj', i } };
    if (o && o.type === 'seedmaker') {
      const sub = o.crop ? (o.t > 0 ? `making ${ITEMS['seed_' + o.crop].name} — ${Math.ceil(o.t)}h left` : `${ITEMS['seed_' + o.crop].name} are ready! click to collect`) : 'hold a crop and click to turn it into seeds';
      return { key: 'o' + i + (o.t > 0 ? 'b' : 'r'), text: 'Seed Maker', sub, good: o.crop && o.t <= 0, target: { kind: 'obj', i } };
    }
    const wp = this.wildPropAt(tx, ty);
    if (!wp) return null;
    const { p, pi } = wp;
    const st = this.wildState(p);
    const t = { kind: 'prop', pi };
    switch (p.type) {
      case 'tree':
        if (st.regrow > 0) return { key: 'p' + pi + 's', text: 'Tree stump', sub: `regrows in about ${Math.ceil(st.regrow)}h` };
        return { key: 'p' + pi, text: 'Wild tree', sub: this.selected?.id === 'axe' ? 'click to chop' : 'chop it with an Axe for Wood', target: t };
      case 'rock':
        if (st.regrow > 0) return null;
        return { key: 'p' + pi, text: 'Rock', sub: this.selected?.id === 'pickaxe' ? 'click to mine' : 'break it with a Pickaxe for Stone', target: t };
      case 'ore': {
        if (st.regrow > 0) return null;
        const n = { copper: 'Copper', iron: 'Iron', gold: 'Gold', crystal: 'Crystal' }[p.kind];
        return { key: 'p' + pi, text: `${n} vein`, sub: this.selected?.id === 'pickaxe' ? 'click to mine' : 'mine it with a Pickaxe', target: t, good: p.kind === 'crystal' };
      }
      case 'forage': {
        const ready = st.day !== this.day;
        const n = { herbs: 'Wild herbs', mushrooms: 'Wild mushrooms', berries: 'Wild berry bush' }[p.kind];
        return { key: 'p' + pi + ready, text: n, sub: ready ? 'click to forage' : 'picked clean — comes back tomorrow', good: ready, target: ready ? t : null };
      }
      case 'chest':
        return st.opened ? { key: 'p' + pi + 'o', text: 'Empty chest', sub: 'you already found this treasure' } : { key: 'p' + pi, text: 'Treasure chest!', sub: 'click to open', target: t, good: true };
    }
    return null;
  },

  /** Wildwood clicks. Returns true if handled. */
  pointerWild(tx, ty, i) {
    const w = this.world;
    const slot = this.selected;
    if (w.isFern(tx, ty)) { this.talkToFern(); this.drag = { mode: 'none' }; return true; }
    if (isWild(tx) && !this.isExplored(tx, ty)) { this.hint('Unexplored! Scroll the view over here first.'); this.drag = { mode: 'none' }; return true; }
    const o = w.objs.get(i);
    if (o && o.type === 'workbench' && this.sel >= 0) { this.hooks.openWorkbench?.(); this.drag = { mode: 'none' }; return true; }
    if (o && o.type === 'seedmaker' && this.sel >= 0) { this.useSeedMaker(i, o); this.drag = { mode: 'none' }; return true; }
    if (isWild(tx) && slot) {
      const def = ITEMS[slot.id];
      if (['seed', 'use', 'place'].includes(def.kind)) { this.hint('The Wildwood is too wild to farm or build in. Explore it instead!'); this.drag = { mode: 'none' }; return true; }
    }
    const wp = this.wildPropAt(tx, ty);
    if (!wp) return false;
    const { p, pi } = wp;
    const st = this.wildState(p);
    this.drag = { mode: 'none' };
    if (p.type === 'tree' || p.type === 'rock' || p.type === 'ore') {
      if (st.regrow > 0) return p.type === 'tree' ? (this.hint('Just a stump for now. It\'ll grow back.'), true) : false;
      const need = p.type === 'tree' ? 'axe' : 'pickaxe';
      if (!slot || slot.id !== need) {
        this.fx.shake.set('p' + pi, 0.25);
        audio.play(p.type === 'tree' ? 'rustle' : 'tok');
        this.hint(p.type === 'tree' ? 'You need an Axe to chop trees.' : 'You need a Pickaxe to break rocks.');
        return true;
      }
      if (!this.wear(slot)) return true;
      this.hitProp(p, pi, st, slot);
      return true;
    }
    if (p.type === 'forage') { this.forage(p, pi, st); return true; }
    if (p.type === 'chest') { this.openChest(p, pi, st); return true; }
    return false;
  },

  hitProp(p, pi, st, slot) {
    const hp = (st.hp ?? PROP_HP[p.type]) - hitPower(slot);
    const cx = p.tx * TILE + 8, cy = p.ty * TILE + (p.type === 'tree' ? -6 : 8);
    this.fx.shake.set('p' + pi, 0.3);
    this.cursorAnim('chop', 0.25);
    const chips = p.type === 'tree' ? ['#b07a4a', '#e0b27a', '#7a4a30'] : ['#9490a6', '#cbc7d4', '#6e6a80'];
    this.particles.burst(cx, cy, 6, { color: chips, speed: 35, vz: 50, g: 260, life: 0.5 });
    audio.play('knock', { n: hp > 0 ? 1 : 2 });
    if (hp > 0) { this.setWild(p, { ...st, hp }); return; }
    // it's down! drop the goods
    const drops = [];
    const lvl = levelOf(slot);
    if (p.type === 'tree') {
      drops.push(['wood', 3 + Math.floor(Math.random() * 3) + (lvl - 1)]);
      if (Math.random() < 0.3) drops.push(['fiber', 1 + Math.floor(Math.random() * 2)]);
      if (Math.random() < 0.04) drops.push(['sapling_' + pick(Object.keys(TREES)), 1]);
      this.stats.chopped++;
      audio.play('rustle');
      this.emit('chop');
    } else if (p.type === 'rock') {
      drops.push(['stone', 2 + Math.floor(Math.random() * 3) + (lvl - 1)]);
      if (Math.random() < 0.18) drops.push(['copper', 1]);
      this.stats.mined++;
      this.emit('mine');
    } else {
      const k = { copper: 'copper', iron: 'iron', gold: 'goldore', crystal: 'crystal' }[p.kind];
      drops.push([k, k === 'crystal' ? 1 + (Math.random() < 0.25 * lvl ? 1 : 0) : 1 + Math.floor(Math.random() * 2) + Math.floor(lvl / 2)]);
      drops.push(['stone', 1]);
      if (k === 'crystal') this.stats.crystals += drops[0][1];
      this.stats.mined++;
      this.emit('mine');
    }
    this.giveDrops(drops, cx, cy);
    this.setWild(p, { regrow: REGROW_H[p.type] });
  },

  giveDrops(drops, cx, cy) {
    const names = [];
    drops.forEach(([id, n], k) => {
      if (!this.canFit(id, n)) { this.hint('Your bag is full!'); return; }
      this.addItem(id, n, true);
      names.push(`+${n} ${ITEMS[id].name}`);
      setTimeout(() => this.flyToBag(ART.icons[ITEMS[id].icon], cx + rand(-6, 6), cy), k * 120);
    });
    this.hooks.invChanged?.();
    if (names.length) this.particles.text(cx, cy - 12, names.join('  '), '#fff3a0');
  },

  forage(p, pi, st) {
    const cx = p.tx * TILE + 8, cy = p.ty * TILE + 6;
    this.fx.shake.set('p' + pi, 0.3);
    if (st.day === this.day) { audio.play('rustle'); this.hint('Already picked today. It\'ll be full again tomorrow.'); return; }
    const drops = [];
    const seeds = FORAGE_SEEDS[p.kind];
    if (p.kind === 'herbs') { drops.push(['fiber', 2 + Math.floor(Math.random() * 3)]); if (Math.random() < 0.35) drops.push(['seed_' + pick(seeds), 1 + (Math.random() < 0.3 ? 1 : 0)]); }
    if (p.kind === 'mushrooms') { if (Math.random() < 0.6) drops.push(['seed_' + pick(seeds), 1 + (Math.random() < 0.3 ? 1 : 0)]); drops.push(['fiber', 1]); }
    if (p.kind === 'berries') { if (Math.random() < 0.55) drops.push(['seed_' + pick(seeds), 1 + (Math.random() < 0.3 ? 1 : 0)]); drops.push(['petals', 1 + Math.floor(Math.random() * 2)]); }
    this.giveDrops(drops, cx, cy);
    this.particles.leafPuff(cx, cy + 4);
    audio.play('pluck');
    this.cursorAnim('pick', 0.2);
    this.setWild(p, { day: this.day });
    this.stats.foraged++;
    this.emit('forage');
  },

  openChest(p, pi, st) {
    const cx = p.tx * TILE + 8, cy = p.ty * TILE + 6;
    this.fx.shake.set('p' + pi, 0.35);
    if (st.opened) { audio.play('tok'); this.hint('This chest is empty. You found its treasure already.'); return; }
    const tier = p.tier || 0;
    const drops = [];
    const mats = [['wood', 'stone', 'fiber', 'copper'], ['copper', 'iron', 'petals', 'stone'], ['iron', 'goldore', 'stardust', 'goldore']][tier];
    for (let k = 0; k < 2 + tier; k++) drops.push([pick(mats), 3 + Math.floor(Math.random() * (4 + tier * 3))]);
    if (Math.random() < 0.3 + tier * 0.3) drops.push(['crystal', 1 + Math.floor(tier / 2)]);
    const wild = [...WILD_ONLY];
    drops.push(['seed_' + pick(wild), 2 + tier]);
    if (tier >= 1) {
      const rare = CROP_IDS.filter((id) => CROPS[id].cat === 'magic' && !WILD_ONLY.has(id));
      drops.push(['seed_' + pick(rare.slice(tier === 1 ? 0 : -10)), 1 + tier]);
    }
    // merge duplicate stacks
    const merged = {};
    for (const [id, n] of drops) merged[id] = (merged[id] || 0) + n;
    this.giveDrops(Object.entries(merged), cx, cy);
    const coins = [500, 2500, 10000][tier];
    if (!this.sandbox) { this.coins += coins; this.hooks.coinsChanged?.(); }
    if (merged.crystal) this.stats.crystals += merged.crystal;
    this.particles.sparkle(cx, cy, 16);
    audio.play('crate');
    this.setWild(p, { opened: true });
    this.stats.chestsOpened++;
    this.toast(`Treasure! ${this.sandbox ? '' : `+${fmt(coins)} coins and `}${Object.keys(merged).length} kinds of loot.`);
    this.emit('chest');
  },

  talkToFern() {
    audio.play('talk', { pitch: 460 });
    this.hooks.openTrades?.();
  },

  trade(t) {
    if (!this.has(t.give)) { audio.play('error'); this.toast('You don\'t have enough materials for that trade.'); return false; }
    if (!this.canFit(t.get[0], t.get[1])) { audio.play('error'); this.toast('Your bag is full.'); return false; }
    this.spend(t.give);
    this.addItem(t.get[0], t.get[1]);
    this.stats.trades++;
    audio.play('buy');
    this.toast(`Fern gives you ${t.get[1]} ${ITEMS[t.get[0]].name}.`, t.get[0]);
    this.emit('trade');
    return true;
  },

  useShrine(s) {
    const cx = (s.tx + 1) * TILE, cy = s.ty * TILE + 4;
    if (this.shrineDay === this.day) { audio.play('tok'); this.hint('The shrine is quiet. Come back tomorrow for another blessing.'); return; }
    this.shrineDay = this.day;
    audio.play('quest');
    this.particles.sparkle(cx, cy, 18, ['#7ad8f8', '#ffffff', '#b8f0ff']);
    const r = Math.random();
    let msg;
    const w = this.world;
    if (r < 0.3) {
      for (let i = 0; i < w.ground.length; i++) if (w.ground[i] === G_SOIL && !isWild(i % MAP_W)) { if (!(w.wet[i] > 0)) this.ground.markDirty(i % MAP_W, (i / MAP_W) | 0); w.wet[i] = 1; }
      msg = 'A gentle mist rolls over your farm. Every crop is watered!';
    } else if (r < 0.55) {
      for (const c of w.crops.values()) c.growth = Math.min(CROPS[c.id].hours, c.growth + 3);
      msg = 'The shrine hums. All your crops grew a little.';
    } else if (r < 0.85) {
      this.giveDrops([['wood', 10], ['stone', 10], ['fiber', 10]], cx, cy);
      msg = 'A bundle of wood, stone and fiber appears at the shrine.';
    } else {
      this.giveDrops([['stardust', 2], ['crystal', 1]], cx, cy);
      this.stats.crystals += 1;
      msg = 'Starlight gathers into Stardust and a Crystal Shard!';
    }
    this.toast(msg);
    this.emit('shrine');
  },

  /* ---------------------------- seed maker ---------------------------- */

  useSeedMaker(i, o) {
    const tx = i % MAP_W, ty = (i / MAP_W) | 0;
    const cx = tx * TILE + 8, cy = ty * TILE + 4;
    this.fx.shake.set(i, 0.25);
    if (o.crop && o.t <= 0) {
      const id = 'seed_' + o.crop;
      const n = 2 + (Math.random() < 0.15 ? 1 : 0);
      if (!this.canFit(id, n)) { this.hint('Your bag is full!'); return; }
      this.addItem(id, n);
      this.flyToBag(ART.icons[id], cx, cy);
      this.particles.text(cx, cy - 10, `+${n} ${ITEMS[id].name}`, '#c8ef8a');
      audio.play('harvest');
      o.crop = null;
      this.stats.seedsMade++;
      this.emit('seedmade');
      return;
    }
    if (o.crop) { audio.play('tok'); this.hint(`Still working... about ${Math.ceil(o.t)}h left.`); return; }
    const s = this.selected;
    if (!s || !CROPS[s.id]) { audio.play('tok'); this.hint('Hold a harvested crop and click the Seed Maker to turn it into seeds.'); return; }
    o.crop = s.id;
    o.t = 6;
    this.consume(this.sel);
    audio.play('place');
    this.particles.burst(cx, cy, 6, { color: ['#8fd65a', '#e0b27a'], speed: 20, vz: 30, g: 200, life: 0.5 });
    this.toast(`The Seed Maker whirs... ${ITEMS['seed_' + o.crop].name} in 6 hours.`);
  },

  /* ---------------------------- harvest bonuses ---------------------------- */

  /** Extra crops (and materials) for harvesting with the right tool; plus the odd bonus seed. */
  harvestExtras(cropId, cx, cy) {
    const c = CROPS[cropId];
    const slot = this.selected;
    let bonus = 0;
    const extra = [];
    if (slot && HARVEST_TOOLS[slot.id] && HARVEST_TOOLS[slot.id].includes(c.cat) && !this.isBroken(slot)) {
      this.wear(slot);
      bonus = BONUS_YIELD[levelOf(slot) - 1];
      if (slot.id === 'shears') extra.push(['petals', 1 + Math.floor(Math.random() * 2)]);
      if (slot.id === 'trowel' && Math.random() < 0.4) extra.push(['fiber', 1]);
      if (slot.id === 'wand' && Math.random() < 0.6) extra.push(['stardust', 1]);
    }
    if (Math.random() < 0.06) extra.push(['seed_' + cropId, 1]);
    if (extra.length) setTimeout(() => this.giveDrops(extra, cx, cy - 4), 150);
    return bonus;
  },

  /* ---------------------------- time ---------------------------- */

  wildTick(dtH) {
    for (const st of Object.values(this.world.wildState)) if (st.regrow > 0) st.regrow = Math.max(0, st.regrow - dtH);
    for (const o of this.world.objs.values()) if (o.type === 'seedmaker' && o.crop && o.t > 0) o.t = Math.max(0, o.t - dtH);
  },

  /** Bed is only for the night now (8 pm – 5 am). */
  canSleep() { const h = this.hour; return h >= 20 || h < 5; },
};

/** Hoe/can area for a slot (golden legacy tools keep their 3x3). */
function areaFor(slot) {
  const l = levelOf(slot);
  const PLUS = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
  const SQ = (r) => { const a = []; for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) a.push([x, y]); return a; };
  if (slot.id === 'goldhoe' || slot.id === 'goldcan') return SQ(1);
  if (slot.id === 'can') return [[[0, 0]], PLUS, SQ(1), SQ(1)][l - 1];
  return [[[0, 0]], PLUS, SQ(1), SQ(2)][l - 1];
}
export { LEVEL_NAMES, MATERIALS, RECIPES, TRADES };
