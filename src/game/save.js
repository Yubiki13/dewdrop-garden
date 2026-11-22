// Save games live in localStorage; they can also be exported/imported as .json files.
import { SAVE_KEY, SETTINGS_KEY } from '../config.js';

export function readSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveMeta() {
  const s = readSave();
  if (!s) return null;
  return { day: Math.floor(s.time / 1440) + 1, name: s.name || 'Gardener' };
}

export function writeSave(game) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(game.serialize()));
    return true;
  } catch (e) {
    console.warn('Save failed', e);
    return false;
  }
}

export function writeRawSave(data) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}

export function downloadSave(game) {
  const data = JSON.stringify(game ? game.serialize() : readSave(), null, 0);
  const blob = new Blob([data], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const name = (game ? game.name : 'garden').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  a.download = `dewdrop-${name}-day${game ? game.day : ''}.json`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

export function pickSaveFile() {
  return new Promise((resolve, reject) => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.json,application/json';
    inp.onchange = () => {
      const f = inp.files[0];
      if (!f) return reject(new Error('No file'));
      f.text().then((t) => {
        const d = JSON.parse(t);
        if (!d || !d.world || !d.inv) throw new Error('Not a Dewdrop Garden save');
        resolve(d);
      }).catch(reject);
    };
    inp.click();
  });
}

const DEFAULT_SETTINGS = { music: 0.55, amb: 0.6, sfx: 0.7, zoom: 1, thirsty: true, grid: false };

export function loadSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}
export function storeSettings(s) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* private mode */ }
}
