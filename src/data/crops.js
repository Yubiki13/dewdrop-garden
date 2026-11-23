// Crop definitions. `hours` = in-game hours of WET soil needed to ripen.
// `regrow` = hours to re-ripen after harvesting (plant stays). `yield` = items per harvest.
export const CROPS = {
  radish:     { name: 'Radish',     hours: 6,  seedPrice: 10,  sell: 24,  colors: ['#e04a4a', '#9e2a3a', '#ff8c82'], desc: 'Quick and peppery. Perfect first crop.' },
  carrot:     { name: 'Carrot',     hours: 12, seedPrice: 15,  sell: 38,  colors: ['#f08a2c', '#c4561e', '#ffc070'], desc: 'Crunchy and sweet.' },
  lettuce:    { name: 'Lettuce',    hours: 14, seedPrice: 20,  sell: 50,  colors: ['#8fd65a', '#4fa64a', '#c8ef8a'], desc: 'A crisp leafy head.' },
  potato:     { name: 'Potato',     hours: 18, seedPrice: 25,  sell: 62,  colors: ['#e0b27a', '#b07a4a', '#f2e2bc'], desc: 'Hearty. Grows little white flowers.' },
  strawberry: { name: 'Strawberry', hours: 20, seedPrice: 40,  sell: 28,  regrow: 8,  colors: ['#e04a4a', '#9e2a3a', '#ff8c82'], desc: 'Keeps fruiting after each harvest.' },
  tomato:     { name: 'Tomato',     hours: 24, seedPrice: 45,  sell: 30,  regrow: 10, colors: ['#e04a4a', '#4fa64a', '#ff8c82'], desc: 'Climbs its stake. Regrows.' },
  corn:       { name: 'Corn',       hours: 28, seedPrice: 50,  sell: 34,  regrow: 12, colors: ['#f5d44a', '#c98f22', '#fff3a0'], desc: 'Tall and golden. Regrows.' },
  blueberry:  { name: 'Blueberry',  hours: 30, seedPrice: 70,  sell: 16,  regrow: 10, yield: 3, colors: ['#4a7ad0', '#2a4a8a', '#8ac4f0'], desc: 'Bushes give 3 berries per harvest.' },
  sunflower:  { name: 'Sunflower',  hours: 26, seedPrice: 35,  sell: 85,  colors: ['#f5d44a', '#7a4a30', '#fff3a0'], desc: 'Turns its face to the sun.' },
  pumpkin:    { name: 'Pumpkin',    hours: 40, seedPrice: 90,  sell: 240, colors: ['#f08a2c', '#c4561e', '#ffc070'], desc: 'Slow, big, and very valuable.' },
  watermelon: { name: 'Watermelon', hours: 44, seedPrice: 110, sell: 280, colors: ['#4fa64a', '#1e4a33', '#e04a4a'], desc: 'The biggest prize in the garden.' },

  // ---- Rare seeds (expansion): every one of these beats the old best ----
  beetroot:     { rare: true, name: 'Beetroot',       hours: 30, seedPrice: 140,  sell: 400,   colors: ['#a8285a', '#6a1838', '#e06090'], desc: 'Deep, earthy and surprisingly valuable.' },
  cauliflower:  { rare: true, name: 'Cauliflower',    hours: 34, seedPrice: 170,  sell: 500,   colors: ['#f6f1e7', '#cbc7d4', '#ffffff'], desc: 'A fluffy white cloud of a vegetable.' },
  bellpepper:   { rare: true, name: 'Bell Pepper',    hours: 30, seedPrice: 200,  sell: 100,   regrow: 9, colors: ['#e04a4a', '#9e2a3a', '#ff8c82'], desc: 'Crisp and glossy. Keeps fruiting.' },
  eggplant:     { rare: true, name: 'Eggplant',       hours: 36, seedPrice: 240,  sell: 680,   colors: ['#5a3a9a', '#3a2066', '#9a7ad8'], desc: 'A handsome purple fruit.' },
  chili:        { rare: true, name: 'Chili Pepper',   hours: 32, seedPrice: 280,  sell: 28,    regrow: 8, yield: 4, colors: ['#ff3b30', '#b81e2a', '#ff9a80'], desc: 'Spicy! Four chilies every harvest.' },
  pineapple:    { rare: true, name: 'Pineapple',      hours: 42, seedPrice: 350,  sell: 1050,  colors: ['#f0b030', '#a8701e', '#ffe080'], desc: 'A tropical crown jewel.' },
  grapes:       { rare: true, seedName: 'Grape Seeds', name: 'Grapes',         hours: 36, seedPrice: 400,  sell: 50,   regrow: 10, yield: 4, colors: ['#7a52c0', '#4a2f7a', '#b89af0'], desc: 'Climbs a trellis. Four bunches per harvest.' },
  cranberry:    { rare: true, seedName: 'Cranberry Seeds', name: 'Cranberries',    hours: 34, seedPrice: 450,  sell: 30,    regrow: 8, yield: 6, colors: ['#c8203a', '#801028', '#ff7080'], desc: 'Six tart berries every harvest.' },
  coffee:       { rare: true, seedName: 'Coffee Seeds', name: 'Coffee Beans',   hours: 40, seedPrice: 520,  sell: 45,   regrow: 9, yield: 5, colors: ['#8a5a3a', '#5a3420', '#b8845a'], desc: 'Five beans a harvest. Smells amazing.' },
  cantaloupe:   { rare: true, name: 'Cantaloupe',     hours: 46, seedPrice: 600,  sell: 1800,  colors: ['#e8c078', '#b08848', '#fff0c0'], desc: 'Sweet, netted and big.' },
  dragonfruit:  { rare: true, name: 'Dragon Fruit',   hours: 48, seedPrice: 750,  sell: 2300,  colors: ['#f04a9a', '#a82a6a', '#ff9ad0'], desc: 'Blooms on a cactus. Fierce and fabulous.' },
  starfruit:    { rare: true, name: 'Starfruit',      hours: 50, seedPrice: 900,  sell: 2800,  colors: ['#f5d44a', '#c98f22', '#fff3a0'], desc: 'Each slice is a little star.' },
  rainbowrose:  { rare: true, name: 'Rainbow Rose',   hours: 52, seedPrice: 1100, sell: 3500,  colors: ['#e04a4a', '#f5d44a', '#4a7ad0'], desc: 'Every petal a different colour.' },
  moonflower:   { rare: true, name: 'Moonflower',     hours: 54, seedPrice: 1300, sell: 4300,  glow: [190, 220, 255], colors: ['#d4efff', '#8ac4f0', '#ffffff'], desc: 'Glows softly at night.' },
  goldpumpkin:  { rare: true, name: 'Golden Pumpkin', hours: 56, seedPrice: 1600, sell: 5400,  glow: [255, 220, 120], colors: ['#f5d44a', '#c98f22', '#fff3a0'], desc: 'Solid gold. Well, almost.' },
  crystalberry: { rare: true, name: 'Crystal Berry',  hours: 50, seedPrice: 2000, sell: 255,   regrow: 12, yield: 4, glow: [160, 230, 255], colors: ['#8ad8f8', '#4a8ac8', '#ffffff'], desc: 'Frosty gems. Four per harvest, forever.' },
  ancientfruit: { rare: true, name: 'Ancient Fruit',  hours: 56, seedPrice: 2500, sell: 465,  regrow: 14, yield: 3, glow: [140, 255, 220], colors: ['#3ac0b0', '#1e7a78', '#b8fff0'], desc: 'A forgotten fruit. Three per harvest, forever.' },
  firelily:     { rare: true, name: 'Fire Lily',      hours: 60, seedPrice: 3000, sell: 10000, glow: [255, 150, 80], colors: ['#f08a2c', '#e04a4a', '#ffc070'], desc: 'Warm to the touch. Glows like an ember.' },
  frostmelon:   { rare: true, name: 'Frost Melon',    hours: 64, seedPrice: 3600, sell: 12500, glow: [170, 230, 255], colors: ['#a8e8ff', '#5aa8d8', '#ffffff'], desc: 'Stays ice-cold even in summer.' },
  dewdroplily:  { rare: true, name: 'Dewdrop Lily',   hours: 72, seedPrice: 5000, sell: 20000, glow: [200, 240, 255], colors: ['#d4efff', '#4a7ad0', '#ffffff'], desc: 'The legendary flower this garden is named after. The best seed there is.' },
};

export const CROP_IDS = Object.keys(CROPS);

// growth fraction thresholds for stages 1..4 (0 = seed)
export const STAGE_AT = [0, 0.15, 0.4, 0.7, 1];

export function stageOf(crop) {
  const def = CROPS[crop.id];
  const f = crop.growth / def.hours;
  if (f >= 1) return 4;
  for (let s = 3; s >= 0; s--) if (f >= STAGE_AT[s]) return s;
  return 0;
}
