// Achievements: definitions (easiest first) + a tracker that checks progress and hands out rewards.
import { CROP_IDS } from '../data/crops.js';
import { FISH_TYPES } from '../data/items.js';
import { audio } from '../core/audio.js';

export const TIERS = [
  { name: 'Easy', reward: 50 },
  { name: 'Medium', reward: 250 },
  { name: 'Hard', reward: 1000 },
  { name: 'Very Hard', reward: 5000 },
  { name: 'Expert', reward: 25000 },
  { name: 'Legendary', reward: 100000 },
];

const harvested = (g) => Object.values(g.stats.harvested).reduce((a, b) => a + b, 0);
const kinds = (g) => CROP_IDS.filter((id) => g.stats.harvested[id] > 0).length;
const fishTotal = (g) => Object.values(g.stats.fish).reduce((a, b) => a + b, 0);
const fishKinds = (g) => Object.keys(FISH_TYPES).filter((k) => g.stats.fish[k] > 0).length;
const placed = (g, ...types) => types.reduce((a, t) => a + (g.stats.placed[t] || 0), 0);
const DECOR = ['flowerpot', 'gnome', 'scarecrow', 'lamp', 'bench', 'birdbath', 'campfire', 'haybale', 'statue', 'mushroomlog', 'jackolantern', 'stonelantern', 'picnic', 'sundial', 'goldgnome'];
const st = (k) => (g) => g.stats[k] || 0;

// [id, tier, name, description, target, value(game)]
const DEFS = [
  ['crate', 0, 'Unboxing Day', 'Open a crate.', 1, st('crates')],
  ['till1', 0, 'Breaking Ground', 'Till your first patch of soil.', 1, st('tilled')],
  ['plant1', 0, 'First Sprout', 'Plant a seed.', 1, st('planted')],
  ['water1', 0, 'Splish Splash', 'Water something.', 1, st('watered')],
  ['harvest1', 0, 'Green Thumb', 'Harvest your first crop.', 1, harvested],
  ['sell1', 0, 'Open for Business', 'Sell something at the Shipping Bin.', 1, st('sold')],
  ['weed1', 0, 'Weed Whacker', 'Pull a weed.', 1, st('weeds')],
  ['talk1', 0, 'Hello, Granny', 'Have a chat with Granny Willow.', 1, st('talks')],
  ['sleep1', 0, 'Sweet Dreams', 'Sleep in the cottage.', 1, st('slept')],
  ['buy1', 0, 'Window Shopper', 'Buy something from Basil.', 1, st('buys')],
  ['pet1', 0, 'Who\'s a Good Kitty', 'Pet Mochi the cat.', 1, st('pets')],
  ['letter1', 0, 'You\'ve Got Mail', 'Read a letter from the mailbox.', 1, st('letters')],

  ['harvest100', 1, 'Basket Case', 'Harvest 100 crops.', 100, harvested],
  ['plant100', 1, 'Seed Sower', 'Plant 100 seeds.', 100, st('planted')],
  ['earn1k', 1, 'Pocket Money', 'Earn 1,000 coins in total.', 1000, st('earned')],
  ['weed25', 1, 'Weed Warrior', 'Pull 25 weeds.', 25, st('weeds')],
  ['kinds10', 1, 'Variety Pack', 'Harvest 10 different kinds of crop.', 10, kinds],
  ['sprink5', 1, 'Rain Maker', 'Place 5 sprinklers.', 5, (g) => placed(g, 'sprinkler')],
  ['fish1', 1, 'Gone Fishin\'', 'Catch a fish with the Fishing Net.', 1, fishTotal],
  ['honey1', 1, 'Sweet as Honey', 'Collect honey from a beehive.', 1, st('honey')],
  ['tree1', 1, 'Little Orchard', 'Plant a fruit tree.', 1, (g) => placed(g, 'fruittree')],
  ['day7', 1, 'One Week In', 'Reach day 7.', 7, (g) => g.day],
  ['pet25', 1, 'Cat Person', 'Pet Mochi 25 times.', 25, st('pets')],
  ['decor10', 1, 'Garden Decorator', 'Place 10 decorations.', 10, (g) => placed(g, ...DECOR)],

  ['harvest1k', 2, 'Bumper Crop', 'Harvest 1,000 crops.', 1000, harvested],
  ['earn25k', 2, 'Money Grows on Plants', 'Earn 25,000 coins in total.', 25000, st('earned')],
  ['coins10k', 2, 'Saving Up', 'Have 10,000 coins at once.', 10000, st('maxCoins')],
  ['kinds30', 2, 'Crop Collector', 'Harvest 30 different kinds of crop.', 30, kinds],
  ['meadow', 2, 'Riverside Retreat', 'Buy the Riverside Meadow.', 1, (g) => (g.meadowOwned ? 1 : 0)],
  ['fish25', 2, 'Angler', 'Catch 25 fish.', 25, fishTotal],
  ['honey20', 2, 'Busy Bees', 'Collect 20 jars of honey.', 20, st('honey')],
  ['fruit50', 2, 'Fruit Basket', 'Pick 50 fruit from your trees.', 50, st('fruit')],
  ['paths100', 2, 'All Roads', 'Lay 100 stone paths.', 100, (g) => placed(g, 'path')],
  ['fence100', 2, 'Good Fences', 'Build 100 fences.', 100, (g) => placed(g, 'fence')],
  ['lamps10', 2, 'Lamplighter', 'Place 10 lamp posts.', 10, (g) => placed(g, 'lamp', 'stonelantern')],
  ['day30', 2, 'A Month of Sundays', 'Reach day 30.', 30, (g) => g.day],
  ['wish5', 2, 'Wishful Thinking', 'Make 5 wishes at the Wishing Well.', 5, st('wishes')],
  ['letter10', 2, 'Pen Pal', 'Read 10 letters.', 10, st('letters')],

  ['harvest10k', 3, 'Overflowing Barn', 'Harvest 10,000 crops.', 10000, harvested],
  ['earn250k', 3, 'Market Mogul', 'Earn 250,000 coins in total.', 250000, st('earned')],
  ['kinds75', 3, 'Botanist', 'Harvest 75 different kinds of crop.', 75, kinds],
  ['fishkinds', 3, 'Pond Explorer', 'Catch 5 different kinds of fish.', 5, fishKinds],
  ['dewdrop', 3, 'Namesake', 'Harvest a Dewdrop Lily.', 1, (g) => g.stats.harvested.dewdroplily || 0],
  ['till1k', 3, 'Hoe Down', 'Till 1,000 tiles.', 1000, st('tilled')],
  ['gold', 3, 'Gilded Gardener', 'Own the Golden Hoe and the Golden Watering Can.', 2, (g) => (g.count('goldhoe') ? 1 : 0) + (g.count('goldcan') ? 1 : 0)],
  ['day100', 3, 'Hundred Days', 'Reach day 100.', 100, (g) => g.day],
  ['pet500', 3, 'Mochi\'s Best Friend', 'Pet Mochi 500 times.', 500, st('pets')],

  ['hills', 4, 'Over the Hills', 'Buy Blossom Hills.', 1, (g) => (g.hillsOwned ? 1 : 0)],
  ['coins1m', 4, 'Millionaire', 'Have 1,000,000 coins at once.', 1000000, st('maxCoins')],
  ['celestial', 4, 'Written in the Stars', 'Harvest a Celestial Lotus, the best crop there is.', 1, (g) => g.stats.harvested.celestiallotus || 0],
  ['goldkoi', 4, 'Golden Catch', 'Catch a Golden Koi in the Blossom Hills pond.', 1, (g) => g.stats.fish.goldkoi || 0],
  ['harvest50k', 4, 'Endless Harvest', 'Harvest 50,000 crops.', 50000, harvested],
  ['lucky', 4, 'Lucky Star', 'Get the Golden Gnome from the Wishing Well.', 1, st('luckyWish')],
  ['allcrops', 4, 'Every Seed in the Shop', `Harvest every one of the ${CROP_IDS.length} kinds of crop.`, CROP_IDS.length, kinds],

  ['world', 5, 'The Whole World Is a Garden', 'Till every single plantable tile on the entire map. Every. Single. One.', (g) => g.tilledProgress().total, (g) => g.tilledProgress().done],
  ['earn10m', 5, 'Tycoon of the Valley', 'Earn 10,000,000 coins in total.', 10000000, st('earned')],
  ['fish250', 5, 'Legendary Angler', 'Catch 250 fish.', 250, fishTotal],
  ['all', 5, 'Completionist', 'Unlock every other achievement.', null, null],
];

export const ACHIEVEMENTS = DEFS.map(([id, tier, name, desc, target, value]) => ({ id, tier, name, desc, target, value }));
const ALL = ACHIEVEMENTS.find((a) => a.id === 'all');
ALL.target = ACHIEVEMENTS.length - 1;

export class AchievementTracker {
  constructor(game, saved) {
    this.game = game;
    this.unlocked = { ...(saved || {}) };
    this.t = 0;
    this.slow = 0;
    this.cache = {};
    game.on('buy', () => { game.stats.buys = (game.stats.buys || 0) + 1; });
    ALL.value = () => ACHIEVEMENTS.filter((a) => a.id !== 'all' && this.unlocked[a.id]).length;
  }

  target(a) { return typeof a.target === 'function' ? this.cached(a, 'target', () => a.target(this.game)) : a.target; }
  value(a) {
    if (a.id === 'world') return this.cached(a, 'value', () => a.value(this.game));
    return a.value(this.game);
  }
  cached(a, k, fn) {
    const key = a.id + k;
    if (this.cache[key] == null || this.cacheDirty) this.cache[key] = fn();
    return this.cache[key];
  }

  progress(a) {
    const target = this.target(a);
    const v = this.unlocked[a.id] ? target : Math.min(this.value(a), target);
    return { v, target, done: !!this.unlocked[a.id] };
  }

  get count() { return Object.keys(this.unlocked).filter((id) => ACHIEVEMENTS.some((a) => a.id === id)).length; }

  update(dt) {
    const g = this.game;
    g.stats.maxCoins = Math.max(g.stats.maxCoins || 0, g.coins);
    this.t -= dt;
    this.slow -= dt;
    if (this.t > 0) return;
    this.t = 1;
    // the whole-map count is a bit heavier, so refresh it every few seconds
    this.cacheDirty = this.slow <= 0;
    if (this.cacheDirty) this.slow = 3;
    for (const a of ACHIEVEMENTS) {
      if (this.unlocked[a.id]) continue;
      if (this.value(a) >= this.target(a)) this.unlock(a);
    }
    this.cacheDirty = false;
  }

  unlock(a) {
    const g = this.game;
    this.unlocked[a.id] = Date.now();
    const reward = g.sandbox ? 0 : TIERS[a.tier].reward;
    if (reward) { g.coins += reward; g.hooks.coinsChanged?.(); }
    audio.play('quest');
    g.hooks.achievement?.(a, reward);
    g.emit('achievement', a.id);
  }

  serialize() { return this.unlocked; }
}
