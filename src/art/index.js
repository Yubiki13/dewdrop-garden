// Builds and caches every sprite once at boot.
import { buildCharacter, buildGranny, buildCropSprites, buildItemSprites, buildSeedPacket, buildCursorSprites, buildFish } from './sprites.js';
import {
  makeTree, makeBush, makeRock, makeStump, makeHouse, makeStall, makeStallSign, makeWell, makeBin, makeSign,
  makeLilyPad, makeReeds, makeDeco, makeButterfly, makeFence, makeCrate, makeGate,
} from './procedural.js';
import { CROPS } from '../data/crops.js';
import { buildExpansionArt, buildSaplings, makeWishWell, makeWindmill, TREE_KINDS } from './expansion.js';
import { sprite as spr } from './palette.js';
import { ITEMS } from '../data/items.js';

export const ART = {};

const GNOME_ROWS = [
  '................', '.......r........', '......rR........', '......RRR.......', '.....pRRRR......',
  '.....RRRRRR.....', '....RRRRRRRr....', '....wffffffw....', '....wfkffkfw....',
  '....wwfFFfww....', '....wwwwwwww....', '...UwwwwwwwwU...', '...UUwwwwwwUU...',
  '....UUUUUUUU....', '....bb....bb....', '................',
];
// tree fruit icons reuse the round-fruit icon in each fruit's colours
const ORB_ICON = ['................', '................', '........hG......', '.......hGg......', '.....LLAg.......', '....LAAAAAa.....',
  '...LAAXAAAAa....', '...AAXAAAAAa....', '...AAAAAAAaa....', '...AAAAAAaaa....', '....aAAAaaa.....', '.....aaaaa......',
  '................', '................', '................', '................'];
function recolorOrb(t) {
  return spr(ORB_ICON, { overrides: { A: t.fruit, a: t.dark, L: t.light, X: '#ffffff' } });
}

export function buildArt() {
  ART.crops = {};
  ART.icons = {};
  for (const id of Object.keys(CROPS)) {
    ART.crops[id] = buildCropSprites(id);
    ART.icons['crop_' + id] = ART.crops[id].icon;
    ART.icons['seed_' + id] = buildSeedPacket(CROPS[id].colors);
  }
  const items = buildItemSprites();
  Object.assign(ART.icons, items);
  items.sprinklers.forEach((s, i) => (ART.icons['sprinkler' + i] = s));
  ART.sprinklers = items.sprinklers;
  ART.lamp = items.lamp;
  ART.scarecrow = items.scarecrow;

  ART.granny = buildGranny();
  ART.merchant = buildCharacter({ y: '#2f7a3e', Y: '#4fa64a', Z: '#8fd65a', r: '#f6f1e7', H: '#2e2430', e: '#17111a', T: '#e0b27a', t: '#b07a4a' });

  ART.trees = {
    oak: [1, 2, 3, 4, 5, 6].map((s) => makeTree('oak', s * 101)),
    cherry: [1, 2, 3].map((s) => makeTree('cherry', s * 57)),
    maple: [1, 2].map((s) => makeTree('maple', s * 77)),
    pine: [1, 2, 3, 4].map((s) => makeTree('pine', s * 33)),
  };
  ART.bushes = [makeBush(1), makeBush(2, 'berry'), makeBush(3, 'white'), makeBush(4), makeBush(5, 'blue')];
  ART.rocks = [makeRock(1), makeRock(2), makeRock(3, true), makeRock(4)];
  ART.stump = makeStump();
  ART.house = makeHouse();
  ART.stall = makeStall();
  ART.stallSign = makeStallSign();
  ART.well = makeWell();
  ART.bin = makeBin();
  ART.sign = makeSign();
  ART.lily = [makeLilyPad(false), makeLilyPad(true)];
  ART.reeds = [makeReeds(1), makeReeds(2), makeReeds(3)];
  ART.deco = makeDeco();
  ART.butterflies = [
    ['M', 'i'], ['Y', 'Z'], ['c', 'C'], ['w', 'S'], ['O', 'P'],
  ].map(([a, b]) => makeButterfly(a, b));
  ART.cursor = buildCursorSprites();
  ART.icons.hand = ART.cursor.open;
  ART.icons.basket = ART.cursor.basket;
  ART.weeds = ART.cursor.weeds;
  ART.crate = makeCrate(false);
  ART.giftCrate = makeCrate(true);
  ART.gate = { closed: makeGate(false), open: makeGate(true) };
  ART.fish = buildFish();
  // ---- v1.2 expansion ----
  const X = (ART.x = buildExpansionArt());
  Object.assign(ART.icons, {
    goldhoe: X.goldhoe, goldcan: X.goldcan, net: X.net, honey: X.honey, wildhoney: X.wildhoney, beehive: X.beehive,
    bench: X.bench, birdbath: X.birdbath, campfire: X.campfire, haybale: X.haybale, statue: X.statue, mushroomlog: X.mushroomlog,
    jackolantern: X.jackolantern, stonelantern: X.stonelantern, picnic: X.picnic, sundial: X.sundial, letter: X.letter,
  });
  for (const [k, f] of Object.entries(X.fish)) ART.icons['fish_' + k] = f;
  ART.saplings = buildSaplings();
  for (const [k, t] of Object.entries(TREE_KINDS)) {
    ART.icons['sapling_' + k] = ART.saplings[k];
    ART.icons['fruit_' + k] = recolorOrb(t);
  }
  ART.goldgnome = spr(GNOME_ROWS, { overrides: { r: '#c98f22', R: '#f5d44a', p: '#fff3a0', U: '#c98f22', w: '#fff3a0' } });
  ART.icons.goldgnome = ART.goldgnome;
  ART.wishwell = makeWishWell();
  ART.windmill = makeWindmill();
  ART.fences = [];
  for (let m = 0; m < 16; m++) ART.fences.push(makeFence(m));
  return ART;
}

const urlCache = {};
/** data: URL of an item's icon at native resolution (scaled up by CSS). */
export function iconURL(itemId, variant) {
  const def = ITEMS[itemId];
  if (!def) return '';
  const key = variant ? def.icon + '_' + variant : def.icon;
  if (urlCache[key]) return urlCache[key];
  const spr = ART.icons[key] || ART.icons[def.icon];
  if (!spr) return '';
  return (urlCache[key] = spr.img.toDataURL());
}
export function spriteURL(spr) {
  if (!spr) return '';
  if (!spr._url) spr._url = spr.img.toDataURL();
  return spr._url;
}
