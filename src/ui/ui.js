// DOM user interface: HUD, hotbar, dialog, backpack, shop, shipping bin, menus, title + character creator.
import { ART, iconURL } from '../art/index.js';
import { sprite, drawSprite } from '../art/palette.js';
import { ITEMS, SHOP_SEEDS, SHOP_GOODS, SHOP_DECOR, isStackable, STACK_MAX } from '../data/items.js';
import { ACHIEVEMENTS, TIERS } from '../game/achievements.js';
import { HILLS_PRICE } from '../config.js';
import { CHANGELOG } from '../data/changelog.js';
import { CROPS } from '../data/crops.js';
import { audio } from '../core/audio.js';
import { formatTime, makeCanvas } from '../core/util.js';
import { HAND, MEADOW_PRICE } from '../game/game.js';
import { leaderboard, STATS } from '../game/leaderboard.js';
import { VERSION } from '../config.js';

const $ = (sel, el = document) => el.querySelector(sel);
const h = (html) => {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
};
const fmt = (n) => Math.floor(n).toLocaleString('en-US');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const WEATHER_ICONS = {
  sun: ['..Y.Y.Y..', '...YYY...', 'Y.YZZZY.Y', '.YZZZZZY.', 'YYZZZZZYY', '.YZZZZZY.', 'Y.YZZZY.Y', '...YYY...', '..Y.Y.Y..'],
  rain: ['...SSS...', '..SWWWS..', '.SWWWWWSS', 'SWWWWWWWS', 'SSSSSSSSS', '.c..c..c.', 'c..c..c..', '..c..c..c', '.c..c..c.'],
  moon: ['...ZZZ...', '..ZZZ....', '.ZZZ.....', '.ZZZ.....', '.ZZZ.....', '.ZZZZ...Z', '..ZZZZZZ.', '...ZZZZ..', '.........'],
};

export class UI {
  constructor(app) {
    this.app = app;
    this.root = $('#ui');
    this.modalName = null;
    this.dialogState = null;
    this.held = null;
    this.nameTimer = 0;
    this.weatherIcons = {};
    this.coinURL = ART.icons.coin.img.toDataURL();
    this.trophyURL = sprite(['..YYYYY..', 'yyYZYYYyy', 'y.YZYYY.y', '.y.YYY.y.', '....Y....', '...yYy...', '..yyyyy..'], { outlineStrength: 0.6 }).img.toDataURL();
    for (const [k, rows] of Object.entries(WEATHER_ICONS)) this.weatherIcons[k] = sprite(rows, { outlineStrength: 0.5 }).img.toDataURL();
    this.build();
    this.bindKeys();
    this.installCursor();
    this.applyScale();
    addEventListener('resize', () => this.applyScale());
  }

  get game() { return this.app.game; }

  /** Pixel-art hand cursor for the DOM UI (the world draws its own animated cursor). */
  installCursor() {
    const mk = (spr, hx, hy) => {
      const S = 2, c = makeCanvas(spr.img.width * S, spr.img.height * S);
      const x = c.getContext('2d');
      x.imageSmoothingEnabled = false;
      x.drawImage(spr.img, 0, 0, c.width, c.height);
      return `url(${c.toDataURL()}) ${hx * S} ${hy * S}`;
    };
    const st = document.createElement('style');
    st.textContent = `
      body, #ui, #ui * { cursor: ${mk(ART.cursor.open, 7, 5)}, default; }
      #ui .btn, #ui .slotbox, #ui .shoprow, #ui .swatch, #ui .modecard, #ui .check, #ui .qskip, #dialog, #ui [data-tab] { cursor: ${mk(ART.cursor.point, 4, 1)}, pointer; }
      #ui input { cursor: text; }
      #world { cursor: none; }`;
    document.head.appendChild(st);
  }

  applyScale() {
    const p = Math.max(2, Math.min(6, Math.round(innerHeight / 330)));
    const narrow = innerWidth / p < 260 ? Math.max(1.5, Math.floor((innerWidth / 260) * 2) / 2) : p;
    this.p = Math.min(p, narrow);
    document.documentElement.style.setProperty('--p', this.p + 'px');
  }

  build() {
    this.root.innerHTML = `
      <div id="vignette"></div>
      <div id="hud" class="hidden">
        <div id="clock" class="panel"></div>
        <button id="lbbtn" class="btn small" title="Leaderboard"><img class="icon" style="width:calc(var(--p)*11)"> Leaderboard</button>
        <button id="achbtn" class="btn small" title="Achievements"><img class="icon" style="width:calc(var(--p)*9)"> <span>Achievements</span></button>
        <div id="quest" class="panel hidden"></div>
        <div id="hotbar"></div>
        <div id="itemname" class="dark" style="opacity:0"></div>
      </div>
      <div id="toasts"></div>
      <div id="dialog" class="panel hidden">
        <div class="portrait slot"></div>
        <div class="body"><div class="name dark"></div><div class="text"></div><div class="more">▼</div></div>
      </div>
      <div id="title" class="hidden"></div>
      <div id="modal-root"></div>
      <img id="held" class="icon hidden">
      <div id="fade"><div class="daytext"></div></div>`;
    $('#vignette').style.pointerEvents = 'none';
    $('#lbbtn img').src = this.trophyURL;
    if (!leaderboard.enabled) $('#lbbtn').classList.add('hidden');
    $('#lbbtn').addEventListener('click', () => { audio.play('ui'); this.openLeaderboard(); });
    $('#achbtn img').src = ART.x.medals[2].img.toDataURL();
    $('#achbtn').addEventListener('click', () => { audio.play('ui'); this.openAchievements(); });
    $('#dialog').addEventListener('click', () => this.advanceDialog());
    document.getElementById('world').addEventListener('mousedown', () => { if (this.dialogState) this.advanceDialog(); });
    $('#modal-root').addEventListener('mousedown', (e) => {
      if (e.target.id === 'modal-root' && this.modalName !== 'creator') this.closeModal();
    });
    addEventListener('mousemove', (e) => {
      const held = $('#held');
      held.style.left = e.clientX + 'px';
      held.style.top = e.clientY + 'px';
    });
  }

  bindKeys() {
    addEventListener('keydown', (e) => {
      if (e.target && e.target.tagName === 'INPUT') {
        if (e.key === 'Enter' && this.modalName === 'creator') $('#startgame')?.click();
        return;
      }
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (this.dialogState) {
        if ([' ', 'e', 'Enter', 'k', 'f', 'Escape'].includes(k)) { e.preventDefault(); this.advanceDialog(); }
        return;
      }
      if (k === 'Escape' && this.modalName && this.inTitle && this.modalName !== 'creator') { this.closeModal(); return; }
      if (!this.game || this.inTitle) return;
      if (k === 'Escape') {
        e.preventDefault();
        if (this.modalName) this.closeModal();
        else this.openMenu();
        return;
      }
      if (k === 'Tab' || k === 'i' || k === 'b') {
        e.preventDefault();
        if (this.modalName === 'inventory') this.closeModal();
        else if (!this.modalName) this.openInventory();
        return;
      }
      if ((k === 'e' || k === 'k') && ['shop', 'sell'].includes(this.modalName)) this.closeModal();
    });
  }

  isPaused() {
    return !!(this.modalName || this.dialogState || this.sleeping || this.inTitle);
  }
  isDialogOpen() { return !!this.dialogState; }

  /* ------------------------------------------------------------------ */
  /* Game binding                                                        */
  /* ------------------------------------------------------------------ */

  bindGame(game) {
    game.hooks = {
      toast: (m, icon) => this.toast(m, icon),
      invChanged: () => { this.renderHotbar(); if (this.modalName === 'inventory') this.renderInventory(); },
      selectionChanged: () => this.flashItemName(),
      coinsChanged: () => this.renderClock(true),
      questChanged: () => this.renderQuest(),
      dialog: (name, lines, portrait, done) => this.dialog(name, lines, portrait, done),
      isDialogOpen: () => this.isDialogOpen(),
      isPaused: () => this.isPaused(),
      openShop: () => this.openShop(),
      openSell: () => this.openSell(),
      confirmSleep: () => this.confirmSleep(),
      confirmMeadow: () => this.confirmMeadow(),
      confirmHills: () => this.confirmHills(),
      achievement: (a, reward) => this.achievementToast(a, reward),
      newDay: () => this.onNewDay(),
      isVisible: (i) => this.app.renderer.isVisibleTile(i),
      toolbarWorldPos: () => {
        const b = $('#hotbar').getBoundingClientRect();
        return this.app.renderer.toWorld(b.x + b.width / 2, b.y + b.height / 2);
      },
    };
    $('#hud').classList.remove('hidden');
    this.renderHotbar();
    this.renderClock(true);
    this.renderQuest();
  }

  unbindGame() {
    $('#hud').classList.add('hidden');
    this.closeModal();
    this.dialogState = null;
    $('#dialog').classList.add('hidden');
  }

  update(dt) {
    if (!this.game || this.inTitle) return;
    this.clockT = (this.clockT || 0) - dt;
    if (this.clockT <= 0) { this.renderClock(); this.clockT = 0.5; }
    if (this.nameTimer > 0) {
      this.nameTimer -= dt;
      if (this.nameTimer <= 0) $('#itemname').style.opacity = 0;
    }
    const d = this.dialogState;
    if (d && d.shown < d.line.length) {
      d.acc += dt * 45;
      const before = Math.floor(d.shown);
      d.shown = Math.min(d.line.length, d.shown + Math.floor(d.acc));
      d.acc -= Math.floor(d.acc);
      if (Math.floor(d.shown) !== before) {
        $('#dialog .text').textContent = d.line.slice(0, d.shown);
        if (d.shown % 3 === 0 && d.line[d.shown - 1] !== ' ') audio.play('talk', { pitch: d.pitch });
      }
      $('#dialog .more').style.visibility = d.shown >= d.line.length ? 'visible' : 'hidden';
    }
  }

  /* ------------------------------------------------------------------ */
  /* HUD                                                                 */
  /* ------------------------------------------------------------------ */

  slotIcon(s) {
    if (!s) return '';
    const def = ITEMS[s.id];
    const variant = s.id === 'bucket' && s.water > 0 ? 'full' : null;
    const spr = ART.icons[def.icon];
    const w = spr ? spr.w : 16;
    return `<img class="icon" src="${iconURL(s.id, variant)}" style="width:calc(var(--p)*${w})">`;
  }

  slotInner(s, idx, showKey) {
    let html = this.slotIcon(s);
    if (s && isStackable(s.id) && s.n > 1) html += `<span class="n">${s.n}</span>`;
    if (s && ITEMS[s.id].capacity) {
      const f = Math.max(0, s.water / ITEMS[s.id].capacity);
      html += `<span class="meter"><i style="width:${f * 100}%"></i></span>`;
    }
    if (showKey) html += `<span class="key">${(idx + 1) % 10}</span>`;
    return html;
  }

  renderHotbar() {
    const g = this.game;
    if (!g) return;
    const bar = $('#hotbar');
    if (!bar.children.length) {
      const hand = h(`<div class="slotbox slot handslot" title="Hand (Q)"><img class="icon" src="${ART.cursor.open.img.toDataURL()}" style="width:calc(var(--p)*16)"><span class="key">Q</span></div>`);
      hand.addEventListener('pointerdown', (e) => { e.stopPropagation(); this.game.select(HAND); });
      hand.addEventListener('mouseenter', () => this.flashItemName(HAND));
      bar.appendChild(hand);
      for (let i = 0; i < 10; i++) {
        const el = h(`<div class="slotbox slot" data-i="${i}"></div>`);
        el.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); this.slotDragStart(i, e); });
        el.addEventListener('mouseenter', () => this.flashItemName(i));
        bar.appendChild(el);
      }
      const bag = h(`<div class="slotbox slot bagslot" title="Backpack (Tab)"><img class="icon" src="${ART.cursor.basket.img.toDataURL()}" style="width:calc(var(--p)*18)"><span class="key">Tab</span></div>`);
      bag.addEventListener('pointerdown', (e) => { e.stopPropagation(); audio.play('ui'); this.openInventory(); });
      bar.appendChild(bag);
    }
    bar.children[0].classList.toggle('sel', g.sel === HAND);
    for (let i = 0; i < 10; i++) {
      const el = bar.children[i + 1];
      el.classList.toggle('sel', i === g.sel);
      const html = this.slotInner(g.inv[i], i, true);
      if (el._html !== html) { el.innerHTML = html; el._html = html; }
    }
  }

  /** Toolbar slots: click to pick the item, or drag it into the world (e.g. onto the Shipping Bin). */
  slotDragStart(i, e) {
    const g = this.game;
    const sx = e.clientX, sy = e.clientY;
    let dragging = false;
    const move = (ev) => {
      if (!dragging && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 6 && g.inv[i]) {
        dragging = true;
        this.held = { slot: g.inv[i], from: i, preview: true };
        this.updateHeld();
        audio.play('pickup');
      }
    };
    const up = (ev) => {
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', up);
      if (!dragging) { g.select(g.sel === i ? HAND : i); return; }
      this.held = null;
      this.updateHeld();
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const slotEl = el && el.closest && el.closest('#hotbar .slotbox[data-i]');
      if (slotEl) {
        const j = Number(slotEl.dataset.i);
        if (j !== i) {
          [g.inv[i], g.inv[j]] = [g.inv[j], g.inv[i]];
          if (g.sel === i) g.sel = j; else if (g.sel === j) g.sel = i;
          audio.play('drop');
          this.renderHotbar();
        }
        return;
      }
      if (el && el.id === 'world' && !this.isPaused()) g.dropSlotAt(i, ev.clientX, ev.clientY);
    };
    addEventListener('pointermove', move);
    addEventListener('pointerup', up);
  }

  flashItemName(i = this.game.sel) {
    const el = $('#itemname');
    if (i === HAND) {
      el.textContent = 'Hand · pick, pull, open & move things';
      el.style.opacity = 1;
      this.nameTimer = 1.8;
      return;
    }
    const s = this.game.inv[i];
    if (!s) { el.style.opacity = 0; return; }
    const def = ITEMS[s.id];
    let extra = '';
    if (def.capacity) extra = ` · ${s.water}/${def.capacity}`;
    el.textContent = def.name + extra;
    el.style.opacity = 1;
    this.nameTimer = 1.8;
  }

  renderClock(force) {
    const g = this.game;
    if (!g) return;
    const hr = g.hour;
    const night = hr >= 20 || hr < 5.5;
    const rain = g.weather.rain;
    const icon = rain ? 'rain' : night ? 'moon' : 'sun';
    const wtxt = rain ? 'Rainy' : night ? 'Clear night' : 'Sunny';
    const coins = g.sandbox ? '∞' : fmt(g.coins);
    const key = `${g.day}|${formatTime(g.minuteOfDay)}|${icon}|${coins}`;
    if (!force && key === this._clockKey) return;
    this._clockKey = key;
    $('#clock').innerHTML = `
      <div class="row"><span class="day">Day ${g.day}</span><span class="time">${formatTime(g.minuteOfDay)}</span></div>
      <div class="row"><img class="icon" src="${this.weatherIcons[icon]}" style="width:calc(var(--p)*11)"><span class="weather">${wtxt}${g.weather.tomorrow && hr > 12 ? ' · rain tomorrow' : ''}</span></div>
      <div class="sep"></div>
      <div class="row"><img class="icon" src="${this.coinURL}" style="width:calc(var(--p)*14)"><span class="coins num">${coins}</span></div>`;
  }

  renderQuest() {
    const g = this.game;
    const el = $('#quest');
    const s = g && g.tutorial.current;
    if (!s || !s.objective || !g.tutorial.talked) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    const prog = Math.min(g.tutorial.progress, s.count);
    const key = s.id + prog;
    el.innerHTML = `
      <div class="qtitle">Granny's lesson</div>
      <div class="qtext">${esc(s.objective)}</div>
      ${s.count > 1 ? `<div class="qprog"><i style="width:calc(${(prog / s.count) * 100}% - var(--p) * 2)"></i></div>` : ''}
      <div class="qskip">Skip tutorial</div>`;
    $('.qskip', el).addEventListener('click', () => {
      this.confirm('Skip the tutorial?', 'Granny will hand you all her gifts right away.', 'Skip', () => g.tutorial.skip());
    });
    if (this._questKey !== key) {
      el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
      this._questKey = key;
    }
  }

  toast(msg, iconId) {
    const box = $('#toasts');
    const icon = iconId && ITEMS[iconId] ? `<img class="icon" src="${iconURL(iconId)}" style="width:calc(var(--p)*14)">` : '';
    const el = h(`<div class="toast paper">${icon}<span>${esc(msg)}</span></div>`);
    box.appendChild(el);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 500); }, 2800);
  }

  onNewDay() {
    const g = this.game;
    this.renderClock(true);
    if (!this.sleeping) this.toast(g.weather.rain ? `Day ${g.day} — it's raining! Your crops get watered for free.` : `Good morning! Day ${g.day} begins.`);
  }

  /* ------------------------------------------------------------------ */
  /* Dialog                                                              */
  /* ------------------------------------------------------------------ */

  dialog(name, lines, portrait, done) {
    const el = $('#dialog');
    el.classList.remove('hidden');
    $('.name', el).textContent = name;
    const pbox = $('.portrait', el);
    pbox.innerHTML = '';
    pbox.style.display = portrait ? '' : 'none';
    if (portrait) {
      const spr = portrait === 'granny' ? ART.granny.idle : ART.merchant.down[0];
      const c = makeCanvas(spr.w, 16);
      drawSprite(c.getContext('2d'), spr, spr.pad, spr.pad);
      pbox.appendChild(c);
    }
    this.dialogState = { lines, i: 0, line: lines[0], shown: 0, acc: 0, done, pitch: portrait === 'granny' ? 420 : 520 };
    $('.text', el).textContent = '';
    audio.play('open');
  }

  advanceDialog() {
    const d = this.dialogState;
    if (!d) return;
    if (d.shown < d.line.length) {
      d.shown = d.line.length;
      $('#dialog .text').textContent = d.line;
      return;
    }
    d.i++;
    if (d.i >= d.lines.length) {
      this.dialogState = null;
      this.app.input.consume();
      $('#dialog').classList.add('hidden');
      audio.play('ui');
      d.done?.();
      return;
    }
    d.line = d.lines[d.i];
    d.shown = 0;
    d.acc = 0;
    $('#dialog .text').textContent = '';
    audio.play('ui');
  }

  /* ------------------------------------------------------------------ */
  /* Modals                                                              */
  /* ------------------------------------------------------------------ */

  openModal(name, el) {
    this.closeModal(true);
    this.modalName = name;
    const root = $('#modal-root');
    root.innerHTML = '';
    root.appendChild(el);
    const close = el.querySelector('.close');
    if (close) close.addEventListener('click', () => this.closeModal());
    audio.play('open');
  }

  closeModal(silent) {
    if (!this.modalName) return;
    if (this.held) this.dropHeld();
    const name = this.modalName;
    this.modalName = null;
    this.app.input.consume();
    $('#modal-root').innerHTML = '';
    if (!silent) audio.play('close');
    if (name === 'inventory') this.renderHotbar();
    if (name === 'shop') this.game?.flushOrder();
    this.onModalClosed?.(name);
  }

  confirm(title, text, yes, onYes, no = 'Cancel') {
    const prev = this.modalName;
    const el = h(`<div class="modal panel" style="width:calc(var(--p)*170)">
      <h2>${esc(title)}</h2>
      <div style="font-size:calc(var(--p)*7.5);line-height:1.25">${esc(text)}</div>
      <div style="display:flex;gap:calc(var(--p)*3);margin-top:calc(var(--p)*6);justify-content:flex-end">
        <button class="btn no" style="height:calc(var(--p)*16)">${esc(no)}</button>
        <button class="btn yes" style="height:calc(var(--p)*16)">${esc(yes)}</button>
      </div></div>`);
    this.openModal('confirm', el);
    $('.no', el).addEventListener('click', () => { this.closeModal(); if (prev === 'menu') this.openMenu(); });
    $('.yes', el).addEventListener('click', () => { this.closeModal(true); onYes(); });
  }

  /* ---------------------------- inventory ---------------------------- */

  openInventory() {
    const g = this.game;
    const el = h(`<div class="modal panel">
      <button class="btn close">✕</button>
      <h2>Backpack <span class="sub"></span></h2>
      <div class="invgrid"></div>
      <div class="invinfo paper"><span style="color:var(--ink-soft)">Hover over an item to see what it does.</span></div>
      <div class="hint">Click to pick up &amp; swap · Shift-click to move between hotbar and bag · Tab to close</div>
    </div>`);
    this.openModal('inventory', el);
    this.renderInventory();
    void g;
  }

  renderInventory() {
    const g = this.game;
    const root = $('#modal-root .invgrid');
    if (!root) return;
    $('#modal-root h2 .sub').innerHTML = this.coinsHTML(g.sandbox ? '∞' : g.coins, 12);
    root.innerHTML = '';
    for (let i = 0; i < g.inv.length; i++) {
      if (i === 10) root.appendChild(h('<div class="rowsep"></div>'));
      const s = g.inv[i];
      const el = h(`<div class="slotbox slot ${i === g.sel ? 'sel' : ''}">${this.slotInner(s, i, i < 10)}</div>`);
      el.addEventListener('mousedown', (e) => { e.preventDefault(); this.clickSlot(i, e.shiftKey); });
      el.addEventListener('mouseenter', () => this.showInfo(g.inv[i]));
      root.appendChild(el);
    }
  }

  showInfo(s) {
    const box = $('#modal-root .invinfo');
    if (!box) return;
    if (!s) { box.innerHTML = '<span style="color:var(--ink-soft)">Empty slot.</span>'; return; }
    const def = ITEMS[s.id];
    let extra = '';
    if (def.capacity) extra = ` · ${s.water}/${def.capacity} water`;
    if (def.kind === 'produce') extra = ` · sells for ${def.sell}c each`;
    box.innerHTML = `<b>${esc(def.name)}</b><span style="color:var(--ink-soft)">${extra}</span><div class="d">${esc(def.desc)}</div>`;
  }

  clickSlot(i, shift) {
    const g = this.game;
    const inv = g.inv;
    audio.play('select');
    if (shift && !this.held && inv[i]) {
      // quick-move between hotbar and bag
      const s = inv[i];
      const range = i < 10 ? [10, inv.length] : [0, 10];
      if (isStackable(s.id)) {
        for (let j = range[0]; j < range[1] && s.n > 0; j++) {
          const t = inv[j];
          if (t && t.id === s.id && t.n < STACK_MAX) { const m = Math.min(s.n, STACK_MAX - t.n); t.n += m; s.n -= m; }
        }
      }
      if (s.n > 0) {
        for (let j = range[0]; j < range[1]; j++) if (!inv[j]) { inv[j] = s; inv[i] = null; break; }
      } else inv[i] = null;
      this.renderInventory(); this.renderHotbar();
      return;
    }
    if (!this.held) {
      if (!inv[i]) return;
      this.held = { slot: inv[i], from: i };
      inv[i] = null;
    } else {
      const cur = inv[i];
      const hs = this.held.slot;
      if (cur && cur.id === hs.id && isStackable(hs.id)) {
        const m = Math.min(hs.n, STACK_MAX - cur.n);
        cur.n += m; hs.n -= m;
        if (hs.n <= 0) this.held = null;
      } else {
        inv[i] = hs;
        this.held = cur ? { slot: cur, from: i } : null;
      }
    }
    this.updateHeld();
    this.renderInventory();
    this.renderHotbar();
    this.showInfo(inv[i]);
  }

  updateHeld() {
    const el = $('#held');
    if (!this.held) { el.classList.add('hidden'); return; }
    const s = this.held.slot;
    el.src = iconURL(s.id, s.id === 'bucket' && s.water > 0 ? 'full' : null);
    el.style.width = `calc(var(--p)*${ART.icons[ITEMS[s.id].icon]?.w || 16})`;
    el.classList.remove('hidden');
  }

  dropHeld() {
    const g = this.game;
    if (this.held.preview) { this.held = null; this.updateHeld(); return; }
    const s = this.held.slot;
    if (!g.inv[this.held.from]) g.inv[this.held.from] = s;
    else {
      const j = g.inv.indexOf(null);
      if (j >= 0) g.inv[j] = s;
      else g.addItem(s.id, s.n);
    }
    this.held = null;
    this.updateHeld();
    this.renderHotbar();
  }

  /* ---------------------------- shop ---------------------------- */

  openShop(tab = this.shopTab || 'seeds') {
    const tabs = [['seeds', 'Seeds'], ['goods', 'Garden'], ['decor', 'Decor'], ['land', 'Land']];
    if (!tabs.some(([k]) => k === tab)) tab = 'seeds';
    const el = h(`<div class="modal panel">
      <button class="btn close">✕</button>
      <h2>Basil's Market <span class="sub"></span></h2>
      <div class="tabs">${tabs.map(([k, n]) => `<button class="btn small ${tab === k ? 'on' : ''}" data-tab="${k}" style="height:calc(var(--p)*14)">${n}</button>`).join('')}</div>
      <div class="scroll" style="max-height:60vh"><div class="shoplist"></div></div>
      <div class="hint">Type how many you want, or press Max · Basil delivers everything in a crate when you close the shop</div>
    </div>`);
    this.openModal('shop', el);
    this.shopTab = tab;
    this.shopQty ||= {};
    el.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => {
      this.shopTab = b.dataset.tab;
      el.querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('on', x === b));
      audio.play('ui');
      this.renderShop();
      $('#modal-root .scroll').scrollTop = 0;
    }));
    this.renderShop();
  }

  coinsHTML(n, w = 11) {
    return `<img class="icon" src="${this.coinURL}" style="width:calc(var(--p)*${w})"><span class="num">${typeof n === 'number' ? fmt(n) : n}</span>`;
  }

  renderShop() {
    const g = this.game;
    const list = $('#modal-root .shoplist');
    if (!list) return;
    const scroll = $('#modal-root .scroll');
    const keepScroll = scroll ? scroll.scrollTop : 0;
    $('#modal-root h2 .sub').innerHTML = this.coinsHTML(g.sandbox ? '∞' : g.coins, 12);
    list.innerHTML = '';
    if (this.shopTab === 'land') { this.renderLand(list); return; }
    let ids = this.shopTab === 'seeds' ? SHOP_SEEDS : this.shopTab === 'decor' ? SHOP_DECOR : SHOP_GOODS;
    if (this.shopTab === 'seeds') {
      // search + category filter for the 156 seeds
      const bar = h(`<div class="seedbar"><input type="text" class="search" placeholder="Search seeds..." spellcheck="false" value="${esc(this.seedSearch || '')}">
        ${[['all', 'All'], ['veg', 'Veggies'], ['fruit', 'Fruit'], ['flower', 'Flowers'], ['herb', 'Herbs'], ['magic', 'Magical']].map(([k, n]) => `<button class="btn small chip ${(this.seedCat || 'all') === k ? 'on' : ''}" data-cat="${k}">${n}</button>`).join('')}</div>`);
      list.appendChild(bar);
      const inp = $('.search', bar);
      inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') this.closeModal(); });
      inp.addEventListener('input', () => { this.seedSearch = inp.value; this.renderShop(); const n = $('#modal-root .search'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } });
      bar.querySelectorAll('[data-cat]').forEach((b) => b.addEventListener('click', () => { this.seedCat = b.dataset.cat; audio.play('select'); this.renderShop(); }));
      const q = (this.seedSearch || '').trim().toLowerCase();
      const cat = this.seedCat || 'all';
      ids = ids.filter((id) => {
        const c = CROPS[ITEMS[id].crop];
        return (cat === 'all' || c.cat === cat) && (!q || ITEMS[id].name.toLowerCase().includes(q));
      });
      if (!ids.length) list.appendChild(h('<div class="lbmsg">No seeds match that search.</div>'));
    }
    for (const id of ids) {
      const def = ITEMS[id];
      const owned = g.count(id);
      const isTool = def.kind === 'tool';
      const cant = !g.sandbox && def.price > g.coins;
      let desc = def.desc;
      if (def.kind === 'seed') {
        const c = CROPS[def.crop];
        desc = `${c.hours}h to grow${c.regrow ? ` · regrows every ${c.regrow}h` : ''} · sells ${fmt(c.sell)}c${c.yield ? ' ×' + c.yield : ''}`;

      }
      const qty = this.shopQty[id] || 1;
      const row = h(`<div class="shoprow paper ${cant ? 'cant' : ''}">
        <div class="iconbox slot">${this.slotIcon({ id })}</div>
        <div class="info"><div class="nm">${esc(def.name)}${def.kind === 'seed' && CROPS[def.crop].big ? ' <span class="tag new">new</span>' : ''}${id === 'seed_celestiallotus' ? ' <span class="tag best">best</span>' : ''}${def.kind === 'seed' && CROPS[def.crop].glow ? ' <span class="tag">glows</span>' : ''}</div><div class="ds">${esc(desc)}</div>
          <div class="own">${isTool ? (owned ? 'Owned' : '') : owned ? 'You have ' + fmt(owned) : ''}</div></div>
        <div class="price">${g.sandbox ? 'Free' : this.coinsHTML(def.price)}${isTool || g.sandbox ? '' : '<span class="each">each</span>'}</div>
        <div class="buybox">
          ${isTool ? '' : `<div class="qty"><button class="btn small minus">−</button><input type="number" min="1" max="9999" value="${qty}"><button class="btn small plus">+</button></div>
          <button class="btn small max">Max</button>`}
          <button class="btn small buy"></button>
        </div>
      </div>`);
      const inp = $('input', row);
      const buyBtn = $('.buy', row);
      const getQty = () => (isTool ? 1 : Math.max(1, Math.min(9999, Math.floor(Number(inp.value) || 1))));
      const sync = () => {
        const n = getQty();
        if (!isTool) this.shopQty[id] = n;
        const total = def.price * n;
        buyBtn.innerHTML = g.sandbox ? 'Get' : `Buy · ${fmt(total)}`;
        buyBtn.disabled = !g.sandbox && total > g.coins;
      };
      sync();
      if (inp) {
        inp.addEventListener('input', sync);
        inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') buyBtn.click(); if (e.key === 'Escape') this.closeModal(); });
        inp.addEventListener('focus', () => inp.select());
        $('.minus', row).addEventListener('click', () => { inp.value = Math.max(1, getQty() - 1); sync(); audio.play('select'); });
        $('.plus', row).addEventListener('click', () => { inp.value = Math.min(9999, getQty() + 1); sync(); audio.play('select'); });
        $('.max', row).addEventListener('click', () => {
          inp.value = g.sandbox ? 999 : Math.max(1, Math.min(9999, Math.floor(g.coins / def.price)));
          sync(); audio.play('select');
        });
      }
      buyBtn.addEventListener('click', () => {
        const n = getQty();
        if (g.buy(id, n)) {
          row.animate([{ transform: 'scale(0.98)' }, { transform: 'scale(1)' }], { duration: 150 });
          this.toast(`Ordered ${n > 1 ? fmt(n) + '× ' : ''}${def.name}`, id);
        }
        this.renderShop();
        this.renderClock(true);
      });
      list.appendChild(row);
    }
    if (scroll) scroll.scrollTop = keepScroll;
  }

  renderLand(list) {
    const g = this.game;
    const owned = g.meadowOwned;
    const price = MEADOW_PRICE;
    const row = h(`<div class="shoprow paper land ${!owned && !g.sandbox && g.coins < price ? 'cant' : ''}">
      <div class="iconbox slot"><img class="icon" src="${this.meadowIcon()}" style="width:calc(var(--p)*18)"></div>
      <div class="info"><div class="nm">Riverside Meadow</div>
        <div class="ds">A whole second garden plot past the trees south of your garden: a big open meadow with its own stream,
        fish, and a second Shipping Bin. Lots of room to grow.</div></div>
      <div class="price">${owned ? 'Yours!' : g.sandbox ? 'Free' : this.coinsHTML(price)}</div>
      <div class="buybox"><button class="btn small buy">${owned ? 'Visit' : 'Buy land'}</button></div>
    </div>`);
    const btn = $('.buy', row);
    if (!owned && !g.sandbox && g.coins < price) btn.disabled = true;
    btn.addEventListener('click', () => {
      if (owned) { this.closeModal(); g.visitMeadow(); return; }
      this.confirm('Buy the Riverside Meadow?', `This costs ${fmt(price)} coins. The gate opens right away.`, 'Buy it!', () => {
        if (g.buyMeadow()) this.renderClock(true);
      }, 'Not yet');
    });
    list.appendChild(row);
    const hOwned = g.hillsOwned;
    const cant2 = !hOwned && (!owned || (!g.sandbox && g.coins < HILLS_PRICE));
    const row2 = h(`<div class="shoprow paper land ${cant2 ? 'cant' : ''}">
      <div class="iconbox slot"><img class="icon" src="${ART.wishwell.img.toDataURL()}" style="width:calc(var(--p)*16)"></div>
      <div class="info"><div class="nm">Blossom Hills</div>
        <div class="ds">The biggest plot yet, south of the meadow: rolling flower fields, a pond with golden koi, a windmill and a
        magical Wishing Well. ${owned ? '' : '(Buy the Riverside Meadow first.)'}</div></div>
      <div class="price">${hOwned ? 'Yours!' : g.sandbox ? 'Free' : this.coinsHTML(HILLS_PRICE)}</div>
      <div class="buybox"><button class="btn small buy">${hOwned ? 'Visit' : 'Buy land'}</button></div>
    </div>`);
    const b2 = $('.buy', row2);
    if (cant2) b2.disabled = true;
    b2.addEventListener('click', () => {
      if (hOwned) { this.closeModal(); g.visitHills(); return; }
      this.confirm('Buy Blossom Hills?', `This costs ${fmt(HILLS_PRICE)} coins. The second gate opens right away.`, 'Buy it!', () => {
        if (g.buyHills()) this.renderClock(true);
      }, 'Not yet');
    });
    list.appendChild(row2);
  }

  confirmHills() {
    const g = this.game;
    if (g.hillsOwned) { g.visitHills(); return; }
    if (!g.sandbox && g.coins < HILLS_PRICE) {
      this.confirm('Blossom Hills', `Rolling flower fields, golden koi and a Wishing Well are waiting past this gate! It costs ${fmt(HILLS_PRICE)} coins and you have ${fmt(g.coins)}.`, 'Show me seeds', () => this.openShop('seeds'), 'Okay');
      return;
    }
    this.confirm('Buy Blossom Hills?', `The biggest plot of all, for ${g.sandbox ? 'free (sandbox)' : fmt(HILLS_PRICE) + ' coins'}.`, 'Buy it!', () => { if (g.buyHills()) this.renderClock(true); }, 'Not yet');
  }

  /* ---------------------------- achievements ---------------------------- */

  openAchievements(back) {
    const g = this.game;
    const tr = g.ach;
    tr.cacheDirty = true;
    const rows = ACHIEVEMENTS.map((a) => {
      const p = tr.progress(a);
      const pct = p.target ? Math.min(100, (p.v / p.target) * 100) : 0;
      const showNum = p.target > 1;
      return `<div class="achrow paper ${p.done ? 'done' : ''}">
        <img class="icon medal" src="${ART.x.medals[a.tier].img.toDataURL()}" style="width:calc(var(--p)*12)">
        <div class="info"><div class="nm">${esc(a.name)}${p.done ? ' <span class="tag new">unlocked</span>' : ''}</div><div class="ds">${esc(a.desc)}</div>
          ${p.done ? '' : `<div class="achbar"><i style="width:${pct}%"></i></div>`}</div>
        <div class="achval">${showNum ? `<span class="num">${fmt(p.v)}</span><span class="of">/ ${fmt(p.target)}</span>` : p.done ? '✓' : ''}
          <span class="rw">${g.sandbox ? '' : '+' + fmt(TIERS[a.tier].reward) + 'c'}</span></div>
      </div>`;
    });
    let html = '';
    ACHIEVEMENTS.forEach((a, k) => {
      if (k === 0 || ACHIEVEMENTS[k - 1].tier !== a.tier) html += `<div class="achtier t${a.tier}">${TIERS[a.tier].name}</div>`;
      html += rows[k];
    });
    const el = h(`<div class="modal panel" style="width:min(calc(var(--p)*230), 94vw)">
      <button class="btn close">✕</button>
      <h2><img class="icon" src="${ART.x.medals[2].img.toDataURL()}" style="width:calc(var(--p)*13)"> Achievements <span class="sub"><span class="num">${tr.count} / ${ACHIEVEMENTS.length}</span></span></h2>
      <div class="hint" style="margin:0 0 calc(var(--p)*3)">Easiest at the top, toughest at the bottom. Rewards are paid automatically.</div>
      <div class="scroll achlist" style="max-height:66vh">${html}</div>
    </div>`);
    this.openModal('achievements', el);
    this.onModalClosed = (name) => { this.onModalClosed = null; if (name === 'achievements' && back) back(); };
  }

  achievementToast(a, reward) {
    const box = $('#toasts');
    const el = h(`<div class="toast achtoast panel"><img class="icon" src="${ART.x.medals[a.tier].img.toDataURL()}" style="width:calc(var(--p)*14)">
      <div><div class="at1">Achievement unlocked!</div><div class="at2">${esc(a.name)}</div>${reward ? `<div class="at3">+${fmt(reward)} coins</div>` : ''}</div></div>`);
    box.prepend(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 500); }, 4500);
    this.renderClock(true);
  }

  meadowIcon() {
    if (!this._meadowIcon) {
      const c = makeCanvas(18, 18);
      const x = c.getContext('2d');
      x.fillStyle = '#4fa64a'; x.fillRect(1, 3, 16, 14);
      x.fillStyle = '#3a7cbc'; x.fillRect(1, 12, 16, 3);
      x.fillStyle = '#8ac4f0'; x.fillRect(3, 13, 3, 1); x.fillRect(10, 12, 3, 1);
      x.fillStyle = '#7a4a30'; for (let i = 2; i < 17; i += 3) x.fillRect(i, 7, 1, 4);
      x.fillStyle = '#b07a4a'; x.fillRect(1, 8, 16, 1);
      x.fillStyle = '#f08ac0'; x.fillRect(4, 4, 1, 1); x.fillRect(13, 5, 1, 1);
      x.fillStyle = '#fff3a0'; x.fillRect(8, 4, 1, 1);
      this._meadowIcon = c.toDataURL();
    }
    return this._meadowIcon;
  }

  /* ---------------------------- shipping bin ---------------------------- */

  openSell() {
    const el = h(`<div class="modal panel">
      <button class="btn close">✕</button>
      <h2>Shipping Bin <span class="sub"></span></h2>
      <div class="scroll" style="max-height:56vh"><div class="shoplist"></div></div>
      <div style="display:flex;align-items:center;gap:calc(var(--p)*4);margin-top:calc(var(--p)*4)">
        <span class="hint" style="margin:0;flex:1">Click to sell one · Shift-click to sell the whole stack</span>
        <button class="btn sellall" style="height:calc(var(--p)*16)">Sell everything</button>
      </div>
    </div>`);
    this.openModal('sell', el);
    $('.sellall', el).addEventListener('click', () => {
      const got = this.game.sellAllProduce();
      if (got) this.toast(`Sold everything for ${fmt(got)} coins!`, 'coin');
      this.renderSell();
    });
    this.renderSell();
  }

  renderSell() {
    const g = this.game;
    const list = $('#modal-root .shoplist');
    if (!list) return;
    $('#modal-root h2 .sub').innerHTML = this.coinsHTML(g.sandbox ? '∞' : g.coins, 12);
    list.innerHTML = '';
    let total = 0;
    g.inv.forEach((s, i) => {
      if (!s || ITEMS[s.id].kind !== 'produce') return;
      const def = ITEMS[s.id];
      total += def.sell * s.n;
      const row = h(`<div class="shoprow paper">
        <div class="iconbox slot">${this.slotIcon(s)}</div>
        <div class="info"><div class="nm">${esc(def.name)} <span style="color:var(--ink-soft);font-weight:400">×${s.n}</span></div><div class="ds">${fmt(def.sell)}c each</div></div>
        <div class="price"><span class="num">+${fmt(def.sell * s.n)}</span></div>
      </div>`);
      row.addEventListener('mousedown', (e) => {
        e.preventDefault();
        g.sellSlot(i, e.shiftKey ? s.n : 1);
        this.renderSell();
        this.renderClock(true);
      });
      list.appendChild(row);
    });
    if (!total) list.appendChild(h(`<div class="paper" style="padding:calc(var(--p)*4);font-size:calc(var(--p)*7.5);color:var(--ink-soft)">Nothing to sell yet — harvest some crops and bring them here!</div>`));
    const btn = $('#modal-root .sellall');
    if (btn) { btn.disabled = !total; btn.textContent = total ? `Sell everything (+${fmt(total)})` : 'Sell everything'; }
  }

  confirmMeadow() {
    const g = this.game;
    if (g.meadowOwned) { g.visitMeadow(); return; }
    if (!g.sandbox && g.coins < MEADOW_PRICE) {
      this.confirm('Riverside Meadow', `A whole second garden plot is waiting past this gate! It costs ${fmt(MEADOW_PRICE)} coins and you have ${fmt(g.coins)}. The new seeds are the fastest way to get there.`, 'Show me seeds', () => this.openShop('seeds'), 'Okay');
      return;
    }
    this.confirm('Buy the Riverside Meadow?', `A whole second garden plot with its own stream and Shipping Bin, for ${g.sandbox ? 'free (sandbox)' : fmt(MEADOW_PRICE) + ' coins'}.`, 'Buy it!', () => { if (g.buyMeadow()) this.renderClock(true); }, 'Not yet');
  }

  openLeaderboard(back) {
    const tabs = Object.entries(STATS).map(([k, v]) => `<button class="btn small" data-stat="${k}" style="height:calc(var(--p)*14)">${v.label}</button>`).join('');
    const el = h(`<div class="modal panel" style="width:calc(var(--p)*200)">
      <button class="btn close">✕</button>
      <h2><img class="icon" src="${this.trophyURL}" style="width:calc(var(--p)*16)"> Leaderboard</h2>
      <div class="tabs">${tabs}</div>
      <div class="scroll lblist" style="max-height:52vh"></div>
      <div class="lbme paper"></div>
      <div class="hint">Every Cozy-mode garden in the world shows up here. Sandbox gardens don't count.</div>
    </div>`);
    this.openModal('leaderboard', el);
    this.onModalClosed = (name) => { this.onModalClosed = null; if (name === 'leaderboard' && back) back(); };
    this.lbStat ||= 'coins';
    const list = $('.lblist', el);
    const me = $('.lbme', el);
    if (!leaderboard.enabled) {
      list.innerHTML = `<div class="paper" style="padding:calc(var(--p)*4);font-size:calc(var(--p)*7);line-height:1.3">The global leaderboard isn't switched on for this copy of the game yet.</div>`;
      $('.tabs', el).style.display = 'none';
      me.style.display = 'none';
      return;
    }
    const g = this.game;
    me.innerHTML = g
      ? `<span class="lbl">Your name</span><input type="text" maxlength="16" spellcheck="false" value="${esc(g.name)}"><button class="btn small" data-a="name">Save</button>
         <span class="mine"></span>`
      : '<span class="lbl">Start or continue a Cozy garden to join the board.</span>';
    if (g) {
      const inp = $('input', me);
      inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') $('[data-a=name]', me).click(); if (e.key === 'Escape') this.closeModal(); });
      $('[data-a=name]', me).addEventListener('click', async () => {
        const n = inp.value.replace(/[^\p{L}\p{N} _.'!-]/gu, '').trim().slice(0, 16);
        if (!n) return;
        g.name = n;
        inp.value = n;
        audio.play('ui');
        this.app.saveNow();
        await leaderboard.submit(g, true);
        load();
      });
    }
    const load = async () => {
      el.querySelectorAll('[data-stat]').forEach((b) => b.classList.toggle('on', b.dataset.stat === this.lbStat));
      list.innerHTML = '<div class="lbmsg">Loading…</div>';
      try {
        if (g) await leaderboard.submit(g);
        const rows = await leaderboard.top(this.lbStat, 50);
        if (!document.body.contains(list)) return;
        const stat = this.lbStat;
        if (!rows.length) { list.innerHTML = '<div class="lbmsg">Nobody here yet. Be the first!</div>'; return; }
        list.innerHTML = rows.map((r, i) => `<div class="lbrow paper ${r.id === leaderboard.uid ? 'me' : ''}">
            <span class="rank r${i + 1}">${i + 1}</span>
            <span class="who">${esc(r.name || 'Gardener')}${r.meadow ? ' <span class="tag">meadow</span>' : ''}</span>
            <span class="val num">${stat === 'harvested' ? '' : `<img class="icon" src="${this.coinURL}" style="width:calc(var(--p)*10)">`}${fmt(r[stat] || 0)}</span>
          </div>`).join('');
        const mine = $('.mine', me);
        if (mine && g) {
          const idx = rows.findIndex((r) => r.id === leaderboard.uid);
          mine.textContent = g.sandbox ? 'Sandbox gardens aren\'t ranked' : idx >= 0 ? `You're #${idx + 1}!` : 'Not in the top 50 yet';
        }
      } catch {
        list.innerHTML = '<div class="lbmsg">Couldn\'t reach the leaderboard. Check your internet and try again.</div>';
      }
    };
    el.querySelectorAll('[data-stat]').forEach((b) => b.addEventListener('click', () => { this.lbStat = b.dataset.stat; audio.play('ui'); load(); }));
    load();
  }

  /* ---------------------------- sleep ---------------------------- */

  confirmSleep() {
    const g = this.game;
    const hr = g.hour;
    const early = hr >= 6 && hr < 18;
    this.confirm('Go to bed?', early ? 'It\'s still daytime, but a nap never hurt anyone. You\'ll wake up at 6:00 am tomorrow.' : 'Snuggle in and sleep until 6:00 am. Your crops keep growing while you rest.', 'Sleep', () => this.doSleep(), 'Not yet');
  }

  doSleep() {
    const g = this.game;
    const fade = $('#fade');
    this.sleeping = true;
    audio.play('sleep');
    fade.classList.add('on');
    setTimeout(() => {
      g.sleep();
      const txt = $('.daytext', fade);
      txt.textContent = `Day ${g.day}`;
      txt.classList.add('show');
      this.app.saveNow?.();
      this.renderClock(true);
      setTimeout(() => {
        txt.classList.remove('show');
        fade.classList.remove('on');
        this.sleeping = false;
        this.toast(g.weather.rain ? 'Rise and shine — it\'s a rainy day!' : 'Rise and shine! Your sprinklers have done their job.');
      }, 1500);
    }, 1000);
  }

  /* ---------------------------- menu / settings / help ---------------------------- */

  openMenu() {
    const el = h(`<div class="modal panel">
      <h2>Paused</h2>
      <div class="menu">
        <button class="btn" data-a="resume">Resume</button>
        <button class="btn" data-a="inv">Backpack</button>
        ${leaderboard.enabled ? '<button class="btn" data-a="lb">Leaderboard</button>' : ''}
        <button class="btn" data-a="settings">Settings</button>
        <button class="btn" data-a="help">How to Play</button>
        <button class="btn" data-a="ach">Achievements</button>
        <button class="btn" data-a="news">What's New</button>
        <button class="btn" data-a="save">Save Game</button>
        <button class="btn" data-a="quit">Save &amp; Quit to Title</button>
      </div></div>`);
    this.openModal('menu', el);
    el.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', () => {
      const a = b.dataset.a;
      if (a === 'resume') this.closeModal();
      if (a === 'inv') this.openInventory();
      if (a === 'news') this.openChangelog(() => this.openMenu());
      if (a === 'ach') this.openAchievements(() => this.openMenu());
      if (a === 'lb') this.openLeaderboard(() => this.openMenu());
      if (a === 'settings') this.openSettings(() => this.openMenu());
      if (a === 'help') this.openHelp(() => this.openMenu());
      if (a === 'save') { this.app.saveNow(); this.toast('Game saved.'); this.closeModal(); }
      if (a === 'quit') { this.closeModal(true); this.app.quitToTitle(); }
    }));
  }

  openSettings(back) {
    const S = this.app.settings;
    const el = h(`<div class="modal panel" style="width:calc(var(--p)*190)">
      <button class="btn close">✕</button>
      <h2>Settings</h2>
      <div class="setrow"><label>Music</label><input type="range" min="0" max="100" data-v="music"></div>
      <div class="setrow"><label>Nature sounds</label><input type="range" min="0" max="100" data-v="amb"></div>
      <div class="setrow"><label>Sound effects</label><input type="range" min="0" max="100" data-v="sfx"></div>
<div class="setrow"><label>Thirsty plant icons (when watering)</label><div class="seg" data-seg="thirsty">
        <button class="btn" data-val="true">On</button><button class="btn" data-val="false">Off</button></div></div>
      <div class="setrow"><label>Tile grid</label><div class="seg" data-seg="grid">
        <button class="btn" data-val="true">On</button><button class="btn" data-val="false">Off</button></div></div>
      <div class="setrow" style="margin-top:calc(var(--p)*4)"><label>Save file</label>
        <button class="btn small" data-a="export" style="height:calc(var(--p)*13)">Export</button>
        <button class="btn small" data-a="import" style="height:calc(var(--p)*13)">Import</button></div>
    </div>`);
    this.openModal('settings', el);
    this.onModalClosed = (name) => { this.onModalClosed = null; if (name === 'settings' && back) back(); };
    el.querySelectorAll('input[type=range]').forEach((inp) => {
      inp.value = Math.round(S[inp.dataset.v] * 100);
      inp.addEventListener('input', () => {
        S[inp.dataset.v] = inp.value / 100;
        this.app.applySettings();
      });
      inp.addEventListener('change', () => audio.play('ui'));
    });
    el.querySelectorAll('[data-seg]').forEach((seg) => {
      const key = seg.dataset.seg;
      const sync = () => seg.querySelectorAll('[data-val]').forEach((b) => b.classList.toggle('on', String(S[key]) === b.dataset.val));
      sync();
      seg.querySelectorAll('[data-val]').forEach((b) => b.addEventListener('click', () => {
        const v = b.dataset.val;
        S[key] = v === 'true' ? true : v === 'false' ? false : Number(v);
        sync();
        audio.play('ui');
        this.app.applySettings();
      }));
    });
    $('[data-a=export]', el).addEventListener('click', () => this.app.exportSave());
    $('[data-a=import]', el).addEventListener('click', () => this.app.importSave());
  }

  openHelp(back) {
    const keys = [
      ['Left click', 'Use your tool, pick crops, open crates, talk, shop'],
      ['Click + drag', 'Sweep a tool across many tiles · move things with the hand'],
      ['Right-drag / WASD', 'Look around (drag with the hand works too)'],
      ['Right click', 'Put the tool away (back to the hand)'],
      ['Scroll / + −', 'Zoom in and out'],
      ['1 – 0 · Q', 'Pick a toolbar slot · the hand'],
      ['Tab', 'Backpack'],
      ['Esc', 'Pause menu'],
    ];
    const el = h(`<div class="modal panel" style="width:calc(var(--p)*220)">
      <button class="btn close">✕</button>
      <h2>How to Play</h2>
      <div class="scroll" style="max-height:70vh">
      <div class="keys">${keys.map(([k, v]) => `<span class="k dark">${k}</span><span>${v}</span>`).join('')}</div>
      <div class="paper" style="margin-top:calc(var(--p)*5);padding:calc(var(--p)*3);font-size:calc(var(--p)*6.5);line-height:1.3">
        <b>Your hand:</b> there's no one to walk around — the cursor <i>is</i> you. With the bare hand you can
        open crates, pull weeds, pick crops, and drag anything you've placed to a new spot.<br><br>
        <b>Growing:</b> till grass with the Hoe, plant seeds, then keep the soil wet. Crops only grow while their soil is
        damp (dark). Watered soil dries out after about a day.<br><br>
        <b>Water:</b> the Watering Can soaks one tile, the Bucket soaks 3×3. Refill both at the pond or the well.
        Sprinklers water their area every morning at 6:00, and rain waters everything.<br><br>
        <b>Extras:</b> catch fish with the Fishing Net, collect honey from beehives, pick fruit from your trees,
        check the mailbox by the cottage every morning, make a wish at the Wishing Well in Blossom Hills, and pet Mochi.
        Open <b>Achievements</b> (top left) to see everything there is to do.<br><br>
        <b>Coins:</b> drag crops from your toolbar onto the Shipping Bin (or click it) to sell them, then spend
        your coins at Basil's market stall. Orders arrive in a crate.<br><br>
        <b>Time:</b> a full day takes about 8 minutes. Click the cottage to sleep until morning.
      </div></div>
    </div>`);
    this.openModal('help', el);
    this.onModalClosed = (name) => { this.onModalClosed = null; if (name === 'help' && back) back(); };
  }

  /* ------------------------------------------------------------------ */
  /* Title & character creator                                           */
  /* ------------------------------------------------------------------ */

  showTitle(saveMeta) {
    this.inTitle = true;
    const t = $('#title');
    t.classList.remove('hidden');
    const sprout = ART.crops.carrot.stages[3].img.toDataURL();
    t.innerHTML = `
      <div class="logo">
        <div class="l1"><img class="icon sprout" src="${sprout}" style="width:calc(var(--p)*24);display:inline-block">Dewdrop Garden</div>
        <div class="l2">a cozy little garden to call your own</div>
      </div>
      ${saveMeta ? `<button class="btn" data-a="continue">Continue <span style="font-weight:400;font-size:calc(var(--p)*6)">· Day ${saveMeta.day} · ${esc(saveMeta.name)}</span></button>` : ''}
      <button class="btn" data-a="new">New Garden</button>
      ${leaderboard.enabled ? '<button class="btn" data-a="lb">Leaderboard</button>' : ''}
      <button class="btn" data-a="import">Import Save</button>
      <button class="btn" data-a="settings">Settings</button>
      <button class="btn" data-a="help">How to Play</button>
      <button class="btn" data-a="news">What's New in v${CHANGELOG[0].version}</button>
      <div class="newspanel panel">${this.changelogHTML(1)}</div>
      <div class="foot">v${VERSION} · click anywhere to wake the birds</div>`;
    t.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', () => {
      audio.init();
      audio.play('ui');
      const a = b.dataset.a;
      if (a === 'continue') this.app.continueGame();
      if (a === 'new') {
        if (saveMeta) this.confirm('Start a new garden?', 'This will replace your current save (you can export it first in Settings).', 'Start fresh', () => this.openCreator());
        else this.openCreator();
      }
      if (a === 'import') this.app.importSave();
      if (a === 'lb') this.openLeaderboard();
      if (a === 'settings') this.openSettings();
      if (a === 'help') this.openHelp();
      if (a === 'news') this.openChangelog();
    }));
  }

  changelogHTML(count = CHANGELOG.length) {
    const list = (items, cls) => items.map((x) => `<li class="${cls}">${esc(x)}</li>`).join('');
    return CHANGELOG.slice(0, count).map((v, i) => `
      <div class="cl-ver">
        <div class="cl-head"><span class="cl-v">v${esc(v.version)}</span><span class="cl-t">${esc(v.title)}</span>${i === 0 ? '<span class="tag new">latest</span>' : ''}</div>
        ${v.added.length ? `<div class="cl-sub">Added</div><ul>${list(v.added, 'add')}</ul>` : ''}
        ${v.fixed.length ? `<div class="cl-sub">Fixed</div><ul>${list(v.fixed, 'fix')}</ul>` : ''}
      </div>`).join('');
  }

  openChangelog(back) {
    const el = h(`<div class="modal panel" style="width:min(calc(var(--p)*210), 94vw)">
      <button class="btn close">✕</button>
      <h2>Update Log</h2>
      <div class="scroll changelog" style="max-height:70vh">${this.changelogHTML()}</div>
    </div>`);
    this.openModal('news', el);
    this.onModalClosed = (name) => { this.onModalClosed = null; if (name === 'news' && back) back(); };
  }

  hideTitle() {
    this.inTitle = false;
    $('#title').classList.add('hidden');
  }

  openCreator() {
    const state = { mode: 'cozy', tutorial: true };
    const el = h(`<div class="modal panel" style="width:calc(var(--p)*200)">
      <h2>A New Garden</h2>
      <div class="creator-fields">
        <div><div class="lbl">What should Granny call you?</div><input type="text" maxlength="16" value="Sprout" spellcheck="false"></div>
        <div><div class="lbl">Mode</div><div class="modecards">
          <div class="modecard paper slot sel" data-mode="cozy"><b>Cozy</b>Start with 150 coins. Grow, sell and save up for nicer things.</div>
          <div class="modecard paper slot" data-mode="sandbox"><b>Sandbox</b>Everything in the shop is free. Just build and relax.</div>
        </div></div>
        <div class="check on" data-tut><span class="box"></span>Let Granny show me around (tutorial)</div>
      </div>
      <div style="display:flex;gap:calc(var(--p)*3);justify-content:flex-end;margin-top:calc(var(--p)*5)">
        <button class="btn" data-a="back" style="height:calc(var(--p)*16)">Back</button>
        <button class="btn" id="startgame" style="height:calc(var(--p)*16)">Start growing!</button>
      </div></div>`);
    this.openModal('creator', el);
    el.querySelectorAll('.modecard').forEach((c) => c.addEventListener('click', () => {
      state.mode = c.dataset.mode;
      el.querySelectorAll('.modecard').forEach((x) => x.classList.toggle('sel', x === c));
      audio.play('select');
    }));
    const tut = $('[data-tut]', el);
    tut.addEventListener('click', () => { state.tutorial = !state.tutorial; tut.classList.toggle('on', state.tutorial); audio.play('select'); });
    $('[data-a=back]', el).addEventListener('click', () => this.closeModal());
    $('#startgame', el).addEventListener('click', () => {
      const name = $('input', el).value.trim() || 'Sprout';
      this.closeModal(true);
      this.app.startNewGame({ name, mode: state.mode, tutorial: state.tutorial });
    });
    setTimeout(() => $('input', el)?.focus(), 50);
  }
}
