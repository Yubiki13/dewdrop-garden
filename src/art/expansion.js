// Art for the v1.2 expansion: new tools, beehives, fruit trees, decor, fish, the cat, mailbox,
// wishing well, windmill and achievement medals.
import { sprite, Painter } from './palette.js';

const E = '................';

const RAW = {
  goldhoe: [E, '...........YY...', '..........ZYYy..', '.........nZYYYy.', '........nNyZYy..', '.......nNn.yy...', '......nNn.......',
    '.....nNn........', '....nNn.........', '...nNn..........', '..nNn...........', '.nNn............', '.bn.............', E, E, E],
  goldcan: [E, E, '....yyyy........', '...y....y....Ys.', '...y....y...ysy.', '..yYYYYYYYy.yy..', '..yZYYYYYYYyy...', '..yZYYYYYYYy....',
    '..yZYYYYYYYy....', '..yYYYYYYYYy....', '..yyYYYYYYyy....', '...yyyyyyyy.....', E, E, E, E],
  net: [E, '...........nb...', '..........nN....', '.........nN.....', '...SSSSSnN......', '..SsSsSSN.......', '.SsSsSsSS.......',
    '.SSsSsSsS.......', '.SsSsSsSS.......', '.SSsSsSsS.......', '..SsSsSS........', '...SSSS.........', E, E, E, E],
  fish: [E, E, E, E, '.A......LAAA....', '.AA...LAAAAAAA..', '..AAAAAXAAAkAA..', '..AAAAAAAXAAAAa.', '.AA...aAAAAAAa..',
    '.A......aaaa....', E, E, E, E, E, E],
  honey: [E, '.....RRRRR......', '....RpRRRRR.....', '.....rrrrr......', '....SAAAAAS.....', '...SALAAAAAS....', '...SALAAAAAS....',
    '...SAAAAAAaS....', '...SAAAAAaaS....', '....SaaaaaS.....', '.....SSSSS......', E, E, E, E, E],
  sapling: [E, E, '.......hh.......', '.....hhGGhh.....', '....hGGGGGGh....', '....GGXGGXGG....', '....gGGGGGGg....',
    '.....gGXGGg.....', '......ggg.......', '.......nb.......', '.......nb.......', '......nnbb......', '.....oOOOOo.....',
    '.....oOOOOo.....', '......oooo......', E],
  beehive: [E, '.....bBBBBb.....', '....bBNNNNBb....', '...bBBBBBBBBb...', '....yYYYYYYy....', '....yYZYYYYy....', '....yyyyyyyy....',
    '....yYYYYYYy....', '....yYYkkYYy....', '....yyyyyyyy....', '....yYYYYYYy....', '....yyyyyyyy....', '.....bb..bb.....', '.....bb..bb.....', E, E],
  bench: [E, E, E, E, '..nNNNNNNNNNNn..', '..bBBBBBBBBBBb..', '..nNNNNNNNNNNn..', '..b..........b..', '..nNNNNNNNNNNn..',
    '..BBBBBBBBBBBB..', '..b..........b..', '..b..........b..', '..b..........b..', E, E, E],
  birdbath: [E, E, E, E, E, '..sSSSSSSSSSs...', '.sScCCcccCCcSs..', '..sSSSSSSSSSs...', '....sSSSSSs.....', '......SSs.......',
    '......SSs.......', '......SSs.......', '.....sSSSs......', '....sSSSSSs.....', E, E],
  campfire: [E, E, E, E, E, '.......O........', '......OYO.......', '.....OYZYO......', '.....RYZZYR.....', '....bnRYYRnb....',
    '...dbnnRRnnbd...', '..sdbBnnnnBbds..', '...sddddddds....', E, E, E],
  haybale: [E, E, E, E, E, E, '...yYYYYYYYYy...', '..yYZYYYYYYZYy..', '..YYyYYyYYyYYy..', '..yYYYYYYYYYYy..',
    '..YbYYYYYYYYbY..', '..yYYyYYyYYyYy..', '..yyyyyyyyyyyy..', E, E, E],
  statue: [E, '.....sSSSs......', '....sSWSSWs.....', '....sSkSSkSs....', '....sSSddSSs....', '...sSSSSSSSSs...', '...sSsSSSSsSs...',
    '...sSSSSSSSSs...', '....sSSSSSSs....', '...ddddddddd....', '...sSSSSSSSs....', '...sSSSSSSSs....', '..dddddddddd....', E, E, E],
  mushroomlog: [E, E, E, E, E, '....R.....M.....', '...RwR...MwM....', '....w.....w.....', '.bBBBBBBBBBBBn..',
    'bBnNNnnNNnnNBnn.', 'BnNnNnNnNnNnBNn.', 'bBBBBBBBBBBBBnn.', E, E, E, E],
  jackolantern: [E, E, E, E, '.......bg.......', '...oOOOoOOOOo...', '..oOPOOoOPOOOo..', '.oOOkkOoOkkOOOo.',
    '.oOOOOOoOOOOOOo.', '.oOOkOkkkOkOOOo.', '.ooOOkkkkkOOooo.', '..ooOooOOOOooo..', '...oooooooooo...', E, E, E],
  stonelantern: [E, '......dd........', '....dSSSSd......', '...dSSSSSSd.....', '..dddddddddd....', '....sYYYYs......',
    '....sYZZYs......', '....sYYYYs......', '...dddddddd.....', '.....sSSs.......', '.....sSSs.......', '....dddddd......',
    '...dSSSSSSd.....', E, E, E],
  picnic: [E, E, E, E, E, '..RRwwRRwwRRww..', '..RRwwRRwwRRww..', '..wwRRwwRRwwRR..', '..wwRRwwRRwwRR..', '..RRwwRRwwRRww..',
    '..RRwwRRwwRRww..', '..wwRRwwRRwwRR..', '..wwRRwwRRwwRR..', E, E, E],
  sundial: [E, E, E, E, '.....sSSSSs.....', '....sSSdSSSs....', '...sSSSdSSSSs...', '...sSdddSSSSs...', '...sSSSSSSSSs...',
    '....sSSSSSSs....', '.....ssssss.....', '......sSSs......', '......sSSs......', '.....dddddd.....', E, E],
  mailbox: ['..bBBBBb..', '.bNNNNNNb.', '.bNnnnnNb.', '.bNNNNNNb.', '..bBBBBb..', '....nb....', '....nb....', '....nb....', '...bnnb...'],
  flag: ['R.', 'RR', 'R.', 'n.', 'n.'],
  medal: ['..RR.RR...', '...RRRR...', '....RR....', '...AAAA...', '..ALLAAa..', '.ALAAAAaa.', '.AAAXAAaa.', '.AAAAAAaa.', '..aAAAaa..', '...aaaa...'],
  catSit: ['.O..O.........', '.OOOO.........', '.kOkO.........', '.OpOO......O..', '..OO......O...', '.OOOOO...O....', '.OoOoOO.O.....',
    '.OOOOOOO......', '.OoOoOO.......', '.ww.ww........'],
  catWalk1: ['..............', 'O..O..........', 'OOOO..........', 'kOkO.......O..', 'OOpO......O...', '.OOOOOOOOOO...', '.OoOoOoOoO....',
    '.OOOOOOOOO....', '.w.w...w.w....'],
  catWalk2: ['..............', 'O..O..........', 'OOOO..........', 'kOkO.......O..', 'OOpO......O...', '.OOOOOOOOOO...', '.OoOoOoOoO....',
    '.OOOOOOOOO....', '..w.w.w.w.....'],
  catSleep: ['..............', '..............', '..............', '...OOOOOO.....', '..OoOoOoOO....', '.OOOOOOOOOO...', '.OkkOOOOoOO...',
    '..OOOOOOOOO...', '...ooooooO....'],
  heart: ['.R.R.', 'RpRRR', 'RRRRR', '.RRR.', '..R..'],
  letter: [E, E, E, '..wwwwwwwwwwww..', '..wSSwwwwwwSSw..', '..wwSSwwwwSSww..', '..wwwSSwwSSwww..', '..wwwwSRRSwwww..',
    '..wwwwwRRwwwww..', '..wwwwwwwwwwww..', '..SSSSSSSSSSSS..', E, E, E, E, E],
};

const FISH_COLORS = {
  koi: { A: '#f08a2c', a: '#b0501a', L: '#ffc070', X: '#ffffff' },
  whitekoi: { A: '#f5f1e7', a: '#c8c4d4', L: '#ffffff', X: '#e04a4a' },
  goldfish: { A: '#f5c030', a: '#c08a18', L: '#fff3a0', X: '#fff3a0' },
  carp: { A: '#6a8ab0', a: '#3a5a80', L: '#a8c8e8', X: '#a8c8e8' },
  minnow: { A: '#8ac4f0', a: '#4a8ac8', L: '#d4efff', X: '#d4efff' },
  goldkoi: { A: '#ffd030', a: '#c09018', L: '#fffbe0', X: '#ffffff' },
};
export const MEDAL_TIERS = [
  { A: '#c0804a', a: '#8a5028', L: '#e8b080', X: '#fff0d0', R: '#4a7ad0' }, // bronze
  { A: '#c8c8d8', a: '#8a8aa0', L: '#ffffff', X: '#ffffff', R: '#4fa64a' }, // silver
  { A: '#f5c830', a: '#b08818', L: '#fff3a0', X: '#ffffff', R: '#e04a4a' }, // gold
  { A: '#7ad8f8', a: '#3a8ac8', L: '#e0f8ff', X: '#ffffff', R: '#7a52c0' }, // diamond
  { A: '#f08ac0', a: '#7a52c0', L: '#fff3a0', X: '#ffffff', R: '#f5d44a' }, // star
  { A: '#ff7a3a', a: '#a82a6a', L: '#fff3a0', X: '#ffffff', R: '#3ac0b0' }, // legendary
];

export function buildExpansionArt() {
  const out = {};
  const s = (k, o = {}) => sprite(RAW[k], o);
  out.goldhoe = s('goldhoe');
  out.goldcan = s('goldcan');
  out.net = s('net');
  out.fish = {};
  for (const [k, c] of Object.entries(FISH_COLORS)) out.fish[k] = s('fish', { overrides: c });
  out.honey = s('honey', { overrides: { A: '#f5c030', a: '#c08a18', L: '#fff3a0' } });
  out.wildhoney = s('honey', { overrides: { A: '#f08a3a', a: '#b0501a', L: '#ffc890', R: '#7a52c0', r: '#4a2f7a', p: '#b89af0' } });
  out.beehive = s('beehive');
  out.bench = s('bench');
  out.birdbath = s('birdbath');
  out.campfire = s('campfire');
  out.haybale = s('haybale');
  out.statue = s('statue');
  out.mushroomlog = s('mushroomlog');
  out.jackolantern = s('jackolantern');
  out.stonelantern = s('stonelantern');
  out.picnic = s('picnic');
  out.sundial = s('sundial');
  out.mailbox = s('mailbox');
  out.flag = s('flag', { outlineStrength: 0.5 });
  out.letter = s('letter');
  out.heart = sprite(RAW.heart, { outline: false });
  out.cat = { sit: s('catSit', { overrides: CAT }), walk: [s('catWalk1', { overrides: CAT }), s('catWalk2', { overrides: CAT })], sleep: s('catSleep', { overrides: CAT }) };
  out.medals = MEDAL_TIERS.map((o) => sprite(RAW.medal, { overrides: o }));
  return out;
}
const CAT = { O: '#f0a040', o: '#c06a20', w: '#f6f1e7', p: '#f08ac0' };

/** Saplings and fruit icons per tree kind. */
export const TREE_KINDS = {
  apple: { name: 'Apple', fruit: '#e04a4a', dark: '#9e2a3a', light: '#ff8c82', tree: 'oak' },
  peach: { name: 'Peach', fruit: '#ffb08a', dark: '#e06a5a', light: '#ffe0c8', tree: 'oak' },
  orange: { name: 'Orange', fruit: '#f08a2c', dark: '#b0501a', light: '#ffc070', tree: 'oak' },
  cherry: { name: 'Cherry', fruit: '#c8202a', dark: '#7a1018', light: '#ff7a7a', tree: 'cherry' },
  plum: { name: 'Plum', fruit: '#7a3aa0', dark: '#4a1a6a', light: '#c08ae0', tree: 'maple' },
};
export function buildSaplings() {
  const out = {};
  for (const [k, t] of Object.entries(TREE_KINDS)) out[k] = sprite(RAW.sapling, { overrides: { X: t.fruit } });
  return out;
}

/* ---------------------------- landmarks ---------------------------- */

export function makeWishWell() {
  const W = 34, H = 46;
  const p = new Painter(W, H);
  for (const px of [4, 27]) for (let y = 8; y < 34; y++) { p.set(px, y, '#e0d0e8'); p.set(px + 1, y, '#c0b0d0'); p.set(px + 2, y, '#9a88b0'); }
  for (let y = 0; y < 12; y++) {
    const half = 6 + y * 1.25;
    for (let x = Math.floor(17 - half); x < Math.ceil(17 + half); x++) {
      const c = y === 11 ? '#7a4a8a' : (x + (y % 2) * 2) % 4 === 0 ? '#a868b8' : y % 3 === 0 ? '#f0b0e0' : '#d088c8';
      p.set(x, y, c);
    }
  }
  // flower garland
  for (let x = 6; x < 28; x += 2) { p.set(x, 13, x % 4 ? '#f5d44a' : '#ffffff'); p.set(x + 1, 14, '#4fa64a'); }
  p.vline(17, 15, 21, '#f2e2bc');
  p.rect(15, 21, 5, 4, '#f5d44a'); p.hline(15, 19, 21, '#fff3a0');
  for (let y = 26; y < 45; y++)
    for (let x = 2; x < 32; x++) {
      const dx = (x + 0.5 - 17) / 15, top = (y + 0.5 - 30) / 4.5;
      if (y < 30 && dx * dx + top * top > 1) continue;
      const inner = dx * dx / 0.7 + ((y + 0.5 - 30) / 2.8) ** 2 < 1 && y < 32;
      if (inner) { p.set(x, y, (x + y) % 5 === 0 ? '#d4efff' : '#4ab8d8'); continue; }
      const brick = ((Math.floor(y / 3) % 2) * 3 + x) % 6 === 0 || y % 3 === 0;
      p.set(x, y, brick ? '#b8b0c8' : x < 12 ? '#ffffff' : '#e8e0f0');
    }
  for (let x = 4; x < 30; x += 5) { p.set(x, 36, '#f08ac0'); p.set(x + 1, 37, '#4fa64a'); }
  p.rect(2, 44, 30, 1, '#8a80a0');
  return p.finish(true, 0.55);
}

export function makeWindmill() {
  const W = 48, H = 66;
  const p = new Painter(W, H);
  // tower (tapered)
  for (let y = 14; y < 64; y++) {
    const t = (y - 14) / 50;
    const half = 9 + t * 9;
    for (let x = Math.floor(24 - half); x < Math.ceil(24 + half); x++) {
      const rel = (x - (24 - half)) / (half * 2);
      let c = rel < 0.25 ? '#f6f1e7' : rel < 0.8 ? '#e2d4b8' : '#bba888';
      if ((y % 9 === 0)) c = '#a89070';
      p.set(x, y, c);
    }
  }
  // roof cap
  for (let y = 2; y < 16; y++) {
    const half = 3 + (y - 2) * 0.85;
    for (let x = Math.floor(24 - half); x < Math.ceil(24 + half); x++) p.set(x, y, y === 15 ? '#6e2626' : (x + y) % 4 === 0 ? '#8e3530' : '#b54a3a');
  }
  // door + window
  p.rect(20, 50, 8, 14, '#7a4a30'); p.vline(23, 50, 63, '#5a3420'); p.set(26, 57, '#f5d44a');
  p.rect(21, 30, 6, 7, '#5a3420'); p.rect(22, 31, 4, 5, '#8ac4f0'); p.set(22, 31, '#d4efff');
  p.rect(18, 64, 12, 2, '#9a96a6');
  const s = p.finish(true, 0.55);
  // one blade (rotated at draw time)
  const b = new Painter(7, 26);
  b.rect(3, 0, 1, 26, '#6a4430');
  for (let y = 2; y < 22; y++) for (let x = 0; x < 3; x++) b.set(x, y, (y + x) % 3 === 0 ? '#c8b088' : '#f2e2bc');
  return { ...s, blade: b.finish(true, 0.5), hub: { x: 24, y: 18 } };
}

export { RAW as EXP_RAW };
