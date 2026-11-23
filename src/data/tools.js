// v1.3 "Wildwood": materials, tool levels + durability, crafting recipes, Fern's trades and wild-only crops.

export const MATERIALS = {
  wood: { name: 'Wood', sell: 4, desc: 'Chopped from Wildwood trees with an Axe.' },
  stone: { name: 'Stone', sell: 3, desc: 'Broken off Wildwood rocks with a Pickaxe.' },
  fiber: { name: 'Fiber', sell: 2, desc: 'Tough plant fiber from weeds and wild herbs.' },
  copper: { name: 'Copper Ore', sell: 25, desc: 'Mined from orange-flecked ore veins.' },
  iron: { name: 'Iron Ore', sell: 60, desc: 'Mined from silvery ore veins.' },
  goldore: { name: 'Gold Ore', sell: 150, desc: 'Mined from glittering gold veins, deep in the woods.' },
  crystal: { name: 'Crystal Shard', sell: 600, desc: 'A rare shard from crystal veins and treasure chests.' },
  petals: { name: 'Petals', sell: 15, desc: 'Gathered when you harvest flowers with Shears.' },
  stardust: { name: 'Stardust', sell: 120, desc: 'Shimmers off magical crops harvested with a Crystal Wand.' },
};

export const LEVEL_NAMES = ['Basic', 'Copper', 'Iron', 'Gold'];
export const MAX_DUR = [120, 250, 500, 1000];
export const LEVELED = new Set(['hoe', 'can', 'bucket', 'shovel', 'sickle', 'net', 'axe', 'pickaxe', 'shears', 'picker', 'trowel', 'wand']);
// harvest helpers: which crop categories each one is made for
export const HARVEST_TOOLS = { shears: ['flower', 'herb'], picker: ['fruit'], trowel: ['veg'], wand: ['magic'] };
export const BONUS_YIELD = [1, 1, 2, 3];

const PLUS = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
const SQ = (r) => { const a = []; for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) a.push([x, y]); return a; };
const AREAS = [[[0, 0]], PLUS, SQ(1), SQ(2)];

export function levelOf(slot) {
  if (!slot) return 1;
  if (slot.id === 'goldhoe' || slot.id === 'goldcan') return 4;
  return slot.lvl || 1;
}
export function hasDurability(slot) { return !!slot && (LEVELED.has(slot.id) || slot.id === 'goldhoe' || slot.id === 'goldcan'); }
export function maxDur(slot) { return MAX_DUR[levelOf(slot) - 1]; }
export function durOf(slot) { return slot.dur ?? maxDur(slot); }

export function capacityOf(slot, items) {
  if (!slot) return 0;
  const l = levelOf(slot) - 1;
  if (slot.id === 'can') return [30, 60, 120, 250][l];
  if (slot.id === 'bucket') return [5, 8, 12, 20][l];
  return items[slot.id] ? items[slot.id].capacity || 0 : 0;
}

/** Tiles a tool works on, relative to the clicked tile. */
export function areaOf(slot) {
  const l = levelOf(slot) - 1;
  switch (slot.id) {
    case 'hoe': return AREAS[l];
    case 'can': return AREAS[Math.min(l, 2)];
    case 'goldhoe': case 'goldcan': return SQ(1);
    case 'sickle': return l >= 2 ? SQ(2) : SQ(1);
    default: return [[0, 0]];
  }
}
export const netRadius = (slot) => [12, 16, 22, 30][levelOf(slot) - 1];
export const hitPower = (slot) => [1, 2, 3, 5][levelOf(slot) - 1];

export function toolName(slot, items) {
  const base = items[slot.id] ? items[slot.id].name : slot.id;
  const l = levelOf(slot);
  return LEVELED.has(slot.id) && l > 1 ? `${LEVEL_NAMES[l - 1]} ${base}` : base;
}

// cost to upgrade TO level 2, 3, 4
export const UPGRADE_COST = [null, null, { coins: 2000, copper: 10, wood: 20 }, { coins: 10000, iron: 15, stone: 30 }, { coins: 50000, goldore: 20, crystal: 3 }];
export const repairCost = (slot) => ({ coins: 40 * levelOf(slot), wood: 2 });

export const RECIPES = [
  { id: 'axe', mats: { wood: 3, stone: 5 } },
  { id: 'pickaxe', mats: { wood: 5, stone: 3 } },
  { id: 'trowel', mats: { wood: 4, stone: 6 } },
  { id: 'picker', mats: { wood: 10, fiber: 10 } },
  { id: 'shears', mats: { wood: 5, copper: 3, fiber: 5 } },
  { id: 'wand', mats: { wood: 5, goldore: 2, crystal: 2 } },
  { id: 'seedmaker', mats: { wood: 25, stone: 15, copper: 5 } },
  { id: 'fertilizer', n: 3, mats: { fiber: 4 } },
  { id: 'fence', n: 5, mats: { wood: 3 } },
  { id: 'path', n: 5, mats: { stone: 3 } },
  { id: 'sprinkler', mats: { stone: 6, copper: 2 } },
  { id: 'sprinkler2', mats: { copper: 4, iron: 3 } },
  { id: 'sprinkler3', mats: { iron: 4, goldore: 3 } },
  { id: 'sprinkler4', mats: { goldore: 5, crystal: 2 } },
  { id: 'beehive', mats: { wood: 20, fiber: 10 } },
  { id: 'bench', mats: { wood: 15 } },
  { id: 'campfire', mats: { wood: 10, stone: 8 } },
  { id: 'lamp', mats: { wood: 6, copper: 3 } },
  { id: 'stonelantern', mats: { stone: 20, crystal: 1 } },
  { id: 'statue', mats: { stone: 50 } },
];

// Fern the Forager trades seeds for materials
export const TRADES = [
  { give: { fiber: 10 }, get: ['seed_wasabi', 3] },
  { give: { wood: 15, fiber: 5 }, get: ['seed_chanterelle', 3] },
  { give: { copper: 4 }, get: ['seed_cloudberry', 3] },
  { give: { stone: 20 }, get: ['seed_lingonberry', 3] },
  { give: { petals: 10 }, get: ['seed_salmonberry', 3] },
  { give: { iron: 5 }, get: ['seed_glowcap', 2] },
  { give: { iron: 5, fiber: 10 }, get: ['seed_moonradish', 2] },
  { give: { goldore: 3 }, get: ['seed_moonmushroom', 2] },
  { give: { goldore: 2, petals: 10 }, get: ['seed_snowberry', 3] },
  { give: { crystal: 1, fiber: 10 }, get: ['seed_dreamleaf', 2] },
  { give: { crystal: 2 }, get: ['seed_voidorchid', 2] },
  { give: { crystal: 2, petals: 20 }, get: ['seed_aurorarose', 2] },
  { give: { stardust: 6 }, get: ['seed_celestiallotus', 1] },
];

// these grow only from seeds found in the Wildwood (forage, chests, Fern, the Seed Maker)
export const WILD_ONLY = new Set([
  'chanterelle', 'glowcap', 'moonmushroom', 'cloudberry', 'salmonberry', 'lingonberry', 'snowberry',
  'wasabi', 'dreamleaf', 'voidorchid', 'aurorarose', 'moonradish',
]);
export const FORAGE_SEEDS = {
  herbs: ['wasabi', 'dreamleaf', 'moonradish'],
  mushrooms: ['chanterelle', 'glowcap', 'moonmushroom'],
  berries: ['cloudberry', 'salmonberry', 'lingonberry', 'snowberry'],
};
