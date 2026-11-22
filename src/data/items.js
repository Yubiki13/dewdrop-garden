// Every item in the game. Icons are resolved at runtime from the art cache (see art/index.js).
import { CROPS } from './crops.js';

export const ITEMS = {
  hoe:        { name: 'Hoe', kind: 'tool', icon: 'hoe', desc: 'Tills grass into soil you can plant in.' },
  can:        { name: 'Watering Can', kind: 'tool', icon: 'can', capacity: 30, desc: 'Waters one tile. Refill at the pond or well.' },
  bucket:     { name: 'Water Bucket', kind: 'tool', icon: 'bucket', capacity: 5, price: 150, desc: 'Splashes a 3×3 area! Holds 5 splashes.' },
  shovel:     { name: 'Shovel', kind: 'tool', icon: 'shovel', desc: 'Digs up plants, placed items and paths. Turns soil back into grass.' },
  sickle:     { name: 'Sickle', kind: 'tool', icon: 'sickle', price: 200, desc: 'Harvests every ripe crop in a 3×3 area.' },
  fertilizer: { name: 'Fertilizer', kind: 'use', icon: 'fertilizer', price: 12, desc: 'Sprinkle on soil to make crops grow 50% faster.' },
  sprinkler:  { name: 'Sprinkler', kind: 'place', icon: 'sprinkler0', place: 'sprinkler', tier: 0, price: 100, desc: 'Waters the 4 tiles next to it every morning.' },
  sprinkler2: { name: 'Quality Sprinkler', kind: 'place', icon: 'sprinkler1', place: 'sprinkler', tier: 1, price: 260, desc: 'Waters all 8 surrounding tiles every morning.' },
  sprinkler3: { name: 'Deluxe Sprinkler', kind: 'place', icon: 'sprinkler2', place: 'sprinkler', tier: 2, price: 600, desc: 'Waters a big 5×5 area every morning.' },
  fence:      { name: 'Wood Fence', kind: 'place', icon: 'fence_icon', place: 'fence', price: 4, desc: 'Connects to neighbouring fences.' },
  path:       { name: 'Stone Path', kind: 'place', icon: 'path_icon', place: 'path', price: 3, desc: 'Lay down a cozy cobblestone path.' },
  lamp:       { name: 'Lamp Post', kind: 'place', icon: 'lamp_icon', place: 'lamp', price: 120, desc: 'Glows warmly at night.' },
  scarecrow:  { name: 'Scarecrow', kind: 'place', icon: 'scarecrow_icon', place: 'scarecrow', price: 80, desc: 'Keeps an eye on things. Mostly decorative.' },
  gnome:      { name: 'Garden Gnome', kind: 'place', icon: 'gnome', place: 'gnome', price: 150, desc: 'A tiny friend for your garden.' },
  flowerpot:  { name: 'Flower Pot', kind: 'place', icon: 'flowerpot', place: 'flowerpot', price: 40, desc: 'Pretty pink blooms in a clay pot.' },
};

for (const [id, c] of Object.entries(CROPS)) {
  ITEMS['seed_' + id] = {
    name: c.name + ' Seeds', kind: 'seed', crop: id, icon: 'seed_' + id, price: c.seedPrice,
    desc: `${c.desc} Ripens after ${c.hours}h of wet soil.${c.regrow ? ` Regrows every ${c.regrow}h.` : ''}`,
  };
  ITEMS[id] = { name: c.name, kind: 'produce', icon: 'crop_' + id, sell: c.sell, desc: `Sells for ${c.sell} coins.` };
}

export const STACK_MAX = 99;

export const SHOP_SEEDS = Object.keys(CROPS).map((id) => 'seed_' + id);
export const SHOP_GOODS = ['fertilizer', 'bucket', 'sickle', 'sprinkler', 'sprinkler2', 'sprinkler3', 'path', 'fence', 'flowerpot', 'lamp', 'scarecrow', 'gnome'];

export function isStackable(id) {
  return ITEMS[id] && ITEMS[id].kind !== 'tool';
}
