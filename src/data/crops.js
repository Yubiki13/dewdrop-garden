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
