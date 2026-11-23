// v1.2 "Big Bloom" gameplay, mixed into Game.prototype (see the bottom of game.js):
// Blossom Hills, golden tools, the fishing net, beehives, fruit trees, campfires, the mailbox,
// the wishing well, the windmill, Mochi the cat, fish respawning and stat tracking for achievements.
import { TILE, MAP_W, ORIG_H, MEADOW_END, HILLS_PRICE, G_GRASS, G_SOIL, G_WATER, F_NONE, WILD_X } from '../config.js';
import { levelOf, BONUS_YIELD, netRadius } from '../data/tools.js';
import { LAYOUT } from './world.js';
import { ITEMS, TREES, FISH_TYPES } from '../data/items.js';
import { CROPS, CROP_IDS, stageOf } from '../data/crops.js';
import { ART } from '../art/index.js';
import { audio } from '../core/audio.js';
import { rand, pick } from '../core/util.js';

export const FISH_KINDS = ['koi', 'whitekoi', 'goldfish', 'carp', 'minnow', 'goldkoi'];
const fmt = (n) => Math.floor(n).toLocaleString('en-US');
const AREA3 = [[-1, -1], [0, -1], [1, -1], [-1, 0], [0, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
const WISH_COST = 250;

const LETTERS = [
  ['Granny Willow', 'Dear {name}, I found these seeds in my old coat pocket. Plant them somewhere sunny!', 'seeds'],
  ['Granny Willow', 'Dear {name}, the bees are humming early this year. A beehive near flowers makes the sweetest honey.', 'coins'],
  ['Basil', 'Hey {name}! Business is booming thanks to you. Here\'s a little something from the market.', 'coins'],
  ['Granny Willow', 'Dear {name}, remember: dark soil is happy soil. Here\'s some fertilizer from my shed.', 'fertilizer'],
  ['Mochi', 'meow. mrrp. (Mochi left you a "gift". It\'s a seed. Probably.)', 'seeds'],
  ['Granny Willow', 'Dear {name}, I heard the fish in the hills are made of gold. Silly rumours, surely!', 'coins'],
  ['Basil', 'New stock alert! Try a fruit tree. They need no watering at all. Here\'s a discount... well, some coins.', 'coins'],
  ['Granny Willow', 'Dear {name}, rainy days are a gift. So are these seeds.', 'seeds'],
  ['Granny Willow', 'Dear {name}, I tossed a coin in the wishing well once. I wished for a granddaughter like you!', 'seeds'],
  ['The Mayor', 'To the gardener of Willow Garden: the town council thanks you for making the valley so green.', 'coins'],
  ['Granny Willow', 'Dear {name}, campfires are lovely on cold nights. Don\'t forget to put them out!', 'fertilizer'],
  ['Basil', 'Psst. The Celestial Lotus is the best seed I sell. Worth every coin. Just saying.', 'coins'],
  ['Granny Willow', 'Dear {name}, a garden is never finished. That\'s the nice part. Love, Granny.', 'seeds'],
  ['Mochi', 'mrow. (There is a tiny paw print on this letter and nothing else.)', 'fertilizer'],
];

export const ExpansionMethods = {
  initExpansion(save) {
    const s = this.stats;
    for (const [k, v] of Object.entries({ weeds: 0, crates: 0, sold: 0, watered: 0, slept: 0, talks: 0, letters: 0, honey: 0, fruit: 0, pets: 0, wishes: 0, tilled: 0, maxCoins: 0, earned: 0, planted: 0 })) if (s[k] == null) s[k] = v;
    s.fish ||= {};
    s.placed ||= {};
    s.harvested ||= {};
    this.hillsOwned = save ? !!save.hills : false;
    this.mail = save ? save.mail ?? true : true;
    this.mailIdx = save ? save.mailIdx || 0 : 0;
    this.wishDay = save ? save.wishDay || 0 : 0;
    this.cat = { x: 15 * TILE, y: 10 * TILE, tx: 15 * TILE, ty: 10 * TILE, state: 'sit', t: 3, f: 0, flip: false, hearts: 0 };
    this.fx.windmill = 0;
    this.fishRespawn = 0;
    this.on('pluck', () => s.weeds++);
    this.on('crate', () => s.crates++);
    this.on('sell', (d) => { s.sold += d.n; });
    this.on('water', () => s.watered++);
    this.on('sleep', () => s.slept++);
    this.on('talk', () => s.talks++);
    this.on('till', () => s.tilled++);
    this.on('place', (t) => { s.placed[t] = (s.placed[t] || 0) + 1; });
  },

  /* ---------------------------- land ---------------------------- */

  isLocked(tx, ty) { return (!this.meadowOwned && ty >= ORIG_H) || (!this.hillsOwned && ty >= MEADOW_END); },

  buyHills() {
    if (this.hillsOwned) return false;
    if (!this.meadowOwned) { this.toast('Buy the Riverside Meadow first!'); audio.play('error'); return false; }
    if (!this.sandbox && this.coins < HILLS_PRICE) { this.toast('Not enough coins yet — keep growing!'); audio.play('error'); return false; }
    if (!this.sandbox) this.coins -= HILLS_PRICE;
    this.hillsOwned = true;
    audio.play('quest');
    audio.play('crate');
    const g = LAYOUT.gate2;
    this.fx.shake.set('sgate2', 0.5);
    this.particles.sparkle((g.tx + 1) * TILE, g.ty * TILE, 24);
    this.toast('Blossom Hills is yours! The second gate is open.');
    this.hooks.coinsChanged?.();
    this.emit('hills');
    setTimeout(() => this.visitHills(), 700);
    return true;
  },

  visitHills() {
    if (!this.view) return;
    const v = LAYOUT.hillsView;
    this.view.flyTo(v.tx * TILE + 8, v.ty * TILE + 8);
  },

  spawnWeeds(n) {
    const w = this.world;
    const zones = [LAYOUT.garden];
    if (this.meadowOwned) zones.push(LAYOUT.meadow);
    if (this.hillsOwned) zones.push(LAYOUT.hills);
    if (w.weeds.size > 30) return;
    for (let k = 0; k < 100 && n > 0; k++) {
      const Z = pick(zones);
      const tx = Z.x0 - 3 + Math.floor(Math.random() * (Z.x1 - Z.x0 + 7));
      const ty = Z.y0 - 2 + Math.floor(Math.random() * (Z.y1 - Z.y0 + 5));
      if (!w.inBounds(tx, ty) || this.isLocked(tx, ty)) continue;
      const i = w.idx(tx, ty);
      if (!w.isOpen(tx, ty) || w.crops.has(i) || w.weeds.has(i) || w.floor[i]) continue;
      w.weeds.set(i, Math.floor(Math.random() * ART.weeds.length));
      w.deco[i] = 0;
      n--;
    }
  },

  /* ---------------------------- hover info ---------------------------- */

  describeExtra(tx, ty, i) {
    const w = this.world;
    const h = this.hover;
    if (h && this.catNear(h.wx, h.wy)) return { key: 'cat', text: 'Mochi the cat', sub: this.cat.state === 'sleep' ? 'sleeping... click to give a gentle pet' : 'click to pet', target: { kind: 'cat' } };
    if (this.isLocked(tx, ty) && ty >= MEADOW_END && this.meadowOwned) return { key: 'locked2', text: 'Blossom Hills — for sale', sub: `buy it for ${fmt(HILLS_PRICE)}c at Basil's market or the gate`, warn: true };
    const M = LAYOUT.mailbox;
    if (tx === M.tx && ty === M.ty) return { key: 'mail', text: 'Mailbox', sub: this.mail ? 'you\'ve got mail! click to read' : 'no new letters today', target: { kind: 'mail' }, good: this.mail };
    const sel = this.selected;
    if (sel && sel.id === 'net' && w.ground[i] === G_WATER) {
      const f = this.fishAt(h.wx, h.wy);
      return { key: 'net' + (f ? 1 : 0), text: f ? FISH_TYPES[FISH_KINDS[f.v]].name : 'Water', sub: f ? 'click to scoop it up!' : 'aim the net at a fish', good: !!f };
    }
    const o = w.objs.get(i);
    if (o) {
      const hand = this.sel < 0;
      if (o.type === 'beehive') return { key: 'o' + i + (o.ready ? 'r' : ''), text: 'Beehive', sub: o.ready ? 'honey is ready! click to collect' : `honey in about ${Math.max(1, Math.ceil(24 - (o.honeyT || 0)))}h`, good: o.ready, target: { kind: 'obj', i } };
      if (o.type === 'fruittree') {
        const T = TREES[o.tree];
        const grown = (o.age || 0) >= T.days * 24;
        const sub = !grown ? `growing — ${Math.floor(((o.age || 0) / (T.days * 24)) * 100)}%` : o.fruit ? `${o.fruit} ${T.name.toLowerCase()}s ready! click to pick` : `fruit in about ${Math.max(1, Math.ceil(24 - (o.fruitT || 0)))}h`;
        return { key: 'o' + i + (o.fruit || 0), text: `${T.name} Tree`, sub, good: !!o.fruit, target: { kind: 'obj', i } };
      }
      if (o.type === 'campfire') return { key: 'o' + i + o.lit, text: 'Campfire', sub: hand ? (o.lit === false ? 'click to light it' : 'click to put it out · drag to move') : 'switch to the hand (Q) to light or move it', target: hand ? { kind: 'obj', i } : null };
    }
    return null;
  },

  /* ---------------------------- clicks ---------------------------- */

  /** Returns true if the click was used up by an expansion feature. */
  pointerExtra(tx, ty, i) {
    const w = this.world;
    const h = this.hover;
    if (this.catNear(h.wx, h.wy)) { this.petCat(); this.drag = { mode: 'none' }; return true; }
    const M = LAYOUT.mailbox;
    if (tx === M.tx && ty === M.ty) { this.readMail(); this.drag = { mode: 'none' }; return true; }
    const sel = this.selected;
    if (sel && sel.id === 'net') {
      this.cursorAnim('dip', 0.35);
      if (w.ground[i] !== G_WATER) { this.hint('Fish live in the ponds. Aim the net at one!'); this.drag = { mode: 'none' }; return true; }
      if (!this.wear(sel)) { this.drag = { mode: 'none' }; return true; }
      this.catchFish(h.wx, h.wy, netRadius(sel));
      this.drag = { mode: 'none' };
      return true;
    }
    // ripe trees and full hives can be picked with anything in hand
    const o = w.objs.get(i);
    if (o && ((o.type === 'beehive' && o.ready) || (o.type === 'fruittree' && o.fruit))) {
      this.collectObj(i, o);
      this.drag = { mode: 'none' };
      return true;
    }
    return false;
  },

  pokeObjectExtra(i, o) {
    if (o.type === 'beehive' || o.type === 'fruittree') { this.collectObj(i, o); return true; }
    if (o.type === 'campfire') {
      o.lit = o.lit === false;
      audio.play(o.lit ? 'crate' : 'water');
      this.fx.shake.set(i, 0.25);
      const tx = i % MAP_W, ty = (i / MAP_W) | 0;
      this.particles.burst(tx * TILE + 8, ty * TILE + 8, 8, { color: o.lit ? ['#ffd040', '#f08a2c', '#ff5a1a'] : ['#e8e4ee', '#b8b4c0'], speed: 20, vz: 40, g: -30, life: 0.8 });
      return true;
    }
    return false;
  },

  collectObj(i, o) {
    const tx = i % MAP_W, ty = (i / MAP_W) | 0;
    const cx = tx * TILE + 8, cy = ty * TILE + 4;
    this.fx.shake.set(i, 0.35);
    if (o.type === 'beehive') {
      if (!o.ready) { audio.play('tok'); this.hint('The bees are still busy. Honey comes once a day.'); return; }
      const id = o.wild ? 'wildhoney' : 'honey';
      if (!this.canFit(id)) { this.hint('Your bag is full!'); return; }
      this.addItem(id, 1);
      o.ready = false; o.honeyT = 0;
      this.flyToBag(ART.icons[id], cx, cy);
      this.particles.text(cx, cy - 12, `+1 ${ITEMS[id].name}`, '#fff3a0');
      audio.play('harvest');
      this.stats.honey++;
      this.emit('honey');
      return;
    }
    if (o.type === 'fruittree') {
      if (!o.fruit) { audio.play('rustle'); this.hint((o.age || 0) >= TREES[o.tree].days * 24 ? 'No fruit yet. Trees fruit once a day.' : 'This tree is still growing up.'); return; }
      const id = 'fruit_' + o.tree;
      const sel = this.selected;
      if (sel && sel.id === 'picker' && this.wear(sel)) o.fruit += BONUS_YIELD[levelOf(sel) - 1];
      if (!this.canFit(id, o.fruit)) { this.hint('Your bag is full!'); return; }
      this.addItem(id, o.fruit);
      for (let k = 0; k < o.fruit; k++) setTimeout(() => this.flyToBag(ART.icons[id], cx + rand(-10, 10), cy - 24 + rand(-6, 6)), k * 120);
      this.particles.text(cx, cy - 30, `+${o.fruit} ${TREES[o.tree].name}`, '#fff3a0');
      for (let k = 0; k < 6; k++) this.particles.add({ type: 'leaf', x: cx + rand(-14, 14), y: cy + rand(-4, 6), z: rand(18, 32), vz: rand(-6, 0), g: 0, vx: rand(-8, 8), vy: rand(1, 5), life: 2, color: '#5cb04e', drag: 0.2 });
      this.stats.fruit += o.fruit;
      o.fruit = 0; o.fruitT = 0;
      audio.play('rustle');
      audio.play('harvest');
      this.emit('fruit');
    }
  },

  /** Golden tools. Returns true if handled. */
  useGoldTool(slot, tx, ty, painting) {
    const w = this.world;
    if (slot.id === 'goldhoe') {
      let n = 0;
      for (const [dx, dy] of AREA3) if (this.tillTile(tx + dx, ty + dy)) n++;
      this.cursorAnim('chop', 0.25);
      if (n) audio.play('till'); else if (!painting) audio.play('tok');
      return true;
    }
    if (slot.id === 'goldcan') {
      const cap = ITEMS.goldcan.capacity;
      if (this.isWaterSource(tx, ty)) {
        if (slot.water >= cap && painting) return true;
        slot.water = cap;
        audio.play('fill');
        this.particles.water(tx * TILE + 8, ty * TILE + 8, 10);
        this.particles.text(tx * TILE + 8, ty * TILE - 2, 'Refilled!', '#d4efff');
        this.cursorAnim('dip', 0.4);
        this.emit('fill', 'goldcan');
        this.hooks.invChanged?.();
        return true;
      }
      if (slot.water <= 0) { if (!painting) { this.hint('Your golden can is empty — click the pond or the well.'); audio.play('error'); } return true; }
      slot.water--;
      let crops = 0;
      for (const [dx, dy] of AREA3) {
        const x = tx + dx, y = ty + dy;
        if (!w.inBounds(x, y) || this.isLocked(x, y)) continue;
        const j = w.idx(x, y);
        if (w.ground[j] === G_SOIL) {
          if (!(w.wet[j] > 0)) this.ground.markDirty(x, y);
          w.wet[j] = 1;
          if (w.crops.has(j)) crops++;
        }
        if (w.ground[j] !== G_WATER && Math.random() < 0.5) this.particles.water(x * TILE + 8, y * TILE + 8, 4);
      }
      audio.play('water');
      this.cursorAnim('pour', 0.3);
      this.emit('water', { crops });
      this.hooks.invChanged?.();
      return true;
    }
    return false;
  },

  tillTile(tx, ty) {
    const w = this.world;
    if (!w.inBounds(tx, ty) || this.isLocked(tx, ty) || tx >= WILD_X) return false;
    const i = w.idx(tx, ty);
    if (w.ground[i] !== G_GRASS || !w.isOpen(tx, ty) || w.floor[i] !== F_NONE) return false;
    w.ground[i] = G_SOIL;
    w.deco[i] = 0;
    if (w.weeds.delete(i)) this.particles.leafPuff(tx * TILE + 8, ty * TILE + 8);
    w.wet[i] = this.weather.intensity > 0.3 ? 1 : 0;
    this.ground.markDirty(tx, ty);
    if (Math.random() < 0.5) this.particles.dirt(tx * TILE + 8, ty * TILE + 8);
    this.emit('till');
    return true;
  },

  /* ---------------------------- buildings ---------------------------- */

  interactExtra(s, tx, ty) {
    switch (s.type) {
      case 'gate2':
        if (this.hillsOwned) this.visitHills();
        else this.hooks.confirmHills?.();
        return true;
      case 'wish':
        this.makeWish(s);
        return true;
      case 'windmill':
        this.fx.windmill = 3;
        audio.play('swing');
        audio.play('rustle');
        return true;
    }
    return false;
  },

  readMail() {
    const M = LAYOUT.mailbox;
    this.fx.shake.set('mail', 0.3);
    if (!this.mail) { audio.play('tok'); this.hint('No new letters today. The mail comes every morning.'); return; }
    this.mail = false;
    const [from, text, gift] = LETTERS[this.mailIdx % LETTERS.length];
    this.mailIdx++;
    this.stats.letters++;
    audio.play('open');
    let giftLine = '';
    const cx = M.tx * TILE + 8, cy = M.ty * TILE;
    if (gift === 'coins' && !this.sandbox) {
      const c = 100 + Math.floor(this.stats.earned * 0.01 / 50) * 50;
      const amt = Math.min(c, 5000);
      this.coins += amt;
      this.hooks.coinsChanged?.();
      giftLine = `(${fmt(amt)} coins were tucked inside!)`;
      this.particles.text(cx, cy - 10, `+${fmt(amt)}c`, '#fff3a0');
    } else if (gift === 'fertilizer') {
      this.addItem('fertilizer', 5);
      giftLine = '(5 Fertilizer were tucked inside!)';
      this.flyToBag(ART.icons.fertilizer, cx, cy);
    } else {
      // seeds roughly matching how far along the garden is
      const owned = CROP_IDS.filter((id) => CROPS[id].seedPrice <= Math.max(60, this.stats.earned / 40));
      const id = pick(owned.slice(-12).length ? owned.slice(-12) : ['radish']);
      this.addItem('seed_' + id, 3);
      giftLine = `(3 ${ITEMS['seed_' + id].name} were tucked inside!)`;
      this.flyToBag(ART.icons['seed_' + id], cx, cy);
    }
    this.hooks.dialog?.(`Letter from ${from}`, [text.replace('{name}', this.name), giftLine], from === 'Granny Willow' ? 'granny' : null);
    this.emit('letter');
  },

  makeWish(s) {
    const cx = (s.tx + 1) * TILE, cy = s.ty * TILE + 8;
    if (this.wishDay === this.day) { audio.play('plop'); this.hint('The well\'s magic is resting. Make another wish tomorrow!'); return; }
    if (!this.sandbox && this.coins < WISH_COST) { audio.play('error'); this.hint(`You need ${WISH_COST} coins to toss into the well.`); return; }
    if (!this.sandbox) this.coins -= WISH_COST;
    this.wishDay = this.day;
    this.stats.wishes++;
    this.hooks.coinsChanged?.();
    audio.play('plop');
    this.particles.sparkle(cx, cy, 16, ['#f08ac0', '#fff3a0', '#8ac4f0', '#ffffff']);
    const r = Math.random();
    let msg;
    if (r < 0.05) {
      this.addItem('goldgnome', 1);
      this.flyToBag(ART.goldgnome, cx, cy);
      msg = 'A GOLDEN GNOME rose from the well! Incredibly lucky!';
      this.stats.luckyWish = (this.stats.luckyWish || 0) + 1;
      audio.play('quest');
    } else if (r < 0.25) {
      this.weather.tomorrow = true;
      msg = 'The well whispers... it will rain tomorrow.';
    } else if (r < 0.45) {
      for (const c of this.world.crops.values()) c.growth = Math.min(CROPS[c.id].hours, c.growth + 4);
      msg = 'A warm breeze! All your crops grew a little.';
      audio.play('grow');
    } else if (r < 0.65) {
      this.addItem('fertilizer', 10);
      this.flyToBag(ART.icons.fertilizer, cx, cy);
      msg = 'The well gives back 10 Fertilizer.';
    } else if (r < 0.85) {
      const pool = CROP_IDS.filter((id) => CROPS[id].seedPrice <= Math.max(100, this.stats.earned / 25));
      const id = pick(pool.slice(-10));
      this.addItem('seed_' + id, 5);
      this.flyToBag(ART.icons['seed_' + id], cx, cy);
      msg = `The well gives you 5 ${ITEMS['seed_' + id].name}!`;
    } else {
      const amt = this.sandbox ? 0 : WISH_COST * 4;
      this.coins += amt;
      this.hooks.coinsChanged?.();
      msg = amt ? `Coins bubble up: +${fmt(amt)}!` : 'The water sparkles happily.';
    }
    this.particles.text(cx, cy - 26, 'Wish made!', '#f08ac0');
    this.toast(msg);
    this.emit('wish');
  },

  /* ---------------------------- daily + hourly ticks ---------------------------- */

  dailyExtra() {
    this.mail = true;
  },

  objsTick(dtH) {
    for (const [i, o] of this.world.objs) {
      if (o.type === 'beehive' && !o.ready) {
        o.honeyT = (o.honeyT || 0) + dtH;
        if (o.honeyT >= 24) {
          o.ready = true;
          o.wild = this.flowersNear(i % MAP_W, (i / MAP_W) | 0);
        }
      } else if (o.type === 'fruittree') {
        const T = TREES[o.tree];
        if ((o.age || 0) < T.days * 24) o.age = (o.age || 0) + dtH;
        else if (!o.fruit) {
          o.fruitT = (o.fruitT || 0) + dtH;
          if (o.fruitT >= 24) { o.fruit = 3; o.fruitT = 0; }
        }
      }
    }
  },

  flowersNear(tx, ty) {
    const w = this.world;
    for (let dy = -3; dy <= 3; dy++)
      for (let dx = -3; dx <= 3; dx++) {
        if (!w.inBounds(tx + dx, ty + dy)) continue;
        const j = w.idx(tx + dx, ty + dy);
        const c = w.crops.get(j);
        if (c && CROPS[c.id].cat === 'flower' && stageOf(c) >= 3) return true;
        const o = w.objs.get(j);
        if (o && o.type === 'flowerpot') return true;
      }
    return false;
  },

  /* ---------------------------- fish ---------------------------- */

  initFish() {
    const w = this.world;
    this.deepWater = [];
    for (let i = 0; i < w.waterDepth.length; i++) if (w.ground[i] === G_WATER && w.waterDepth[i] >= 1 && w.waterDepth[i] < 255) this.deepWater.push(i);
    this.fishBodies = [
      { cx: LAYOUT.pond.cx, cy: LAYOUT.pond.cy, n: 9, gold: 0 },
      { cx: LAYOUT.lake.cx, cy: LAYOUT.lake.cy, n: 6, gold: 0 },
      { cx: LAYOUT.hillPond.cx, cy: LAYOUT.hillPond.cy, n: 8, gold: 0.18 },
    ];
    for (const b of this.fishBodies) b.tiles = this.deepWater.filter((i) => Math.hypot((i % MAP_W) - b.cx, ((i / MAP_W) | 0) - b.cy) < 9);
    this.critters.fish = [];
    for (const b of this.fishBodies) for (let k = 0; k < b.n; k++) this.spawnFish(b);
  },

  spawnFish(b) {
    if (!b.tiles.length) return;
    const i = pick(b.tiles);
    const v = Math.random() < b.gold ? 5 : Math.random() < 0.22 ? 4 : Math.floor(rand(4));
    this.critters.fish.push({
      x: (i % MAP_W) * TILE + rand(3, 13), y: ((i / MAP_W) | 0) * TILE + rand(3, 13), a: rand(Math.PI * 2), sp: rand(5, 11), body: b,
      tx: 0, ty: 0, retarget: 0, v, t: rand(10), flee: 0, hidden: 0, jumpT: rand(8, 30),
    });
  },

  respawnFish(dt) {
    this.fishRespawn -= dt;
    if (this.fishRespawn > 0) return;
    this.fishRespawn = 20;
    for (const b of this.fishBodies) if (this.critters.fish.filter((f) => f.body === b).length < b.n) this.spawnFish(b);
  },

  fishAt(x, y, r = 12) {
    let best = null, bd = r;
    for (const f of this.critters.fish) {
      if (f.hidden > 0) continue;
      const d = Math.hypot(f.x - x, f.y - y);
      if (d < bd) { bd = d; best = f; }
    }
    return best;
  },

  catchFish(x, y, r = 12) {
    const f = this.fishAt(x, y, r);
    this.particles.water(x, y, 8);
    if (!f) { audio.play('splash'); this.particles.text(x, y - 8, 'Missed!', '#d4efff'); this.scareFish(x, y); return; }
    const kind = FISH_KINDS[f.v];
    const id = 'fish_' + kind;
    if (!this.canFit(id)) { this.hint('Your bag is full!'); return; }
    this.critters.fish.splice(this.critters.fish.indexOf(f), 1);
    this.addItem(id, 1);
    this.flyToBag(ART.icons[id], f.x, f.y);
    this.particles.text(f.x, f.y - 10, `Caught a ${FISH_TYPES[kind].name}!`, kind === 'goldkoi' ? '#fff3a0' : '#d4efff');
    if (kind === 'goldkoi') this.particles.sparkle(f.x, f.y, 14);
    audio.play('splash');
    audio.play('harvest');
    this.stats.fish[kind] = (this.stats.fish[kind] || 0) + 1;
    this.emit('fish', kind);
  },

  /* ---------------------------- Mochi the cat ---------------------------- */

  catNear(x, y) {
    const c = this.cat;
    return c && Math.abs(x - c.x) < 9 && y > c.y - 14 && y < c.y + 3;
  },

  petCat() {
    const c = this.cat;
    c.hearts = 1.2;
    if (c.state !== 'sleep') { c.state = 'sit'; c.t = 3; }
    this.stats.pets++;
    audio.play('talk', { pitch: 260 });
    setTimeout(() => audio.play('talk', { pitch: 240 }), 120);
    for (let k = 0; k < 3; k++) this.particles.add({ type: 'heart', x: c.x + rand(-5, 5), y: c.y - 12, vx: rand(-6, 6), vy: -14, life: 1.1, drag: 0.5 });
    this.emit('pet');
  },

  updateCat(dt) {
    const c = this.cat;
    const w = this.world;
    c.hearts = Math.max(0, c.hearts - dt);
    c.t -= dt;
    const h = this.hour;
    if (h >= 21 || h < 6) {
      if (c.state !== 'sleep') { c.state = 'walk'; c.tx = 15 * TILE + 8; c.ty = 8 * TILE + 12; }
      if (Math.hypot(c.tx - c.x, c.ty - c.y) < 2) c.state = 'sleep';
    } else if (c.state === 'sleep') { c.state = 'sit'; c.t = 2; }
    if (c.state === 'walk') {
      const dx = c.tx - c.x, dy = c.ty - c.y, d = Math.hypot(dx, dy);
      if (d < 1.5) { c.state = 'sit'; c.t = rand(3, 9); return; }
      c.x += (dx / d) * 14 * dt;
      c.y += (dy / d) * 14 * dt;
      c.flip = dx < 0;
      c.f += dt * 6;
    } else if (c.state === 'sit' && c.t <= 0) {
      for (let k = 0; k < 10; k++) {
        const tx = 6 + Math.floor(Math.random() * 20), ty = 8 + Math.floor(Math.random() * 9);
        const i = w.idx(tx, ty);
        if (w.ground[i] === G_WATER || w.struct[i] >= 0 || (w.prop[i] >= 0 && w.props[w.prop[i]].solid) || w.objs.has(i) || w.isGranny(tx, ty)) continue;
        c.tx = tx * TILE + 8; c.ty = ty * TILE + 12; c.state = 'walk';
        break;
      }
      c.t = 2;
    }
  },

  /* ---------------------------- the "whole world garden" ---------------------------- */

  /** How many tiles of the whole map are tilled, out of every tile that could be. */
  tilledProgress() {
    const w = this.world;
    let total = 0, done = 0;
    for (let i = 0; i < w.ground.length; i++) {
      if (w.ground[i] === G_WATER || w.struct[i] >= 0 || w.prop[i] >= 0) continue;
      const tx = i % MAP_W, ty = (i / MAP_W) | 0;
      if (w.isGranny(tx, ty) || tx >= WILD_X) continue;
      total++;
      if (w.ground[i] === G_SOIL) done++;
    }
    return { done, total };
  },
};
