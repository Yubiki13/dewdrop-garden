// Art for the 20 "rare" expansion crops.
// Each plant is built from an archetype (bush, vine, flower...) and its own fruit sprite stamped onto
// the ripe stage at the archetype's anchor points. Fruit/icon rows use placeholder colours that each
// crop overrides: A = main, a = shadow, L = highlight, X = accent. Leaves (G g h j) can be recoloured too.

const E = '................';
const blank = (n) => Array(n).fill(E);
const pad16 = (rows) => [...blank(14 - rows.length), ...rows, E, E];
const pad24 = (rows) => [...blank(22 - rows.length), ...rows, E, E];

/** Paint `fruit` rows over `base` rows with the fruit's top-left at (x, y). */
function stamp(base, fruit, x, y) {
  const out = base.slice();
  fruit.forEach((fr, j) => {
    const r = y + j;
    if (r < 0 || r >= out.length) return;
    const row = out[r].split('');
    for (let i = 0; i < fr.length; i++) if (fr[i] !== '.' && x + i >= 0 && x + i < 16) row[x + i] = fr[i];
    out[r] = row.join('');
  });
  return out;
}
const stampAll = (base, fruit, anchors) => anchors.reduce((rows, [x, y]) => stamp(rows, fruit, x, y), base);

/* ---------------------------- plant archetypes ---------------------------- */

const ARCH = {
  root: {
    young: pad16(['.....h...h......', '....hGh.hGh.....', '.....GgGgG......', '.......gg.......']),
    grown: pad16([
      '...h.hh..hh.h...', '..hGhGGhhGGhGh..', '..GGgGGgGGgGGG..', '...GgGGgGGgGg...',
      '....gGgGgGgg....', '.....gggggg.....', '......gggg......', '.......gg.......',
    ]),
    anchors: [[5, 9]],
  },
  bush: {
    young: pad16(['.....hG..Gh.....', '.....GGggGG.....', '......gGGg......', '.......gg.......']),
    grown: pad16([
      '......hhhh......', '....hhGGGGhh....', '...hGGGgGGGGh...', '..hGGgGGGGgGGh..', '..GGGGGgGGGGGG..',
      '..gGgGGGGGgGGg..', '...gGGgGGGGGg...', '....ggGggGgg....', '......bBBb......',
    ]),
    anchors: [[4, 7], [9, 6], [6, 10], [11, 9], [2, 10]],
  },
  rosette: {
    young: pad16(['....h......h....', '.....hGhhGh.....', '......GggG......', '.......gg.......']),
    grown: pad16([
      '..h..........h..', '.hGh..hhhh..hGh.', '..GGhhGGGGhhGG..', '.hGgGGGggGGGgGh.',
      '.GGgGgGGGGgGgGG.', '..gGGgGggGgGGg..', '....ggGggGgg....', '......gggg......',
    ]),
    anchors: [[5, 5]],
  },
  vine: {
    young: pad16(['....hG....Gh....', '.....GGggGG.....', '......gggg......', '.......gg.......']),
    grown: pad16([
      '..hh......hh....', '.hGGh....hGGh...', '.GGgGh..hGgGG...', '..gGGgggGGGg....',
      '...ggGGGGg..gGh.', '.....gggg.ggg...', '......gg........',
    ]),
    anchors: [[3, 6]],
  },
  trellis: {
    tall: true,
    young: pad24(['.....n.....n....', '.....n.h...n....', '.....nhGh..n....', '.....n.G...n....', '....bnbgg.bnb...']),
    grown: pad24([
      '.....nnnnnnn....', '....hn.....nh...', '...hGn.....nGh..', '...GGnh...hnGG..', '..hGgn.....ngGh.',
      '...GGnGh.hGnGG..', '..hGgn.....nGg..', '...GGnhG.GhnGG..', '..hGgn.....ngGh.', '...gGn.....nGg..',
      '....gnh...hng...', '.....n.....n....', '.....n.....n....', '....bnb...bnb...',
    ]),
    anchors: [[1, 12], [10, 13], [2, 17], [11, 17]],
  },
  cactus: {
    young: pad16(['......hh........', '......GG..h.....', '......Gg.hG.....', '......gG.Gg.....', '......bBBb......']),
    grown: pad16([
      '.......hh.......', '......hGGh......', '..hh..GGgG..hh..', '.hGGh.GgGG.hGGh.', '.GgGG.GGgG.GgGG.',
      '.GGgGhGgGGhGGgG.', '..GGgGGGgGGgGG..', '....gGGgGGGg....', '......gGGg......', '......bBBb......',
    ]),
    anchors: [[1, 2], [6, 0], [11, 2]],
  },
  flower: {
    tall: true,
    young: pad24(['......h..h......', '.....hGhhGh.....', '......GGGG......', '.......gg.......', '.......gg.......']),
    grown: pad24([
      '.......hh.......', '......hGGh......', '......gGGg......', '.......gG.......', '.......gG.......',
      '..hGG..gG.......', '.hGGGg.gG..GGh..', '..gGGggGGgGGGh..', '....gggGgGGgg...', '.......gG.......',
      '.......gGhGh....', '......hgGGGGh...', '.....hGgG.gg....', '....hGg.gG......', '.......bgb......',
    ]),
    anchors: [[3, 4]],
  },
};

/* ---------------------------- fruit sprites ---------------------------- */

const F = {
  bulb: ['.LAAa.', 'LAAAAa', 'AAAAaa', '.aAaa.', '..aa..'],
  pepper: ['.g.', 'LAA', 'AAA', 'aAa'],
  eggplant: ['.g.', 'LA.', 'AAa', 'AAa', '.a.'],
  chili: ['g.', 'AL', 'Aa', '.a'],
  berry: ['LA', 'Aa'],
  bean: ['LA', 'aX'],
  star: ['..A..', '.LAA.', 'AAAAa', '.AAa.', '.a.a.'],
  crystal: ['.L.', 'LAa', '.a.'],
  orb: ['LAA', 'AAa', '.a.'],
  cauli: ['.wWWw.', 'wWwWWw', 'WwWWwW', '.wwww.'],
  pineapple: ['..hh..', '.hGGh.', '..gg..', '.LAAa.', 'LAaAAa', 'AAaAaa', 'AaAAaa', '.AaAa.', '..aa..'],
  melon: ['...gg.....', '..LAAAAa..', '.LAXAXAXa.', 'LAXAXAXAaa', 'AAXAXAXAaa', 'AXAXAXAaaa', '.aAXAXAaa.', '..aaaaaa..'],
  pumpkin: ['....bg....', '..aAAaAAa.', '.aLAAaALAa', 'aLAAaAALAa', 'aAAAaAAAAa', 'aAAAaAAAaa', '.aAAaAAaa.', '..aaaaaa..'],
  grapes: ['LAA.', 'AAaA', '.AAa', '.Aa.'],
  dragon: ['h.h.', 'LAAh', 'AAaA', 'hAa.', '.a..'],
  rose: ['...RRYY...', '..RRRYYY..', '.MMRpYOGG.', '.MMpppOGG.', '.VVlpplUU.', '..VVlUUU..', '...VVUU...', '....gg....'],
  moon: ['....CC....', '..C.CC.C..', '.CWCCCCWC.', '..CWZZWC..', '.CCWZZWCC.', '..CWCCWC..', '.C..CC..C.', '....gg....'],
  firelily: ['.R......R.', '.RO....OR.', '..ROPPOR..', '...OYYO...', '..ROYYOR..', '.RO.OO.OR.', '.R..gg..R.', '....gg....'],
  dewlily: ['....CW....', '...cCWC...', '.c.CWWC.c.', 'cCCcWWcCCc', '.cCCUUCCc.', '..cCUUCc..', '...cggc...', '....gg....'],
};

/* ---------------------------- icons ---------------------------- */

const ICON = {
  beet: [E, E, '......h..h......', '.....hGhhGh.....', '......GgGg......', '.......gg.......', '.....LAAAa......', '....LAAAAAa.....',
    '....AAAAAAa.....', '....AAAAAaa.....', '.....AAAaa......', '......aaa.......', '.......a........', '.......a........', E, E],
  pepper: [E, '.......g........', '......gg........', '....LAAgAAa.....', '...LAAAAAAAa....', '...AAAAAAAAa....', '...AAAAAAAaa....',
    '...AAAAAAAaa....', '....AAAAAaa.....', '....AaAAaAa.....', '.....a..a.......', E, E, E, E, E],
  eggplant: [E, '..........gg....', '.........gGgg...', '........LAgg....', '.......LAAa.....', '......LAAAa.....', '.....LAAAAa.....',
    '....LAAAAaa.....', '...LAAAAAa......', '...AAAAAaa......', '...AAAAaa.......', '....aaaa........', E, E, E, E],
  chili: [E, '.........gg.....', '........gG......', '.......LAa......', '.......AAa......', '......LAAa......', '......AAa.......',
    '.....LAAa.......', '....LAAa........', '...LAAa.........', '..AAa...........', '.Aa.............', E, E, E, E],
  pineapple: ['......h..h......', '.....hGhhGh.....', '......hGGh......', '.....hGggGh.....', '......LAAa......', '.....LAaAAa.....',
    '....LAaAaAAa....', '....AaAaAaAa....', '....AAaAaAaa....', '....aAaAaAaa....', '.....aAaAaa.....', '......aaaa......', E, E, E, E],
  cauli: [E, E, '....wWWwWWw.....', '...wWWwWWwWw....', '..wWwWWwWWwWw...', '..WWwWWwWwWWw...', '..hwWwWWwWWwh...',
    '.hGhwwwwwwwhGh..', '.GGGhGGhGGhGGG..', '..gGGgGGgGGgg...', '....gggggggg....', E, E, E, E, E],
  grapes: [E, '.......nh.......', '......n.hGh.....', '....LAALAA......', '...LAAaAAaA.....', '...AAaLAALAa....', '....AaAAaAAa....',
    '.....LAALAa.....', '.....AAaAAa.....', '......AaAa......', '.......Aa.......', E, E, E, E, E],
  cranberry: [E, E, '.........hG.....', '........hg......', '....LA..g.LA....', '...LAAa.gLAAa...', '...AAAa.gAAAa...',
    '....aa.LAaaa....', '......LAAa......', '......AAAa......', '.......aa.......', E, E, E, E, E],
  coffee: [E, '....LAAa........', '...LAXAAa.......', '...AAXAAa.......', '...AAXAaa.LAAa..', '....AXaa.LAXAAa.', '.....aa..AAXAAa.',
    '.........AAXAaa.', '..........AXaa..', '...........aa...', E, E, E, E, E, E],
  melon: [E, '.......gg.......', '.....LAAAAa.....', '....LXAXAXAa....', '...LAXAXAXAaa...', '...AXAXAXAXaa...', '...AAXAXAXAaa...',
    '...AXAXAXAaaa...', '....aAXAXAaa....', '.....aaaaaa.....', E, E, E, E, E, E],
  dragon: ['......h...h.....', '.......hhh......', '....h.LAAa.h....', '.....LAAAAa.....', '....hAAhAAAh....', '....LAAAAAAa....',
    '....AAhAAAha....', '....hAAAAAaa....', '.....aAAhaa.....', '......aaaa......', E, E, E, E, E, E],
  star: [E, '.......L........', '......LAa.......', '.....LAAAa......', '.LLLLAAAAAaaaa..', '..LAAAAAAAAAa...', '...LAAAAAAAa....',
    '....AAAAAAaa....', '....AAAaAAAa....', '...AAa...aAAa...', '...Aa.....aAa...', '..a.........a...', E, E, E, E],
  crystal: [E, '......L.........', '.....LAa..L.....', '....LAAAaLAa....', '.....aAa.LAAa...', '..L...a...aAa...', '.LAa..L....a....',
    'LAAAaLAa........', '.aAa.LAAa.......', '..a...aAa.......', '.......a........', E, E, E, E, E],
  orb: [E, '........hG......', '.......hGg......', '.....LLAg.......', '....LAAAAAa.....', '...LAAXAAAAa....', '...AAXAAAAAa....',
    '...AAAAAAAaa....', '...AAAAAAaaa....', '....aAAAaaa.....', '.....aaaaa......', E, E, E, E, E],
};
// flower icons: the bloom on a little stem
const STEM = [E, E, E, E, E, E, E, E, E, '.......gG.......', '.....hGgG.......', '......GgGh......', '.......gGGh.....', '.......gG.......', E, E];
const flowerIcon = (bloom) => stamp(STEM, bloom, 3, 2);

/* ---------------------------- the 20 rare crops ---------------------------- */

const LEAF_ICE = { G: '#6ab4c8', g: '#3a7a90', h: '#b8f0ff', j: '#1e4a5a' };
const LEAF_TEAL = { G: '#3a9a7a', g: '#226a56', h: '#7ad8b0', j: '#12402e' };
const LEAF_DARK = { G: '#3a8a3e', g: '#1f5a2e', h: '#6ab85a', j: '#123a22' };
const LEAF_CACTUS = { G: '#4ab87a', g: '#2a7a50', h: '#8ae0a8', j: '#185a38' };
const LEAF_MOON = { G: '#4a8a8a', g: '#2a5a62', h: '#8ac8c0', j: '#163a40' };

const SPECS = {
  beetroot:     { arch: 'root', fruit: 'bulb', icon: 'beet', c: { A: '#a8285a', a: '#6a1838', L: '#e06090' } },
  cauliflower:  { arch: 'rosette', fruit: 'cauli', icon: 'cauli', c: {} },
  bellpepper:   { arch: 'bush', fruit: 'pepper', n: 3, icon: 'pepper', c: { A: '#e04a4a', a: '#9e2a3a', L: '#ff8c82' } },
  eggplant:     { arch: 'bush', fruit: 'eggplant', n: 3, icon: 'eggplant', c: { A: '#5a3a9a', a: '#3a2066', L: '#9a7ad8' } },
  chili:        { arch: 'bush', fruit: 'chili', n: 5, icon: 'chili', c: { A: '#ff3b30', a: '#b81e2a', L: '#ff9a80' }, leaf: LEAF_DARK },
  pineapple:    { arch: 'rosette', fruit: 'pineapple', at: [[5, 1]], icon: 'pineapple', c: { A: '#f0b030', a: '#a8701e', L: '#ffe080' } },
  grapes:       { arch: 'trellis', fruit: 'grapes', icon: 'grapes', c: { A: '#7a52c0', a: '#4a2f7a', L: '#b89af0' } },
  cranberry:    { arch: 'bush', fruit: 'berry', n: 5, icon: 'cranberry', c: { A: '#c8203a', a: '#801028', L: '#ff7080' }, leaf: LEAF_DARK },
  coffee:       { arch: 'bush', fruit: 'berry', n: 5, icon: 'coffee', c: { A: '#c8402a', a: '#7a2018', L: '#f08a60' }, iconC: { A: '#8a5a3a', a: '#5a3420', L: '#b8845a', X: '#3a2014' }, leaf: LEAF_DARK },
  cantaloupe:   { arch: 'vine', fruit: 'melon', icon: 'melon', c: { A: '#e8c078', a: '#b08848', L: '#fff0c0', X: '#f8e8b8' } },
  dragonfruit:  { arch: 'cactus', fruit: 'dragon', icon: 'dragon', c: { A: '#f04a9a', a: '#a82a6a', L: '#ff9ad0' }, leaf: LEAF_CACTUS },
  starfruit:    { arch: 'bush', fruit: 'star', n: 3, icon: 'star', c: { A: '#f5d44a', a: '#c98f22', L: '#fff3a0' } },
  rainbowrose:  { arch: 'flower', fruit: 'rose', icon: 'flower', c: {} },
  moonflower:   { arch: 'flower', fruit: 'moon', icon: 'flower', c: {}, leaf: LEAF_MOON },
  goldpumpkin:  { arch: 'vine', fruit: 'pumpkin', iconFrom: 'pumpkin', iconC: { o: '#c98f22', O: '#f5d44a', P: '#fff3a0' }, c: { A: '#f5d44a', a: '#c98f22', L: '#fff3a0' } },
  crystalberry: { arch: 'bush', fruit: 'crystal', n: 4, icon: 'crystal', c: { A: '#8ad8f8', a: '#4a8ac8', L: '#ffffff' }, leaf: LEAF_ICE },
  ancientfruit: { arch: 'bush', fruit: 'orb', n: 3, icon: 'orb', c: { A: '#3ac0b0', a: '#1e7a78', L: '#b8fff0', X: '#ffffff' }, leaf: LEAF_TEAL },
  firelily:     { arch: 'flower', fruit: 'firelily', icon: 'flower', c: {}, leaf: LEAF_DARK },
  frostmelon:   { arch: 'vine', fruit: 'melon', icon: 'melon', c: { A: '#a8e8ff', a: '#5aa8d8', L: '#ffffff', X: '#6ac0e8' }, leaf: LEAF_ICE },
  dewdroplily:  { arch: 'flower', fruit: 'dewlily', icon: 'flower', c: {}, leaf: LEAF_MOON },
};

export const RARE_CROP_ART = {};
for (const [id, s] of Object.entries(SPECS)) {
  const A = ARCH[s.arch];
  const fruit = F[s.fruit];
  const anchors = s.at || (s.n ? A.anchors.slice(0, s.n) : A.anchors);
  const overrides = { ...(s.leaf || {}), ...s.c };
  RARE_CROP_ART[id] = {
    tall: !!A.tall,
    young: A.young,
    grown: A.grown,
    ripe: stampAll(A.grown, fruit, anchors),
    icon: s.icon === 'flower' ? flowerIcon(fruit) : s.icon ? ICON[s.icon] : null,
    iconFrom: s.iconFrom,
    overrides,
    iconOverrides: { ...(s.leaf || {}), ...s.c, ...(s.iconC || {}) },
  };
}
