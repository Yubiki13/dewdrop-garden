// Art for the v1.3 Wildwood update: new tools (+ copper/iron/gold versions of every tool), materials,
// the workbench, seed maker, forage spots, treasure chests, ore veins, Fern's hut and the old shrine.
import { sprite, Painter } from './palette.js';
import { makeRock } from './procedural.js';

const E = '................';
const pad = (rows) => [...rows, ...Array(16 - rows.length).fill(E)];

const RAW = {
  axe: pad([E, '.........sSS....', '........sSWSs...', '.......nsSSSSs..', '......nNdSSSs...', '.....nNn.dSs....', '....nNn.........',
    '...nNn..........', '..nNn...........', '.nNn............', '.bn.............']),
  pickaxe: pad([E, '..s..........s..', '..sS........Ss..', '...sSSSSSSSSs...', '....sSSnNSSs....', '.......nN.......', '.......nN.......',
    '.......nN.......', '.......nN.......', '.......nN.......', '.......nN.......', '.......bb.......']),
  shears: pad([E, '..........S.....', '.........SW.....', '....S...SS......', '....SW.SS.......', '.....SSS........', '......dS........',
    '.....RRdRR......', '....R..d..R.....', '....R.....R.....', '.....RRRRR......']),
  picker: pad(['..........nBBn..', '.........nNNNNn.', '.........NsNsNN.', '..........nNNn..', '.........nb.....', '........nN......',
    '.......nN.......', '......nN........', '.....nN.........', '....nN..........', '...nN...........', '..bn............']),
  trowel: pad([E, '...sSs..........', '..sSWSs.........', '..sSSSSs........', '...sSSSSs.......', '....sSSSd.......', '.....sdd.n......',
    '.........nN.....', '..........nN....', '...........NN...', '...........bb...']),
  wand: pad(['...........c....', '..........cCc...', '.........cCWCc..', '..........cCc...', '.........nY.c...', '........nN......',
    '.......nN.......', '......nN........', '.....nN.........', '....nN..........', '...bb...........']),
  workbench: pad([E, E, '.....sS....d....', '..nNNNNNNNNNNn..', '..BBBBBBBBBBBB..', '..bnNNnnNNnnNb..', '..B..........B..',
    '..B.dS....sd.B..', '..BBBBBBBBBBBB..', '..B..........B..', '..b..........b..']),
  seedmaker: pad([E, '.....sSSSs......', '......sSs.......', '....nNNNNNn.....', '...nNbBBBbNn....', '...NbGgGgGbN....', '...NbgGhGgbN....',
    '...nNbBBBbNn....', '...nNNNNNNNn....', '....bbbbbbb.....']),
  chest: pad([E, E, E, E, '...bBBBBBBBBb...', '..bNnnnnnnnnNb..', '..BnNNNNNNNNnB..', '..bbbbbYYbbbbb..', '..BnNNNYZNNNnB..', '..BnNNNNNNNNnB..',
    '..BnNNNNNNNNnB..', '..bbbbbbbbbbbb..']),
  chestOpen: pad([E, E, E, '..bNNNNNNNNNNb..', '..BnnnnnnnnnnB..', '..bbbbbbbbbbbb..', '..BYZYYZYYZYYB..', '..bbbbbYYbbbbb..', '..BnNNNNNNNNnB..',
    '..BnNNNNNNNNnB..', '..bbbbbbbbbbbb..']),
  // materials
  wood: pad([E, E, E, '......nNNn......', '.....nNbbNn.....', '.....NbnnbN.....', '..nNNnNbbNnNNn..', '.nNbbNnNNnNbbNn.', '.NbnnbN..NbnnbN.',
    '.nNbbNn..nNbbNn.', '..nNNn....nNNn..']),
  stone: pad([E, E, E, E, '.......sSSs.....', '......sSWSSs....', '...sSSsSSSSds...', '..sSWSSdsSSdds..', '..sSSSSdddddd...', '...dddddd.......']),
  fiber: pad([E, E, '......h.h.h.....', '.....hGhGhG.....', '.....GgGgGg.....', '......GgGg......', '......NnNn......', '......GgGg......',
    '.....gGgGgG.....', '....gG.gG.gG....']),
  ore: pad([E, E, E, E, '.......sSSs.....', '.....sSLXSSs....', '....sSXXSSLXs...', '...sSSSSXXSSds..', '...sLXSSSSSdds..', '....sXdddLXdd...',
    '.....dddddd.....']),
  crystal: pad([E, E, '.......C........', '......CWc.......', '......CWc..C....', '.....cCWcc.Wc...', '.....cCWcc.Wc...', '....ucCWCcuCc...',
    '....uuccccuuu...', '.....uuuuuu.....']),
  petals: pad([E, E, '.....MM.........', '....MiMM...M....', '.....MM...MiM...', '..M.......MM....', '.MiM..MM........', '..M..MiMM.......',
    '......MM....M...', '...........MiM..', '............M...']),
  stardust: pad([E, E, '.......Y........', '......YZY.......', '.......Y...Z....', '.....vVVv.......', '....vVlVVv......', '....VlVVVV.Y....',
    '....VVVVVv......', '.....vvvv.......']),
  // forage spots
  herbs: ['..h..h...h..', '.hGhhGh.hGh.', '.GgwGgGhGgG.', '..gGGgwGgg..', '...gggggg...'],
  herbsBare: ['............', '............', '..g..G...g..', '..gGg.gGgg..', '...gggggg...'],
  mushrooms: ['...RR.......', '..RwRR.OO...', '..RRRROOOO..', '...ww..ww...', '...ww..ww...'],
  mushroomsBare: ['............', '............', '............', '...nn..nn...', '...bb..bb...'],
};

const METAL = [
  null,
  { S: '#e8a070', s: '#b06838', d: '#6a3418', W: '#ffd8b8', B: '#b06838', N: '#e8a070' }, // copper
  { S: '#d8e0f0', s: '#8a98b8', d: '#4a5878', W: '#ffffff', B: '#6a7898', N: '#c8d0e0' }, // iron
  { S: '#f5d44a', s: '#c98f22', d: '#7a5a10', W: '#fff3a0', B: '#c98f22', N: '#f5d44a' }, // gold
];
const CAN = [null, { A: '#d88a50', a: '#9a5028', C: '#ffc8a0' }, { A: '#a8b8d8', a: '#6a7898', C: '#e8f0ff' }, { A: '#f5c830', a: '#b08818', C: '#fff3a0' }];
const WAND = [{ c: '#4a7ad0', C: '#8ac4f0', W: '#d4efff' }, { c: '#3a9a5a', C: '#7ad8a0', W: '#d8ffe8' }, { c: '#7a52c0', C: '#b89af0', W: '#f0e8ff' }, { c: '#c98f22', C: '#f5d44a', W: '#fff3a0' }];
const ORE_COLORS = {
  copper: { X: '#d8783a', L: '#ffb080' }, iron: { X: '#a8b8d8', L: '#ffffff' }, gold: { X: '#f5c830', L: '#fff3a0' }, crystal: { X: '#7ad8f8', L: '#ffffff' },
};

/** Builds the new icons and level variants; `baseIcons` are the existing tool icon rows' sprites by id. */
export function buildWildArt(toolRows) {
  const out = { icons: {}, ore: {}, forage: {} };
  const ic = out.icons;
  for (const k of ['axe', 'pickaxe', 'shears', 'picker', 'trowel', 'workbench', 'seedmaker', 'chest', 'chestOpen']) ic[k] = sprite(RAW[k]);
  ic.wand = sprite(RAW.wand, { overrides: WAND[0] });
  for (const k of ['wood', 'stone', 'fiber', 'crystal', 'petals', 'stardust']) ic['mat_' + k] = sprite(RAW[k], k === 'crystal' ? { overrides: { c: '#4a8ac8', C: '#8ad8f8', W: '#ffffff', u: '#2a4a8a' } } : {});
  ic.mat_copper = sprite(RAW.ore, { overrides: ORE_COLORS.copper });
  ic.mat_iron = sprite(RAW.ore, { overrides: ORE_COLORS.iron });
  ic.mat_goldore = sprite(RAW.ore, { overrides: ORE_COLORS.gold });
  // copper / iron / gold versions of every upgradable tool
  const rows = { ...toolRows, axe: RAW.axe, pickaxe: RAW.pickaxe, shears: RAW.shears, picker: RAW.picker, trowel: RAW.trowel };
  for (let l = 2; l <= 4; l++) {
    for (const [k, r] of Object.entries(rows)) {
      const o = k === 'can' ? CAN[l - 1] : METAL[l - 1];
      ic[`${k}_L${l}`] = sprite(r, { overrides: o });
      if (k === 'bucket' && toolRows.bucket_full) ic[`bucket_full_L${l}`] = sprite(toolRows.bucket_full, { overrides: o });
    }
    ic[`wand_L${l}`] = sprite(RAW.wand, { overrides: WAND[l - 1] });
  }
  // ore veins in the world: a big rock with coloured nuggets
  for (const [k, c] of Object.entries(ORE_COLORS)) {
    const r = makeRock(k.length * 7, true);
    const ctx = r.img.getContext('2d');
    const nug = [[4, 4], [9, 3], [12, 7], [6, 8], [10, 10], [3, 9]];
    for (const [x, y] of nug) { ctx.fillStyle = c.X; ctx.fillRect(x, y, 2, 2); ctx.fillStyle = c.L; ctx.fillRect(x, y, 1, 1); }
    out.ore[k] = r;
  }
  out.forage.herbs = [sprite(RAW.herbs, { outlineStrength: 0.5 }), sprite(RAW.herbsBare, { outlineStrength: 0.5 })];
  out.forage.mushrooms = [sprite(RAW.mushrooms, { outlineStrength: 0.5 }), sprite(RAW.mushroomsBare, { outlineStrength: 0.5 })];
  out.hut = makeHut();
  out.shrine = makeShrine();
  return out;
}
export { RAW as WILD_RAW };

function makeHut() {
  const W = 50, H = 50;
  const p = new Painter(W, H);
  // mossy roof
  for (let y = 2; y < 24; y++) {
    const inset = Math.max(0, 10 - Math.floor(y * 0.6));
    for (let x = inset; x < W - inset; x++) {
      const row = Math.floor(y / 4), off = (row % 2) * 3;
      let c = (x + off) % 6 === 0 ? '#5a4a2a' : y % 4 === 0 ? '#8a7a4a' : '#6e5e36';
      if ((x * 7 + y * 3) % 11 === 0) c = '#4fa64a';
      if ((x * 5 + y * 13) % 17 === 0) c = '#8fd65a';
      p.set(x, y, c);
    }
  }
  // log walls
  for (let y = 22; y < 46; y++)
    for (let x = 4; x < 46; x++) p.set(x, y, y % 4 === 0 ? '#5a3a26' : y % 4 === 1 ? '#a8724a' : '#8a5a3a');
  for (let y = 22; y < 46; y += 4) { p.set(3, y + 1, '#c8945a'); p.set(46, y + 1, '#c8945a'); }
  // door + round window
  p.rect(20, 30, 10, 16, '#4a2e22'); p.rect(21, 31, 8, 15, '#7a4a30'); p.set(27, 38, '#f5d44a');
  p.rect(8, 28, 8, 7, '#4a2e22'); p.rect(9, 29, 6, 5, '#8ac4f0'); p.set(9, 29, '#d4efff');
  p.rect(35, 28, 8, 7, '#4a2e22'); p.rect(36, 29, 6, 5, '#8ac4f0'); p.set(36, 29, '#d4efff');
  // jars and baskets out front
  p.rect(6, 41, 4, 5, '#c8a868'); p.rect(11, 42, 4, 4, '#e04a4a'); p.rect(36, 41, 5, 5, '#7a4a30'); p.set(37, 41, '#4fa64a'); p.set(39, 41, '#f5d44a');
  // hanging herbs
  for (const x of [8, 12, 38, 42]) { p.vline(x, 23, 26, '#4fa64a'); p.set(x, 27, '#8fd65a'); }
  return p.finish(true, 0.55);
}

function makeShrine() {
  const W = 34, H = 42;
  const p = new Painter(W, H);
  // stone base
  for (let y = 30; y < 41; y++) for (let x = 3; x < 31; x++) p.set(x, y, (x + y * 2) % 7 === 0 ? '#8f8ba3' : y < 32 ? '#cbc7d4' : '#a8a4b8');
  // pillar
  for (let y = 10; y < 30; y++) for (let x = 11; x < 23; x++) p.set(x, y, x < 14 ? '#d8d4e0' : x > 20 ? '#8f8ba3' : (y % 6 === 0 ? '#a8a4b8' : '#bcb8cc'));
  // carved rune
  for (const [x, y] of [[16, 14], [17, 15], [16, 16], [17, 17], [16, 18], [15, 16], [18, 16]]) p.set(x, y, '#7ad8f8');
  // cap + glowing orb
  p.rect(9, 7, 16, 3, '#8f8ba3'); p.hline(9, 24, 7, '#cbc7d4');
  for (let y = 0; y < 8; y++) for (let x = 13; x < 21; x++) { const d = Math.hypot(x - 16.5, y - 3.5); if (d < 3.6) p.set(x, y, d < 1.5 ? '#ffffff' : d < 2.6 ? '#b8f0ff' : '#7ad8f8'); }
  // moss + flowers
  for (const x of [4, 7, 26, 29]) { p.set(x, 30, '#4fa64a'); p.set(x + 1, 29, '#8fd65a'); }
  p.set(6, 29, '#f08ac0'); p.set(28, 29, '#fff3a0');
  return { ...p.finish(true, 0.55), orb: { x: 17, y: 4 } };
}
