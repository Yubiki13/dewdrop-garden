// Granny Willow's guided introduction. Each step listens for a game event and counts progress.
import { LAYOUT } from './world.js';
import { audio } from '../core/audio.js';

const G = LAYOUT.garden;

const STEPS = [
  {
    id: 'crate',
    talk: [
      'Oh, hello dear! Welcome to Willow Garden!',
      'I\'m getting too old to keep this place blooming, so from now on it\'s all yours.',
      'I left you a crate with my old tools. Click it a few times to pry the lid off!',
    ],
    objective: 'Open Granny\'s gift crate (click it)',
    event: 'crate', count: 1, pointerCrate: true,
  },
  {
    id: 'look',
    talk: [
      'Lovely! Your tools are in the toolbar at the bottom now.',
      'You don\'t need to walk anywhere — your hand reaches the whole garden.',
      'Have a look around: hold the right mouse button and drag (or use WASD). Scroll to zoom in and out.',
    ],
    objective: 'Look around (right-drag or WASD, scroll to zoom)',
    event: 'pan', count: 1, test: (d) => d > 160,
  },
  {
    id: 'till',
    talk: [
      'Every garden starts with soil.',
      'Pick up the Hoe from your toolbar, then click the grass to till it. Hold the button and sweep to till a whole row!',
      'That open meadow below the cottage is perfect.',
    ],
    objective: 'Till 4 patches of grass with the Hoe',
    event: 'till', count: 4, pointer: { tx: G.x0 + 4, ty: G.y0 + 1 }, select: 'hoe',
  },
  {
    id: 'plant',
    talk: ['Nice and fluffy! Now pick the Radish or Carrot seeds and click your soil to plant them. You can sweep seeds too.'],
    objective: 'Plant 4 seeds in your soil',
    event: 'plant', count: 4, select: 'seed_radish',
  },
  {
    id: 'water',
    talk: [
      'Now the most important part: water!',
      'Seeds only grow while their soil is wet. Wet soil turns dark, and it dries out after about a day.',
      'Take the Watering Can and hold it over each seedling.',
    ],
    objective: 'Water 4 seedlings with the Watering Can',
    event: 'water', count: 4, test: (d) => d && d.crops > 0, amount: (d) => d.crops, select: 'can',
  },
  {
    id: 'fill',
    talk: ['The can holds 30 splashes. When it runs dry, click the well or the pond with it to fill it up. Try it now!'],
    objective: 'Refill your Watering Can (click the well or pond)',
    event: 'fill', count: 1, pointerStruct: 'well', select: 'can',
  },
  {
    id: 'bucket',
    talk: ['Perfect. Here, take my old Water Bucket too. One splash soaks a whole 3×3 patch!'],
    give: [['bucket', 1]],
    objective: 'Splash some soil with the Water Bucket',
    event: 'bucket', count: 1, select: 'bucket',
  },
  {
    id: 'sprinkler',
    talk: ['And a Sprinkler! Put it next to your crops and it\'ll water the four tiles beside it every morning at 6.'],
    give: [['sprinkler', 1]],
    objective: 'Place the Sprinkler next to your crops',
    event: 'place', count: 1, test: (d) => d === 'sprinkler', select: 'sprinkler',
  },
  {
    id: 'move',
    talk: [
      'One more trick. With your bare hand you can pick up anything you\'ve placed and move it.',
      'Press Q (or right-click) to put your tool away, then drag the sprinkler somewhere else.',
    ],
    objective: 'Use the hand (Q) to drag the sprinkler to a new spot',
    event: 'move', count: 1,
  },
  {
    id: 'harvest',
    talk: [
      'Now we wait. Radishes are quick — about 6 hours while the soil stays wet.',
      'When a plant sparkles, it\'s ripe. Click it to pick it, or sweep across a whole row.',
      'Feeling impatient? Click the cottage and you\'ll sleep until 6 in the morning.',
    ],
    objective: 'Harvest a ripe crop (or click the cottage to sleep)',
    event: 'harvest', count: 1,
  },
  {
    id: 'sell',
    talk: ['You\'ve got a green thumb! Drag your harvest from the toolbar onto the Shipping Bin to sell it — or just click the bin.'],
    objective: 'Sell a crop at the Shipping Bin',
    event: 'sell', count: 1, pointerStruct: 'bin',
  },
  {
    id: 'shop',
    talk: [
      'Basil runs the market stall up the path. Seeds, sprinklers, fences, all sorts of pretty things.',
      'Click his stall and buy yourself something nice. He\'ll send it over in a crate.',
    ],
    objective: 'Buy something at Basil\'s Market Stall',
    event: 'buy', count: 1, pointerStruct: 'stall',
  },
  {
    id: 'unpack',
    talk: ['There\'s your delivery! Open it up.'],
    objective: 'Unpack your delivery crate',
    event: 'crate', count: 1, pointerCrate: true, waitFor: 'delivered',
  },
  {
    id: 'done',
    talk: [
      'That\'s everything I know, more or less.',
      'Grow whatever makes you happy. There\'s no rush here — the garden waits for you.',
      'Click me whenever you want to chat. I\'ll be by the cottage.',
    ],
    objective: null,
  },
];

export class Tutorial {
  constructor(game, state = {}) {
    this.game = game;
    this.enabled = state.enabled !== false;
    this.step = state.step ?? 0;
    this.progress = state.progress ?? 0;
    this.done = state.done ?? !this.enabled;
    this.talked = false; // has the current step's dialog been shown
    this.startDelay = 1.0;
    this.given = true; // gifts for a skipped tutorial are packed into the starter crate instead
    game.on('delivered', () => { this.waited = true; });
    for (const ev of new Set(STEPS.map((s) => s.event).filter(Boolean))) {
      game.on(ev, (d) => this.onEvent(ev, d));
    }
  }

  get active() { return !this.done; }
  get current() { return this.done ? null : STEPS[this.step]; }

  serialize() {
    return { enabled: this.enabled, step: this.step, progress: this.progress, done: this.done, given: true };
  }

  update(dt) {
    if (this.done || this.talked) return;
    if (this.game.hooks.isPaused?.()) return;
    const cur = this.current;
    if (cur && cur.waitFor && !this.waited) return;
    this.startDelay -= dt;
    if (this.startDelay > 0) return;
    this.talked = true;
    this.showTalk();
  }

  showTalk() {
    const s = this.current;
    if (!s) return;
    this.game.hooks.dialog?.('Granny Willow', s.talk, 'granny', () => {
      for (const [id, n] of s.give || []) {
        if (!this.game.count(id)) {
          this.game.addItem(id, n);
          this.game.toast(`Received ${n > 1 ? n + '× ' : ''}${id === 'bucket' ? 'Water Bucket' : 'Sprinkler'}!`, id);
        }
      }
      if (s.select) {
        const i = this.game.inv.findIndex((x) => x && x.id === s.select);
        if (i >= 0 && i < 10) this.game.select(i);
      }
      if (!s.objective) this.finish();
      this.game.hooks.questChanged?.();
    });
    this.game.hooks.questChanged?.();
  }

  repeat() {
    const s = this.current;
    if (!s) return;
    this.game.hooks.dialog?.('Granny Willow', s.talk.slice(-1), 'granny');
  }

  onEvent(ev, data) {
    const s = this.current;
    if (!s || !this.talked || s.event !== ev) return;
    if (this.game.hooks.isDialogOpen?.()) return;
    if (s.test && !s.test(data)) return;
    this.progress += s.amount ? s.amount(data) : 1;
    if (this.progress >= s.count) this.advance();
    this.game.hooks.questChanged?.();
  }

  advance() {
    audio.play('quest');
    this.step++;
    this.progress = 0;
    this.talked = false;
    this.waited = this.game.world && [...this.game.world.objs.values()].some((o) => o.type === 'crate');
    this.startDelay = 0.9;
    if (this.step >= STEPS.length) this.finish();
  }

  finish() {
    this.done = true;
    this.game.toast('Tutorial complete — the garden is yours!');
    this.game.hooks.questChanged?.();
  }

  skip() {
    for (let k = this.step; k < STEPS.length; k++)
      for (const [id, n] of STEPS[k].give || []) if (!this.game.count(id)) this.game.addItem(id, n);
    this.done = true;
    this.game.hooks.questChanged?.();
  }

  /** World-space pointer for the current objective, if any. */
  pointer() {
    const s = this.current;
    if (!s || !this.talked || !s.objective) return null;
    if (s.pointerCrate) {
      for (const [i, o] of this.game.world.objs) if (o.type === 'crate') return { x: (i % 60) * 16 + 8, y: Math.floor(i / 60) * 16 - 2 };
      return null;
    }
    if (s.pointer) return { x: s.pointer.tx * 16 + 8, y: s.pointer.ty * 16 };
    if (s.pointerStruct) {
      const st = this.game.world.structures.find((x) => x.type === s.pointerStruct);
      if (st) return { x: (st.tx + st.w / 2) * 16, y: st.ty * 16 - (st.type === 'stall' ? 28 : st.type === 'well' ? 14 : 6) };
    }
    return null;
  }
}
