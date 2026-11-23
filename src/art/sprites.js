// Hand-authored pixel art. Every string is one row; each char maps to PAL (see palette.js).
// Sprites are auto-outlined when built, so art here is just fills + shading.
import { sprite, Painter, PAL } from './palette.js';
import { hexToRgb } from '../core/util.js';
import { RARE_CROP_ART } from './crops2.js';

const E16 = '................';
const blank = (n) => Array(n).fill(E16);

/* ------------------------------------------------------------------ */
/* Characters                                                          */
/* ------------------------------------------------------------------ */

const DOWN_TOP = [
  E16,
  '.....yyyyyy.....',
  '....yYYYYYYy....',
  '....yYYZYYYy....',
  '...rrrrrrrrrr...',
  '.yyYYYYYYYYYYyy.',
  '..yyeHHHHHHeyy..',
  '...eHHffffHHe...',
  '...HfkffffkfH...',
  '...eFpffffpFe...',
  '....FffffffF....',
  '....tTTffTTt....',
  '...tTETTTTETt...',
  '..fTTEEEEEETTf..',
  '..ftEEEEEEEEtf..',
  '...fIEEEEEEIf...',
];
const DOWN_BLINK = DOWN_TOP.map((r, i) => (i === 8 ? '...HffffffffH...' : r));
const UP_TOP = [
  E16,
  '.....yyyyyy.....',
  '....yYYYYYYy....',
  '....yYYYYYYy....',
  '...rrrrrrrrrr...',
  '.yyYYYYYYYYYYyy.',
  '..yyeHHHHHHeyy..',
  '...eHHHHHHHHe...',
  '...HHHHHHHHHH...',
  '...eHHHHHHHHe...',
  '....eHHHHHHe....',
  '....tTTTTTTt....',
  '...tTETTTTETt...',
  '..fTTETTTTETTf..',
  '..ftEEEEEEEEtf..',
  '...fIEEEEEEIf...',
];
const FRONT_LEGS = {
  idle: ['....IEEEEEEI....', '....IEEIIEEI....', '....IEI..IEI....', '....bBb..bBb....', '....bbb..bbb....'],
  a: ['....IEEEEEEI....', '....IEEIIEEI....', '....IEI..bBb....', '....bBb..bbb....', '....bbb.........'],
  b: ['....IEEEEEEI....', '....IEEIIEEI....', '....bBb..IEI....', '....bbb..bBb....', '.........bbb....'],
};
const SIDE_TOP = [
  E16,
  '......yyyyy.....',
  '.....yYYYYYy....',
  '.....yYYZYYy....',
  '....rrrrrrrrr...',
  '..yyYYYYYYYYYyy.',
  '.....eHHHHHff...',
  '.....HHHHffff...',
  '.....HHHfffkf...',
  '.....eHFfffpf...',
  '......eFffff....',
  '......tTTTt.....',
  '.....tTTTTTt....',
  '.....tEETTEI....',
  '.....IEEfEEI....',
  '.....IEEEEEI....',
];
const SIDE_BLINK = SIDE_TOP.map((r, i) => (i === 8 ? '.....HHHfffff...' : r));
const SIDE_LEGS = {
  idle: ['.....IEEEEI.....', '.....IEEEEI.....', '......IE.EI.....', '......bB.bB.....', '......bbb.bbb...'],
  a: ['.....IEEEEI.....', '.....IEEEEI.....', '.....IE..EI.....', '.....bB...bB....', '....bbb...bbb...'],
  b: ['.....IEEEEI.....', '.....IEEEEI.....', '.......IEI......', '.......bBb......', '.......bbbb.....'],
};

export const HAIR_COLORS = [
  { H: '#7a4a2a', e: '#4e2c1a' }, // brown
  { H: '#2e2430', e: '#17111a' }, // black
  { H: '#e8c060', e: '#b88a30' }, // blonde
  { H: '#c8582c', e: '#8a3418' }, // ginger
  { H: '#e07aa8', e: '#a8487a' }, // pink
  { H: '#6a8ae0', e: '#3e58a8' }, // blue
  { H: '#d8d8e0', e: '#9a98a8' }, // silver
];
export const SHIRT_COLORS = [
  { T: '#5aa05a', t: '#3d7a45' },
  { T: '#e05a5a', t: '#a83a42' },
  { T: '#f0c040', t: '#c08a28' },
  { T: '#5a9ae0', t: '#3a68a8' },
  { T: '#b07ae0', t: '#7a4ab0' },
  { T: '#f0f0e8', t: '#c0bcc8' },
  { T: '#f08ab8', t: '#c05a88' },
];
export const PANTS_COLORS = [
  { E: '#4a72c0', I: '#344f90' },
  { E: '#7a5a3a', I: '#56402a' },
  { E: '#4a4a5a', I: '#30303c' },
  { E: '#5a8a4a', I: '#3e6434' },
  { E: '#a8506a', I: '#7a3448' },
];

function assemble(top, legs) {
  return [...top, ...legs];
}

/** Builds all frames for a farmer-style character. */
export function buildCharacter(overrides = {}) {
  const o = { outlineStrength: 0.7, overrides };
  const make = (top, legs, flip = false) => sprite(assemble(top, legs), { ...o, flip });
  return {
    down: [make(DOWN_TOP, FRONT_LEGS.idle), make(DOWN_TOP, FRONT_LEGS.a), make(DOWN_TOP, FRONT_LEGS.b)],
    up: [make(UP_TOP, FRONT_LEGS.idle), make(UP_TOP, FRONT_LEGS.a), make(UP_TOP, FRONT_LEGS.b)],
    right: [make(SIDE_TOP, SIDE_LEGS.idle), make(SIDE_TOP, SIDE_LEGS.a), make(SIDE_TOP, SIDE_LEGS.b)],
    left: [make(SIDE_TOP, SIDE_LEGS.idle, true), make(SIDE_TOP, SIDE_LEGS.a, true), make(SIDE_TOP, SIDE_LEGS.b, true)],
    blink: {
      down: make(DOWN_BLINK, FRONT_LEGS.idle),
      right: make(SIDE_BLINK, SIDE_LEGS.idle),
      left: make(SIDE_BLINK, SIDE_LEGS.idle, true),
    },
  };
}

const GRANNY = [
  E16,
  '......SSSS......',
  '.....SwSSSS.....',
  '....sSSSSSSs....',
  '...sSSwSSSSSs...',
  '...SSSSSSSSSS...',
  '...SSffffffSS...',
  '...SffffffffS...',
  '...SdkdffdkdS...',
  '...sfpffffpfs...',
  '....FffffffF....',
  '....vVVwwVVv....',
  '...vVVwwwwVVv...',
  '..fVVwwwwwwVVf..',
  '..fvVwwwwwwVvf..',
  '...vVwwMMwwVv...',
  '...vVVwwwwVVv...',
  '...vVVVVVVVVv...',
  '...vVlVVVlVVv...',
  '...vvvvvvvvvv...',
  '.....bb..bb.....',
];
export function buildGranny() {
  const blink = GRANNY.map((r, i) => (i === 8 ? '...SdfdffdfdS...' : r));
  return { idle: sprite(GRANNY, { outlineStrength: 0.7 }), blink: sprite(blink, { outlineStrength: 0.7 }) };
}

/* ------------------------------------------------------------------ */
/* Crops                                                               */
/* ------------------------------------------------------------------ */

// rows aligned to the bottom of a 16x16 cell; plant base sits on row 13
const pad16 = (rows) => [...blank(14 - rows.length), ...rows, E16, E16];
const pad24 = (rows) => [...blank(22 - rows.length), ...rows, E16, E16];

const SEED = pad16(['......bnnb......', '.....bnNnNb.....', '......bbbb......']);
const SPROUT = pad16(['.....hh..hh.....', '....hGGhhGGh....', '.....gGggGg.....', '.......gg.......', '......bggb......']);

const CROP_ART = {
  radish: {
    young: pad16(['.....h....h.....', '....hGh..hGh....', '.....hGggGh.....', '.......gg.......', '.......gg.......']),
    grown: pad16([
      '.....hh..hh.....', '....hGGhhGGh....', '...hGGgGGgGGh...', '...GGgGhhGgGG...',
      '....gGGggGGg....', '.....gGggGg.....', '......gggg......', '.......gg.......',
    ]),
    ripe: pad16([
      '.....hh..hh.....', '....hGGhhGGh....', '...hGGgGGgGGh...', '...GGgGhhGgGG...',
      '....gGGggGGg....', '......gGGg......', '.....pRRRRr.....', '....pRRRRRRr....',
      '....RRRRRRrr....', '.....rRRRrr.....',
    ]),
    icon: [
      E16, '.....h....h.....', '....hGh..hGh....', '.....GGhhGG.....', '......gGGg......',
      '.....pRRRRr.....', '....pRRRRRRr....', '...pRRRRRRRRr...', '...RRRRRRRRRr...',
      '...RRRRRRRRrr...', '....RRRRRRrr....', '.....rRRRrr.....', '......wwww......',
      '.......ww.......', '........w.......', E16,
    ],
  },
  carrot: {
    young: pad16(['........h.......', '.....h..G..h....', '......G.G.G.....', '.......GGG......', '........g.......', '.......ggg......']),
    grown: pad16([
      '.......h.h......', '....h..G.G..h...', '.....G.G.G.G....', '...h.GGhGhGG.h..',
      '....GGGgGgGGG...', '......GGgGG.....', '.......gGg......', '........g.......', '.......ggg......',
    ]),
    ripe: pad16([
      '.......h.h......', '....h..G.G..h...', '.....G.G.G.G....', '...h.GGhGhGG.h..',
      '....GGGgGgGGG...', '......GGgGG.....', '.......gGg......', '......POOOo.....',
      '......OOoOo.....', '.......OOo......', '.......oOo......',
    ]),
    icon: [
      E16, '..........h.h...', '.........hGhG...', '..........GGh...', '.........PoGG...',
      '........POOo....', '.......POoOo....', '......POOOo.....', '.....POOoOo.....',
      '....POOOOo......', '....OoOOo.......', '...OOOOo........', '...OOoo.........',
      '..Ooo...........', E16, E16,
    ],
  },
  lettuce: {
    young: pad16(['......hhhh......', '.....hGhhGh.....', '.....GGGGGG.....', '......gGGg......', '.......gg.......']),
    grown: pad16([
      '......hhhh......', '....hhGqqGhh....', '...hGGhqqhGGh...', '...GGGGhhGGGG...',
      '....gGGGGGGg....', '.....ggGGgg.....', '......gggg......',
    ]),
    ripe: pad16([
      '.....hhhhhh.....', '...hhqqhhqqhh...', '..hGhqqqqqqhGh..', '..GGhhqqqqhhGG..',
      '.hGGGhhqqhhGGGh.', '.GGgGGhhhhGGgGG.', '.GgGGgGhhGgGGgG.', '..gGGgGGGGgGGg..',
      '...ggGGggGGgg...', '.....gggggg.....',
    ]),
    icon: [
      E16, E16, '.....hhhhhh.....', '...hhqqhhqqhh...', '..hGhqqqqqqhGh..', '..GGhhqqqqhhGG..',
      '.hGGGhhqqhhGGGh.', '.GGgGGhhhhGGgGG.', '.GgGGgGhhGgGGgG.', '..gGGgGGGGgGGg..',
      '...ggGGggGGgg...', '.....gggggg.....', '.......gg.......', E16, E16, E16,
    ],
  },
  potato: {
    young: pad16(['......h..h......', '.....hGhhGh.....', '......GGGG......', '.......gg.......', '.......gg.......']),
    grown: pad16([
      '......hh.hh.....', '....hhGGhGGh....', '...hGGGgGGGGh...', '...GGgGGGgGGG...',
      '....GGGgGGGG....', '.....gGGGGg.....', '......gggg......', '.......gg.......',
    ]),
    ripe: pad16([
      '......w...w.....', '.....wYwhwYw....', '....hhwGhGwhh...', '...hGGGgGGGGh...',
      '..wGGgGGGgGGGw..', '.wYwGGGgGGGwYw..', '..wGGGgGGGGGw...', '....NngGGgNn....',
      '...NNnggggNNn...', '....nn.gg.nn....',
    ]),
    icon: [
      E16, E16, E16, E16, '.....nNNNn......', '....nNxxNNn.....', '...nNxNNNNNn....',
      '..nNNNNNNnNNn...', '..nNNnNNNNNNn...', '..nNNNNNNNNnn...', '..BnNNNnNNNn....',
      '...BnnNNNnnB....', '....BBnnnBB.....', E16, E16, E16,
    ],
  },
  strawberry: {
    young: pad16(['.....hG..Gh.....', '......GggG......', '.......gg.......', '.......gg.......']),
    grown: pad16([
      '.....hh..hh.....', '....hGGhhGGh....', '..hGGGgGGgGGGh..', '..GwGgGGGGgGwG..',
      '...wYwgGGgwYw...', '....wggggggw....',
    ]),
    ripe: pad16([
      '.....hh..hh.....', '....hGGhhGGh....', '..hGGGgGGgGGGh..', '..GGRgGGGGgRGG..',
      '..gpRRgGGgpRRg..', '...RYRggggRYR...', '....rr.gg.rr....',
    ]),
    icon: [
      E16, '......h.h.......', '.....hGhGh......', '....gGGGGGg.....', '...pRRgGgRRr....',
      '..pRRYRRRYRRr...', '..RRRRRRRRRRr...', '..RYRRRYRRRYr...', '..RRRRRRRRRrr...',
      '...RRYRRRYRr....', '...rRRRRRRrr....', '....rRRYRrr.....', '.....rRRrr......',
      '......rrr.......', E16, E16,
    ],
  },
  blueberry: {
    young: pad16(['.....hG..Gh.....', '.....GGggGG.....', '......gGGg......', '.......gg.......']),
    grown: pad16([
      '......hhhh......', '....hhGGGGhh....', '...hGGGgGGGGh...', '..hGGgGGGGgGGh..',
      '..GGGGGgGGGGGG..', '..gGgGGGGGgGGg..', '...gGGgGGGGGg...', '....ggGggGgg....', '......bBBb......',
    ]),
    ripe: pad16([
      '......hhhh......', '....hhGGGGhh....', '...hGcUgGGcUh...', '..hGGUuGGgGUuh..',
      '..GcUGGgcUGGGG..', '..gUuGGGUuGcUg..', '...gGGcUGGGUu...', '....ggUuggGgg...', '......bBBb......',
    ]),
    icon: [
      E16, E16, '.........hG.....', '........hGg.....', '....cUU..g......', '...cUUUu.cUU....',
      '...UUuUu.UuUu...', '...uUUuucUuUu...', '....uucUUUuUu...', '.....cUUUuuu....',
      '.....UUuUu......', '.....uUUuu......', '......uuu.......', E16, E16, E16,
    ],
  },
  pumpkin: {
    young: pad16(['....hG....Gh....', '.....GGggGG.....', '......gggg......', '.......gg.......']),
    grown: pad16([
      '..hh......hh....', '.hGGh....hGGh...', '.GGgGh..hGgGG...', '..gGGgggGGGg..Y.',
      '...ggGGGGg..gYZY', '.....gggg.ggg.Y.', '......gg........',
    ]),
    ripe: pad16([
      '.......bg.......', '.hh....bb...hh..', 'hGGhoOOoOOOohGGh', '.GoOPOOoOPOOOoG.',
      '.oOPOOoOOPOOoOo.', '.oOOOOoOOOOOoOo.', '.oOOOOoOOOOOoOo.', '.ooOOOoOOOOOooo.',
      '..ooOooOOOOooo..', '...oooooooooo...',
    ]),
    icon: [
      E16, E16, '.......gg.......', '.......bg.......', '...oOOOoOOOOo...', '..oOPOOoOPOOOo..',
      '.oOPOOoOOPOOoOo.', '.oOOOOoOOOOOoOo.', '.oOOOOoOOOOOoOo.', '.ooOOOoOOOOOooo.',
      '..ooOooOOOOooo..', '...oooooooooo...', E16, E16, E16, E16,
    ],
  },
  watermelon: {
    young: pad16(['....hG....Gh....', '.....GGggGG.....', '......gggg......', '.......gg.......']),
    grown: pad16([
      '..hh......hh....', '.hGGh....hGGh...', '.GGgGh..hGgGG...', '..gGGgggGGGg....',
      '...ggGGGGg..gGh.', '.....gggg.ggg...', '......gg........',
    ]),
    ripe: pad16([
      '.hh.........hh..', 'hGGh.......hGGh.', '.gGg.jGGjGGjGg..', '...GjGhjGGjGGj..',
      '..GGjGGjGGjGGj..', '..GGjGGjGGjGGj..', '..gGjGGjGGjGGj..', '...gjGGjGGjGg...', '....gjggjggj....',
    ]),
    icon: [
      E16, E16, E16, E16, '.pRRRRRRRRRRRRR.', '.RRkRRRRRkRRRRR.', '.RRRRRkRRRRRkRR.',
      '..RRkRRRRRkRRR..', '..xRRRRRRRRRRx..', '...xxRRRRRRxx...', '...GxxxxxxxxG...',
      '....GGxxxxGG....', '.....gGGGGg.....', E16, E16, E16,
    ],
  },
  tomato: {
    tall: true,
    young: pad24(['......h..h......', '.....hGhhGh.....', '......GGGG......', '.......gg.......', '.......gg.......']),
    grown: pad24([
      '........n.......', '......h.n.h.....', '.....hGGnGGh....', '....hGGgnGgGh...', '.....GgGnGGg....',
      '....hGGgnGGGh...', '...hGGGGnGgGGh..', '....GgGGnGGgG...', '.....GGgnGGG....', '....hGGGnGgGh...',
      '...hGgGGnGGGGh..', '....GGGgnGgGG...', '.....gGGnGGg....', '......ggngg.....', '.......gng......',
      '.......bnb......',
    ]),
    ripe: pad24([
      '........n.......', '......h.n.h.....', '.....hGGnGGh....', '....pRGgnGpRh...', '....RRgGnGRRr...',
      '....hrrgnGrrh...', '...hGGGGnGgGGh..', '...GpRGGnGGpRG..', '...GRRrgnGGRRr..', '....rrGGnGgrrh..',
      '...hGgGGnpRGGh..', '....GGGgnRRrG...', '.....gGGnrrg....', '......ggngg.....', '.......gng......',
      '.......bnb......',
    ]),
    icon: [
      E16, E16, '.......g.g......', '......gGgGg.....', '....pRRgGgRr....', '...pRpRRgRRRr...',
      '...RpRRRRRRRr...', '..RRRRRRRRRRRr..', '..RRRRRRRRRRRr..', '..RRRRRRRRRRrr..',
      '...RRRRRRRRrr...', '...rRRRRRRrrr...', '.....rrrrrr.....', E16, E16, E16,
    ],
  },
  corn: {
    tall: true,
    young: pad24(['.......h........', '......hG..h.....', '.......G.hG.....', '.......GgG......', '.......gg.......', '.......gg.......']),
    grown: pad24([
      '........h.......', '........G.......', '.......hG.......', '.......GG..h....', '..h....Gg.hG....',
      '...G...GghG.....', '....G..GgG......', '.....GhGg.......', '......GGg...h...', '.......Gg..G....',
      '..h....GghG.....', '...GG..GgG......', '.....GGGg.......', '.......Gg.......', '.......GgGh.....',
      '......hGg.GG....', '.....G.Gg...G...', '.......Gg.......', '......bggb......',
    ]),
    ripe: pad24([
      '.......Y.N......', '........YN......', '........N.......', '........G.......', '.......hG.......',
      '.......GG..h....', '..h....Gg.hG....', '...G...GgYY.....', '....G..GYZYh....', '.....GhGYYYG....',
      '......GGgYYh....', '.......Gg.hG....', '..h....GghG.....', '...GG..GgG......', '.....GGGgYY.....',
      '.......GYZYh....', '......hGgYYG....', '.....G.Gg...G...', '.......Gg.......', '......bggb......',
    ]),
    icon: [
      E16, '..........hh....', '.........hGh....', '........ZYYG....', '.......ZYZYGh...',
      '......YZYZYGh...', '.....YZYZYYG....', '....YYZYZYGh....', '....YZYZYYG.....',
      '...hGYZYYGh.....', '...GGYYYGh......', '..hGgGGGh.......', '..Gg.gG.........', E16, E16, E16,
    ],
  },
  sunflower: {
    tall: true,
    young: pad24(['......h..h......', '.....hGhhGh.....', '......GGGG......', '.......gg.......', '.......gg.......']),
    grown: pad24([
      '.......hh.......', '......hGGh......', '......GGgG......', '.......gg.......', '.......gG.......',
      '..hGG..gG.......', '.hGGGg.gG..GGh..', '..gGGggGGgGGGh..', '....gggGgGGgg...', '.......gG.......',
      '.......gGhGh....', '......hgGGGGh...', '.....hGgG.gg....', '....hGg.gG......', '.......bgb......',
    ]),
    ripe: pad24([
      '......YYYY......', '....YYZYYZYY....', '...YZYbbbbYZY...', '...YYbBnBBbYY...', '..YZYbBnnBbYZY..',
      '..YYYbBBnBbYYY..', '...YYbbBBbbYY...', '...YZYbbbbYZY...', '....YYZYYZYY....', '......YYYY......',
      '.......gG.......', '..hGG..gG.......', '.hGGGg.gG..GGh..', '..gGGggGGgGGGh..', '....gggGgGGgg...',
      '.......gG.......', '.......gGhGh....', '......hgGGGGh...', '.....hGgG.gg....', '....hGg.gG......',
      '.......bgb......',
    ]),
    icon: [
      E16, '......YYYY......', '....YYZYYZYY....', '...YZYbbbbYZY...', '...YYbBnBBbYY...',
      '..YZYbBnnBbYZY..', '..YYYbBBnBbYYY..', '...YYbbBBbbYY...', '...YZYbbbbYZY...',
      '....YYZYYZYY....', '......YYYY......', '.......gG.......', '.....hGgG.......',
      '......GgG.......', E16, E16,
    ],
  },
};

export function buildCropSprites(cropId) {
  const art = CROP_ART[cropId] || RARE_CROP_ART[cropId];
  const tall = !!art.tall;
  const o = art.overrides ? { overrides: art.overrides } : {};
  const up = (rows) => (tall ? [...blank(8), ...rows.slice(0, 16)] : rows);
  const stages = [
    sprite(tall ? up(SEED) : SEED, o),
    sprite(tall ? up(SPROUT) : SPROUT, o),
    sprite(art.young, o),
    sprite(art.grown, o),
    sprite(art.ripe, o),
  ];
  const iconRows = art.iconFrom ? CROP_ART[art.iconFrom].icon : art.icon;
  const icon = sprite(iconRows, art.iconOverrides ? { overrides: art.iconOverrides } : {});
  return { stages, icon, tall };
}

/* ------------------------------------------------------------------ */
/* Items & placeables                                                  */
/* ------------------------------------------------------------------ */

const ICONS = {
  hoe: [
    E16, '...........ss...', '..........sSSs..', '.........nsSSSs.', '........nNdsSs..',
    '.......nNn.ds...', '......nNn.......', '.....nNn........', '....nNn.........',
    '...nNn..........', '..nNn...........', '.nNn............', '.bn.............', E16, E16, E16,
  ],
  can: [
    E16, E16, '....aaaa........', '...a....a....As.', '...a....a...asa.',
    '..aAAAAAAAa.aa..', '..aCAAAAAAAaa...', '..aCAAAAAAAa....', '..aCAAAAAAAa....',
    '..aAAAAAAAAa....', '..aaAAAAAAaa....', '...aaaaaaaa.....', E16, E16, E16, E16,
  ],
  bucket: [
    E16, '.....dddddd.....', '....d......d....', '...d........d...', '..sSSSSSSSSSSs..',
    '..sSddddddddSs..', '..sSSWSSSSSSSs..', '...sSWSSSSSSs...', '...sddddddddds..',
    '...sSSSSSSSSs...', '....sSSSSSSs....', '....sSSSSSSs....', '.....ssssss.....', E16, E16, E16,
  ],
  bucket_full: [
    E16, '.....dddddd.....', '....d......d....', '...d........d...', '..sSSSSSSSSSSs..',
    '..sCcCcccCcCcs..', '..sSSWSSSSSSSs..', '...sSWSSSSSSs...', '...sddddddddds..',
    '...sSSSSSSSSs...', '....sSSSSSSs....', '....sSSSSSSs....', '.....ssssss.....', E16, E16, E16,
  ],
  shovel: [
    E16, '..........bn....', '.........bNNb...', '..........nb....', '.........nN.....',
    '........nN......', '.......nN.......', '......nN........', '....sSn.........',
    '...sSWSs........', '..sSSSSs........', '..sSSSSd........', '..sSSSd.........', '...sdd..........', E16, E16,
  ],
  sickle: [
    E16, '.....sSSSs......', '...sSWWSSSs.....', '..sSWs...sSs....', '..SWs.....sS....',
    '..Ss.......s....', '..sS............', '...sSb..........', '....bnN.........',
    '.....nNn........', '......nNn.......', '.......nNn......', '........nNb.....', '.........bb.....', E16, E16,
  ],
  fertilizer: [
    E16, E16, '.....bBBBBb.....', '......bnnb......', '.....nNNNNn.....', '....nNxxxxNn....',
    '...nNxxGGxxNn...', '...nNxGhGGxNn...', '...nNxxGgxxNn...', '...nNxxxgxxNn...',
    '...nNNNNNNNNn...', '...nnNNNNNNnn...', '....nnnnnnnn....', E16, E16, E16,
  ],
  coin: [
    E16, E16, E16, '.....yYYYy......', '....yYZZYYy.....', '...yYZYYYYYy....', '...yYZYyyYYy....',
    '...yYYYyYYYy....', '...yYYYyYYYy....', '...yYYyyyYYy....', '....yYYYYYy.....', '.....yyyyy......', E16, E16, E16, E16,
  ],
  flowerpot: [
    E16, E16, E16, E16, E16, '.....M.M.M......', '....MiMMiMM.....', '.....MYMMYM.....',
    '....hGMGGMGh....', '.....GGgGGg.....', '....oOOOOOOo....', '....oOPOOOOo....',
    '.....oOOOOo.....', '.....oOOOOo.....', '......oooo......', E16,
  ],
  gnome: [
    E16, '.......r........', '......rR........', '......RRR.......', '.....pRRRR......',
    '.....RRRRRR.....', '....RRRRRRRr....', '....wffffffw....', '....wfkffkfw....',
    '....wwfFFfww....', '....wwwwwwww....', '...UwwwwwwwwU...', '...UUwwwwwwUU...',
    '....UUUUUUUU....', '....bb....bb....', E16,
  ],
  lamp_icon: [
    E16, '......kkkk......', '.....kDDDDk.....', '....kDDDDDDk....', '.....kYZZYk.....',
    '.....kYZZYk.....', '.....kYYYYk.....', '....kDDDDDDk....', '......kDDk......',
    '.......Dk.......', '.......Dk.......', '.......Dk.......', '.......Dk.......', E16, E16, E16,
  ],
  scarecrow_icon: [
    E16, '......yyyy......', '.....yYYYYy.....', '...yyYYYYYYyy...', '.....NxxxxN.....',
    '.....xkxxkx.....', '.....xxxxxx.....', '.....NxkkxN.....', '......NNNN......',
    '..TTTTTTTTTTTT..', '.NtTTTTTTTTTTtN.', '.N.tTTTTTTTTt.N.', '....tTTTTTTt....', E16, E16, E16,
  ],
  path_icon: [
    E16, E16, E16, '...sSSs..sSs....', '..sSSSSs.SSSs...', '..sSSSSsdsSSd...', '...dsssd.dsd....',
    '....sSSs..sSSs..', '...sSSSSssSSSSs.', '...dsSSsddsSSsd.', '....dddd..dddd..', '..sSs...........',
    '..dsd...........', E16, E16, E16,
  ],
  fence_icon: [
    E16, E16, E16, '...nN......nN...', '..nNNb....nNNb..', '..nNNb....nNNb..', '.BnnnnBBBBnnnnB.',
    '.bBNNbbbbbbNNbB.', '..nNNb....nNNb..', '.BnnnnBBBBnnnnB.', '.bBNNbbbbbbNNbB.', '..nNNb....nNNb..',
    '..bbbb....bbbb..', E16, E16, E16,
  ],
};

const SPRINKLER = [
  E16, E16, E16, E16, E16,
  '....Ca....aC....',
  '....AAaCCaAA....',
  '......aAAa......',
  '......aXXa......',
  '.......aa.......',
  '.......Aa.......',
  '....dsSSSSsd....',
  '...dsSWSSSSsd...',
  '...dssssssssd...',
  '....dddddddd....',
  E16,
];
export const SPRINKLER_TIERS = [
  { A: PAL.O, a: PAL.o, C: PAL.P, X: PAL.G },
  { A: PAL.S, a: PAL.s, C: PAL.W, X: PAL.c },
  { A: PAL.Y, a: PAL.y, C: PAL.Z, X: PAL.R },
];

const LAMP = [
  E16, '......kkkk......', '.....kDDDDk.....', '....kDDDDDDk....', '.....kYZZYk.....', '.....kYZZYk.....',
  '.....kYYYYk.....', '....kDDDDDDk....', '......kDDk......',
  ...Array(18).fill('.......Dk.......'),
  '......kDDk......', '.....kDDDDk.....', '....kDDDDDDk....', E16,
];
const SCARECROW = [
  E16, '......yyyy......', '.....yYYYYy.....', '...yyYYYYYYyy...', '.....NxxxxN.....', '.....xkxxkx.....',
  '.....xxxxxx.....', '.....NxkkxN.....', '......NNNN......', '..TTTTTTTTTTTT..', '.NtTTTTTTTTTTtN.',
  '.N.tTTTTTTTTt.N.', '....tTTTTTTt....', '....tTTTTTTt....', '.....EEEEEE.....', '.....EEIIEE.....',
  ...Array(9).fill('.......nb.......'),
  '......bnnb......', E16,
];
const SCARECROW_COLORS = { T: '#c84a4a', t: '#8a3040', E: '#5a6ab0', I: '#3a4880' };

export function buildItemSprites() {
  const out = {};
  for (const [k, rows] of Object.entries(ICONS)) {
    out[k] = sprite(rows, k === 'scarecrow_icon' ? { overrides: SCARECROW_COLORS } : {});
  }
  out.sprinklers = SPRINKLER_TIERS.map((o) => sprite(SPRINKLER, { overrides: o }));
  out.lamp = sprite(LAMP, { outline: false });
  out.scarecrow = sprite(SCARECROW, { overrides: SCARECROW_COLORS });
  return out;
}

// Procedural seed packet in a crop's colours.
export function buildSeedPacket(colors) {
  const p = new Painter(16, 16);
  const [main, dark, light] = colors.map(hexToRgb);
  const paper = hexToRgb('#f2e2bc'), paperD = hexToRgb('#d8be8a'), fold = hexToRgb('#c8a670');
  // packet body
  p.rect(3, 2, 10, 12, paper);
  p.rect(3, 2, 10, 2, fold);
  for (let x = 3; x < 13; x += 2) p.set(x, 2, paperD);
  p.vline(12, 4, 13, paperD);
  p.hline(3, 12, 13, paperD);
  // label circle
  const cx = 7.5, cy = 8.5;
  for (let y = 5; y < 13; y++)
    for (let x = 4; x < 12; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d < 3.6) p.set(x, y, d < 2.2 && x < cx && y < cy ? light : x + y > cx + cy + 1 ? dark : main);
    }
  // leaf sprout
  p.set(8, 4, '#4fa64a'); p.set(9, 4, '#8fd65a'); p.set(8, 5, '#2f7a3e');
  return p.finish(true);
}

/* ------------------------------------------------------------------ */
/* Cursor hands, basket, weeds                                         */
/* ------------------------------------------------------------------ */

const HAND_OPEN = [
  '....f.f.f.....',
  '...fFfFfFf....',
  '...fFfFfFf.f..',
  '...fFfFfFffF..',
  '...fffffffff..',
  'ff.ffffffffF..',
  'fFfffffffffF..',
  '.fffffffffF...',
  '..ffffffffF...',
  '..fffffffF....',
  '...ffffffF....',
  '....FFFFF.....',
];
const HAND_GRAB = [
  E16.slice(0, 14),
  E16.slice(0, 14),
  E16.slice(0, 14),
  '....fFfFfF....',
  '...fffffffff..',
  '..ffffffffff..',
  '.ffffffffffF..',
  '.fffffffffF...',
  '..ffffffffF...',
  '..fffffffF....',
  '...ffffffF....',
  '....FFFFF.....',
];
const HAND_POINT = [
  '...ff.........',
  '..fffF........',
  '..fffF........',
  '..fffF........',
  '..ffffFfF.....',
  '..fffffffFf...',
  'f.ffffffffff..',
  'fffffffffffF..',
  '.ffffffffffF..',
  '..fffffffffF..',
  '...ffffffff...',
  '....FFFFFF....',
];
const BASKET = [
  E16, E16,
  '.....bBBBBb.....',
  '....b......b....',
  '....b......b....',
  '..bnNnNnNnNnNb..',
  '..BNnNnNnNnNnB..',
  '..bnNnNnNnNnNb..',
  '...BNnNnNnNnB...',
  '...bnNnNnNnNb...',
  '....BBBBBBBB....',
  E16, E16, E16, E16, E16,
];
const WEEDS = [
  ['...Y.....', '..YZY.h..', '...Y.hG..', '.h.G.Gg..', '.GhGhG...', 'gGgGgGg..'],
  ['.h...h...', 'hGh.hGh..', '.GgGgG...', '..gGg.h..', '.hGgGhG..', '.gGgGg...'],
  ['..h.h.h..', '.hG.G.Gh.', '.G.gGg.G.', '..gGgGg..', '.gjgjgjg.'],
];

export function buildCursorSprites() {
  const o = { outlineStrength: 0.78 };
  return {
    open: sprite(HAND_OPEN, o), grab: sprite(HAND_GRAB, o), point: sprite(HAND_POINT, o),
    basket: sprite(BASKET),
    weeds: WEEDS.map((w) => sprite(w, { outlineStrength: 0.5 })),
  };
}

/* ------------------------------------------------------------------ */
/* Pond fish (facing right)                                            */
/* ------------------------------------------------------------------ */

const FISH = ['A..AAA..', 'AAAAXAkA', 'A..AAA..'];
const FISH_SMALL = ['A.AA..', 'AAAXk.', 'A.AA..'];
export function buildFish() {
  const kinds = [
    { A: '#f08a2c', X: '#ffffff' }, // koi
    { A: '#f5f1e7', X: '#e04a4a' }, // white koi with a red spot
    { A: '#f5c030', X: '#fff3a0' }, // goldfish
    { A: '#6a8ab0', X: '#a8c8e8' }, // carp
  ];
  return [
    ...kinds.map((o) => sprite(FISH, { overrides: o, outlineStrength: 0.5 })),
    sprite(FISH_SMALL, { overrides: { A: '#8ac4f0', X: '#d4efff' }, outlineStrength: 0.5 }),
  ];
}
