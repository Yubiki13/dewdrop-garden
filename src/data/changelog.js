// The update log shown on the title screen. Newest first.
// To add an update: put a new entry at the top and bump VERSION in src/config.js to match.
export const CHANGELOG = [
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
