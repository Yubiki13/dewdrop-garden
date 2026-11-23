// The update log shown on the title screen. Newest first.
// To add an update: put a new entry at the top and bump VERSION in src/config.js to match.
export const CHANGELOG = [
  {
    version: '1.2',
    title: 'The Big Bloom Update',
    added: [
      '125 brand new seeds: herbs, berries, citrus, tropical fruit, mushrooms, 7 new kinds of flower and a whole set of magical crops',
      'A new best seed: the Celestial Lotus, about 8x better than the Dewdrop Lily',
      'Blossom Hills: a huge third plot (500,000 coins) with a pond full of golden koi, a windmill and a Wishing Well',
      'Achievements! 58 of them in 6 tiers, from easy to legendary, with coin rewards. Can you turn the WHOLE world into a garden?',
      'Fishing Net: scoop fish out of the ponds and sell them (the Golden Koi is worth a fortune)',
      'Fruit trees: apple, peach, orange, cherry and plum. They never need watering and fruit every day',
      'Beehives that make honey, or Wildflower Honey when flowers grow nearby',
      'Golden Hoe and Golden Watering Can that work on a whole 3x3 patch, plus the 7x7 Rainbow Sprinkler',
      'Mochi the cat lives by the cottage now. Click to pet!',
      'A mailbox with a letter (and a little gift) every morning',
      '10 new decorations: benches, birdbaths, campfires you can light, lanterns, a jack-o\'-lantern, an owl statue and more',
      'Seed search and filters in the shop, plus new Garden and Decor tabs',
      'Your backpack holds 40 items instead of 30',
    ],
    fixed: [
      'Plural seed names read properly (Raspberry Seeds instead of Raspberries Seeds)',
      'Jumping to a spot no longer gets pulled back by a camera glide that was still running',
    ],
  },
  {
    version: '1.1',
    title: 'The Riverside Update',
    added: [
      '20 new seeds, from Beetroot all the way up to the Dewdrop Lily, the new best seed in the game',
      'Magical crops that glow softly at night',
      'Type exactly how many seeds you want to buy, or press Max',
      'The Riverside Meadow: a whole second garden plot for 50,000 coins',
      'Fish swimming in the pond and the new lake (click the water to startle them)',
      'One more zoom-out level, so you can see much more of your garden',
    ],
    fixed: [
      'Clicking no longer zooms you back in when you are fully zoomed out',
      'Your zoom level is remembered between visits',
      'Scrolling down now zooms out, like most games',
      'Coin numbers are easier to read: the 5 and 7 are much clearer now',
      'Huge orders no longer get stuck: if your bag fills up, the rest waits in the crate',
    ],
  },
  {
    version: '1.0',
    title: 'Hands-On Gardening',
    added: [
      'Play with just your cursor: your tools follow your mouse, no character to walk around',
      'Click and drag to till, plant, water and harvest whole rows at once',
      'Granny\'s gift crate and a new tutorial',
      'Pick up anything you\'ve placed with the hand and move it',
      'Drag crops onto the Shipping Bin to sell them',
      'Shop orders arrive in a crate you knock open',
    ],
    fixed: [],
  },
];
