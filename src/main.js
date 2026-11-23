// Entry point: boots art, renderer, UI and runs the main loop.
import { buildArt, ART } from './art/index.js';
import { installFrames } from './ui/frames.js';
import { Renderer } from './game/render.js';
import { Game } from './game/game.js';
import { Input } from './core/input.js';
import { audio } from './core/audio.js';
import { UI } from './ui/ui.js';
import { leaderboard } from './game/leaderboard.js';
import { LAYOUT } from './game/world.js';
import { readSave, saveMeta, writeSave, writeRawSave, downloadSave, pickSaveFile, loadSettings, storeSettings } from './game/save.js';
import { TILE, G_SOIL } from './config.js';
import { CROP_IDS, CROPS } from './data/crops.js';
import { makeRng } from './core/util.js';

const DEBUG = new URLSearchParams(location.search).has('debug');

async function boot() {
  try { await Promise.all([document.fonts.load('16px Pixelify'), document.fonts.load('600 16px Pixelify')]); } catch { /* ignore */ }
  buildArt();
  installFrames();
  setFavicon();

  const canvas = document.getElementById('world');
  const overlay = document.getElementById('overlay');
  const settings = loadSettings();
  const renderer = new Renderer(canvas, overlay);
  renderer.setZoom(settings.zoomLevel);
  renderer.onZoom = (z) => { settings.zoomLevel = z; storeSettings(settings); };
  const input = new Input(canvas);

  const app = {
    game: null, demo: null, renderer, input, settings, ui: null,
    startNewGame(opts) {
      const game = new Game({ ...opts, tutorial: opts.tutorial });
      this.begin(game);
      writeSave(game);
    },
    continueGame() {
      const s = readSave();
      if (!s) return;
      try { this.begin(new Game({ save: s })); } catch (e) {
        console.error(e);
        ui.toast('That save could not be loaded.');
      }
    },
    begin(game) {
      this.game = game;
      ui.hideTitle();
      ui.bindGame(game);
      const c = game.savedCam;
      if (c) { renderer.cam.x = c.x; renderer.cam.y = c.y; renderer.clampCam(); renderer.snap(); }
      else renderer.centerOn(LAYOUT.view.tx * TILE + 8, LAYOUT.view.ty * TILE);
      playTime = 0;
    },
    saveNow() {
      if (!this.game) return;
      writeSave(this.game);
      leaderboard.submit(this.game);
    },
    quitToTitle() {
      this.saveNow();
      ui.unbindGame();
      this.game = null;
      ui.showTitle(saveMeta());
    },
    applySettings() {
      audio.setVolumes({ music: settings.music, amb: settings.amb, sfx: settings.sfx });
      storeSettings(settings);
    },
    exportSave() {
      if (!this.game && !readSave()) { ui.toast('There is no save to export yet.'); return; }
      downloadSave(this.game);
    },
    async importSave() {
      try {
        const data = await pickSaveFile();
        writeRawSave(data);
        if (this.game) { ui.unbindGame(); this.game = null; }
        ui.closeModal(true);
        this.continueGame();
        ui.toast('Save imported!');
      } catch (e) {
        if (e && e.message !== 'No file') ui.toast('That file isn\'t a valid save.');
      }
    },
  };
  const ui = new UI(app);
  app.ui = ui;
  if (DEBUG) window.app = app;
  app.applySettings();

  // title-screen backdrop
  app.demo = makeDemo();
  ui.showTitle(saveMeta());
  document.getElementById('loading')?.remove();

  const wake = () => { audio.init(); audio.setVolumes({ music: settings.music, amb: settings.amb, sfx: settings.sfx }); };
  addEventListener('pointerdown', wake);
  addEventListener('keydown', wake);

  // autosave
  let playTime = 0;
  addEventListener('visibilitychange', () => { if (document.hidden) app.saveNow(); });
  addEventListener('beforeunload', () => app.saveNow());

  let last = performance.now();
  let demoT = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const game = app.game;
    if (game) {
      input.blocked = ui.isPaused();
      if (DEBUG) debugKeys(game, input);
      renderer.mouse = input.mouse;
      renderer.uiScale = ui.p;
      game.update(dt, input, renderer);
      renderer.updateCamera(dt);
      renderer.render(game, dt, { settings, modalOpen: ui.isPaused() });
      audio.state = { hour: game.hour, raining: game.weather.intensity > 0.3, title: false };
      playTime += dt;
      if (playTime > 60) { playTime = 0; app.saveNow(); }
    } else {
      const d = app.demo;
      demoT += dt;
      const span = 22 * TILE;
      const fx = LAYOUT.garden.x0 * TILE + span / 2 + Math.sin(demoT * 0.05) * span * 0.6;
      const fy = 17 * TILE + Math.sin(demoT * 0.035) * 60;
      renderer.glideTo(fx, fy, dt);
      d.t += dt;
      d.updateCritters(dt, renderer);
      d.updateAmbientFx(dt, renderer);
      d.particles.update(dt);
      renderer.render(d, dt, { title: true, settings });
      audio.state = { hour: d.hour, raining: false, title: true };
    }
    ui.update(dt);
    input.endFrame();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

/** A pre-grown garden used as the title screen background. */
function makeDemo() {
  const g = new Game({ name: 'demo', mode: 'cozy', tutorial: false, seed: 20261122 });
  g.hooks = { isVisible: () => true };
  const w = g.world;
  const rng = makeRng(7);
  const G = LAYOUT.garden;
  const plots = [[G.x0 + 2, G.y0 + 2, 6, 4], [G.x0 + 11, G.y0 + 1, 7, 5], [G.x0 + 3, G.y0 + 9, 8, 4], [G.x0 + 14, G.y0 + 9, 5, 5]];
  plots.forEach(([x0, y0, wdt, hgt], k) => {
    for (let y = y0; y < y0 + hgt; y++)
      for (let x = x0; x < x0 + wdt; x++) {
        const i = w.idx(x, y);
        if (!w.isOpen(x, y) || w.floor[i]) continue;
        w.ground[i] = G_SOIL;
        w.deco[i] = 0;
        w.wet[i] = rng() < 0.8 ? 1 : 0;
        const id = CROP_IDS[(k * 3 + Math.floor((y - y0) / 2)) % CROP_IDS.length];
        if ((x + y) % 7 === 3 && x > x0 && y > y0) { w.objs.set(i, { type: 'sprinkler', tier: 1 }); continue; }
        w.crops.set(i, { id, growth: CROPS[id].hours * (0.45 + rng() * 0.7), harvests: 0 });
      }
    for (let x = x0 - 1; x <= x0 + wdt; x++) {
      if (w.isOpen(x, y0 + hgt + 1)) w.objs.set(w.idx(x, y0 + hgt + 1), { type: 'fence' });
    }
  });
  w.objs.set(w.idx(G.x0 + 10, G.y0 + 7), { type: 'lamp' });
  w.objs.set(w.idx(G.x0 + 1, G.y0 + 7), { type: 'scarecrow' });
  w.objs.set(w.idx(G.x0 + 20, G.y0 + 7), { type: 'gnome' });
  g.ground.renderAll();
  g.time = 17.2 * 60;
  return g;
}

function debugKeys(game, input) {
  if (input.hit('t')) { game.advanceTime(60); game.toast('+1 hour'); }
  if (input.hit('y')) { game.coins += 1000; game.hooks.coinsChanged?.(); }
  if (input.hit('g')) { for (const c of game.world.crops.values()) c.growth = CROPS[c.id].hours; game.toast('Grew everything'); }
  if (input.hit('r')) { game.weather.rain = !game.weather.rain; }
}

function setFavicon() {
  const spr = ART.crops.radish.icon;
  const link = document.createElement('link');
  link.rel = 'icon';
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(spr.img, 0, 0, 64, 64);
  link.href = c.toDataURL();
  document.head.appendChild(link);
}

boot();

