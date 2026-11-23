// Every item in the game. Icons are resolved at runtime from the art cache (see art/index.js).
import { CROPS } from './crops.js';
import { MATERIALS, WILD_ONLY } from './tools.js';

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
    name: c.seedName || c.name + ' Seeds', kind: 'seed', crop: id, icon: 'seed_' + id, price: c.seedPrice,
    desc: `${c.desc} Ripens after ${c.hours}h of wet soil.${c.regrow ? ` Regrows every ${c.regrow}h.` : ''}`,
  };
  ITEMS[id] = { name: c.name, kind: 'produce', icon: 'crop_' + id, sell: c.sell, desc: `Sells for ${c.sell} coins.` };
}

// ---- v1.2 expansion items ----
Object.assign(ITEMS, {
  goldhoe:   { name: 'Golden Hoe', kind: 'tool', icon: 'goldhoe', price: 25000, desc: 'Tills a whole 3×3 patch with every swing.' },
  goldcan:   { name: 'Golden Watering Can', kind: 'tool', icon: 'goldcan', capacity: 150, price: 15000, desc: 'Holds 150 splashes and waters a 3×3 patch.' },
  net:       { name: 'Fishing Net', kind: 'tool', icon: 'net', price: 400, desc: 'Click a fish in the water to scoop it up.' },
  sprinkler4: { name: 'Rainbow Sprinkler', kind: 'place', icon: 'sprinkler3', place: 'sprinkler', tier: 3, price: 12000, desc: 'Waters a huge 7×7 area every morning.' },
  beehive:   { name: 'Beehive', kind: 'place', icon: 'beehive', place: 'beehive', price: 2500, desc: 'Makes a jar of honey every day. Flowers nearby make Wildflower Honey!' },
  bench:     { name: 'Garden Bench', kind: 'place', icon: 'bench', place: 'bench', price: 300, desc: 'A nice spot to sit and watch things grow.' },
  birdbath:  { name: 'Birdbath', kind: 'place', icon: 'birdbath', place: 'birdbath', price: 600, desc: 'Little birds stop by for a splash.' },
  campfire:  { name: 'Campfire', kind: 'place', icon: 'campfire', place: 'campfire', price: 800, desc: 'Crackles and glows. Click it to light or put it out.' },
  haybale:   { name: 'Hay Bale', kind: 'place', icon: 'haybale', place: 'haybale', price: 150, desc: 'Rustic and cozy.' },
  statue:    { name: 'Owl Statue', kind: 'place', icon: 'statue', place: 'statue', price: 3000, desc: 'A wise stone owl keeps watch.' },
  mushroomlog: { name: 'Mushroom Log', kind: 'place', icon: 'mushroomlog', place: 'mushroomlog', price: 250, desc: 'An old log with tiny mushrooms.' },
  jackolantern: { name: 'Jack-o\'-Lantern', kind: 'place', icon: 'jackolantern', place: 'jackolantern', price: 500, desc: 'Glows with a spooky grin at night.' },
  stonelantern: { name: 'Stone Lantern', kind: 'place', icon: 'stonelantern', place: 'stonelantern', price: 1200, desc: 'A calm light for evening walks.' },
  picnic:    { name: 'Picnic Blanket', kind: 'place', icon: 'picnic', place: 'picnic', price: 200, desc: 'Perfect for a sunny afternoon.' },
  sundial:   { name: 'Sundial', kind: 'place', icon: 'sundial', place: 'sundial', price: 900, desc: 'Tells the time, as long as it\'s sunny.' },
  goldgnome: { name: 'Golden Gnome', kind: 'place', icon: 'goldgnome', place: 'goldgnome', desc: 'A very rare, very shiny gnome.' },
  honey:     { name: 'Honey', kind: 'produce', icon: 'honey', sell: 180, desc: 'Sells for 180 coins.' },
  wildhoney: { name: 'Wildflower Honey', kind: 'produce', icon: 'wildhoney', sell: 420, desc: 'Sells for 420 coins.' },
});
export const FISH_TYPES = {
  koi: { name: 'Koi', sell: 120 }, whitekoi: { name: 'White Koi', sell: 160 }, goldfish: { name: 'Goldfish', sell: 90 },
  carp: { name: 'Carp', sell: 70 }, minnow: { name: 'Minnow', sell: 40 }, goldkoi: { name: 'Golden Koi', sell: 2500 },
};
for (const [k, f] of Object.entries(FISH_TYPES)) ITEMS['fish_' + k] = { name: f.name, kind: 'produce', icon: 'fish_' + k, sell: f.sell, fish: true, desc: `A fish! Sells for ${f.sell} coins.` };
export const TREES = {
  apple: { name: 'Apple', price: 1500, sell: 90, days: 3 }, peach: { name: 'Peach', price: 2500, sell: 140, days: 3 },
  orange: { name: 'Orange', price: 3500, sell: 190, days: 4 }, cherry: { name: 'Cherry', price: 5000, sell: 260, days: 4 },
  plum: { name: 'Plum', price: 7500, sell: 380, days: 5 },
};
for (const [k, t] of Object.entries(TREES)) {
  ITEMS['sapling_' + k] = { name: t.name + ' Sapling', kind: 'place', icon: 'sapling_' + k, place: 'fruittree', tree: k, price: t.price,
    desc: `Grows into a ${t.name.toLowerCase()} tree in ${t.days} days, then gives 3 fruit every day. No watering needed.` };
  ITEMS['fruit_' + k] = { name: t.name, kind: 'produce', icon: 'fruit_' + k, sell: t.sell, desc: `Sells for ${t.sell} coins.` };
}

// ---- v1.3 Wildwood items ----
Object.assign(ITEMS, {
  axe:     { name: 'Axe', kind: 'tool', icon: 'axe', price: 300, desc: 'Chops trees in the Wildwood for Wood.' },
  pickaxe: { name: 'Pickaxe', kind: 'tool', icon: 'pickaxe', price: 400, desc: 'Breaks Wildwood rocks and ore veins.' },
  shears:  { name: 'Shears', kind: 'tool', icon: 'shears', desc: 'Harvest flowers and herbs with these for a bonus harvest and Petals.' },
  picker:  { name: 'Fruit Picker', kind: 'tool', icon: 'picker', desc: 'Harvest fruit with it for a bonus harvest. Also shakes extra fruit from trees.' },
  trowel:  { name: 'Trowel', kind: 'tool', icon: 'trowel', desc: 'Harvest veggies with it for a bonus harvest and some Fiber.' },
  wand:    { name: 'Crystal Wand', kind: 'tool', icon: 'wand', desc: 'Harvest magical crops with it for a bonus harvest and Stardust.' },
  workbench: { name: 'Workbench', kind: 'place', icon: 'workbench', place: 'workbench', price: 800, desc: 'Craft tools and gadgets, upgrade your tools and repair them.' },
  seedmaker: { name: 'Seed Maker', kind: 'place', icon: 'seedmaker', place: 'seedmaker', desc: 'Give it a crop and it turns it into 2 seeds after 6 hours.' },
});
for (const [k, m] of Object.entries(MATERIALS)) ITEMS[k] = { name: m.name, kind: 'material', icon: 'mat_' + k, sell: m.sell, desc: `${m.desc} Sells for ${m.sell}c.` };

export const STACK_MAX = 99;

export const SHOP_SEEDS = Object.keys(CROPS).filter((id) => !WILD_ONLY.has(id)).sort((a, b) => CROPS[a].seedPrice - CROPS[b].seedPrice).map((id) => 'seed_' + id);
export const SHOP_GOODS = ['workbench', 'axe', 'pickaxe', 'fertilizer', 'bucket', 'sickle', 'net', 'sprinkler', 'sprinkler2', 'sprinkler3', 'sprinkler4', 'beehive',
  'sapling_apple', 'sapling_peach', 'sapling_orange', 'sapling_cherry', 'sapling_plum'];
export const SHOP_DECOR = ['path', 'fence', 'flowerpot', 'haybale', 'picnic', 'mushroomlog', 'bench', 'jackolantern', 'birdbath', 'campfire', 'sundial',
  'lamp', 'scarecrow', 'stonelantern', 'gnome', 'statue'];

export function isStackable(id) {
  return ITEMS[id] && ITEMS[id].kind !== 'tool';
}
