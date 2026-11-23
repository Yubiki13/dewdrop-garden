// Builds and caches every sprite once at boot.
import { buildCharacter, buildGranny, buildCropSprites, buildItemSprites, buildSeedPacket, buildCursorSprites, buildFish } from './sprites.js';
import {
  makeTree, makeBush, makeRock, makeStump, makeHouse, makeStall, makeStallSign, makeWell, makeBin, makeSign,
  makeLilyPad, makeReeds, makeDeco, makeButterfly, makeFence, makeCrate, makeGate,
} from './procedural.js';
import { CROPS } from '../data/crops.js';
import { ITEMS } from '../data/items.js';

export const ART = {};

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
