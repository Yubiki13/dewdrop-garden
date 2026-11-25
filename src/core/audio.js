// Fully synthesized audio: generative lo-fi music, nature ambience and sound effects.
// Nothing is loaded from disk, so the game stays tiny and license-free.

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

const CHORDS = {
  Fmaj7: [53, 57, 60, 64], Dm9: [50, 57, 60, 64], Bbmaj7: [46, 53, 57, 62], Csus: [48, 55, 57, 62],
  Am7: [45, 52, 55, 60], Gm7: [43, 50, 53, 58], Ebmaj7: [51, 55, 58, 62],
};
const PROGRESSIONS = [
  ['Fmaj7', 'Dm9', 'Bbmaj7', 'Csus'],
  ['Bbmaj7', 'Am7', 'Gm7', 'Csus'],
  ['Fmaj7', 'Am7', 'Bbmaj7', 'Bbmaj7'],
  ['Dm9', 'Bbmaj7', 'Fmaj7', 'Csus'],
];
const PENTA = [65, 67, 69, 72, 74, 77, 79, 81, 84, 86];

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.vol = { music: 0.55, sfx: 0.7, amb: 0.6 };
    this.state = { hour: 12, raining: false, title: true };
    this.started = false;
  }

  /** Must be called from a user gesture. */
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 3;
    this.master.connect(comp).connect(ctx.destination);
    this.musicBus = ctx.createGain();
    this.sfxBus = ctx.createGain();
    this.ambBus = ctx.createGain();
    for (const b of [this.musicBus, this.sfxBus, this.ambBus]) b.connect(this.master);
    // reverb send
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.makeImpulse(2.8);
    this.reverbGain = ctx.createGain();
    this.reverbGain.gain.value = 0.35;
    this.reverb.connect(this.reverbGain).connect(this.master);
    // echo for melody
    this.delay = ctx.createDelay(1);
    this.delay.delayTime.value = 0.62;
    const fb = ctx.createGain(); fb.gain.value = 0.32;
    const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 2400;
    this.delay.connect(dlp).connect(fb).connect(this.delay);
    dlp.connect(this.musicBus);
    this.noise = this.makeNoise(2);
    this.applyVolumes();
    this.startAmbience();
    this.startMusic();
    this.started = true;
  }

  setVolumes(v) {
    Object.assign(this.vol, v);
    this.applyVolumes();
  }
  applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.musicBus.gain.setTargetAtTime(this.vol.music * 0.5, t, 0.1);
    this.sfxBus.gain.setTargetAtTime(this.vol.sfx * 0.8, t, 0.05);
    this.ambBus.gain.setTargetAtTime(this.vol.amb * 0.6, t, 0.1);
  }

  makeNoise(sec) {
    const b = this.ctx.createBuffer(1, this.ctx.sampleRate * sec, this.ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  makeImpulse(sec) {
    const rate = this.ctx.sampleRate, len = rate * sec;
    const b = this.ctx.createBuffer(2, len, rate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    return b;
  }

  /* ----------------------------- building blocks ----------------------------- */

  tone({ freq, type = 'sine', t = 0, dur = 0.2, vol = 0.3, attack = 0.005, glide = null, bus = 'sfx', pan = 0, send = 0, filter = null }) {
    const ctx = this.ctx;
    const t0 = ctx.currentTime + t;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (glide) o.frequency.exponentialRampToValueAtTime(Math.max(20, glide), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node = o.connect(g);
    if (filter) {
      const f = ctx.createBiquadFilter();
      f.type = filter.type || 'lowpass'; f.frequency.value = filter.freq; f.Q.value = filter.q || 0.7;
      node = node.connect(f);
    }
    if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; node = node.connect(p); }
    node.connect(this.busOf(bus));
    if (send) { const s = ctx.createGain(); s.gain.value = send; node.connect(s).connect(this.reverb); }
    o.start(t0);
    o.stop(t0 + dur + 0.05);
    return o;
  }

  noiseBurst({ t = 0, dur = 0.15, vol = 0.3, freq = 1000, type = 'lowpass', q = 0.7, sweep = null, bus = 'sfx', pan = 0, attack = 0.005 }) {
    const ctx = this.ctx;
    const t0 = ctx.currentTime + t;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(freq, t0);
    if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node = src.connect(f).connect(g);
    if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; node = node.connect(p); }
    node.connect(this.busOf(bus));
    src.start(t0, Math.random() * 1.5);
    src.stop(t0 + dur + 0.05);
  }

  busOf(name) { return name === 'music' ? this.musicBus : name === 'amb' ? this.ambBus : this.sfxBus; }

  /* ----------------------------- sound effects ----------------------------- */

  play(name, opt = {}) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const r = () => 0.92 + Math.random() * 0.16;
    switch (name) {
      case 'till':
        this.noiseBurst({ dur: 0.16, vol: 0.5, freq: 900 * r(), sweep: 300 });
        this.tone({ freq: 140 * r(), glide: 60, dur: 0.14, vol: 0.4 });
        break;
      case 'dig':
        this.noiseBurst({ dur: 0.22, vol: 0.5, freq: 600 * r(), sweep: 200 });
        this.tone({ freq: 110, glide: 50, dur: 0.18, vol: 0.35 });
        break;
      case 'water':
        this.noiseBurst({ dur: 0.38, vol: 0.28, freq: 2600 * r(), sweep: 900, type: 'bandpass', q: 1.2, attack: 0.04 });
        for (let i = 0; i < 3; i++) this.tone({ freq: 900 + Math.random() * 900, t: 0.05 + i * 0.07, dur: 0.06, vol: 0.05, glide: 1600 });
        break;
      case 'splash':
        this.noiseBurst({ dur: 0.6, vol: 0.45, freq: 3000, sweep: 500, type: 'bandpass', q: 0.8, attack: 0.02 });
        this.noiseBurst({ dur: 0.3, vol: 0.3, freq: 600, sweep: 200 });
        for (let i = 0; i < 6; i++) this.tone({ freq: 700 + Math.random() * 1200, t: 0.05 + i * 0.06, dur: 0.07, vol: 0.05, glide: 1800 });
        break;
      case 'fill':
        for (let i = 0; i < 7; i++) this.tone({ freq: 300 + i * 90 + Math.random() * 60, t: i * 0.06, dur: 0.08, vol: 0.12, glide: 700 + i * 100 });
        this.noiseBurst({ dur: 0.45, vol: 0.12, freq: 1200, type: 'bandpass' });
        break;
      case 'plant':
        this.tone({ freq: 620 * r(), glide: 300, dur: 0.1, vol: 0.25 });
        this.noiseBurst({ dur: 0.06, vol: 0.15, freq: 1800 });
        break;
      case 'harvest':
        this.tone({ freq: 784 * r(), dur: 0.22, vol: 0.2, type: 'triangle', send: 0.3 });
        this.tone({ freq: 1175 * r(), t: 0.07, dur: 0.3, vol: 0.16, type: 'triangle', send: 0.3 });
        this.noiseBurst({ dur: 0.08, vol: 0.15, freq: 2000 });
        break;
      case 'coin':
        this.tone({ freq: 1319, dur: 0.1, vol: 0.14, type: 'square', filter: { freq: 3000 } });
        this.tone({ freq: 1976, t: 0.07, dur: 0.28, vol: 0.12, type: 'square', filter: { freq: 3500 }, send: 0.2 });
        break;
      case 'buy':
        this.tone({ freq: 988, dur: 0.1, vol: 0.12, type: 'triangle' });
        this.tone({ freq: 1319, t: 0.06, dur: 0.18, vol: 0.12, type: 'triangle', send: 0.2 });
        break;
      case 'place':
        this.tone({ freq: 240 * r(), glide: 140, dur: 0.12, vol: 0.4, type: 'triangle' });
        this.noiseBurst({ dur: 0.05, vol: 0.25, freq: 2500, type: 'highpass' });
        break;
      case 'step': {
        const path = opt.path;
        this.noiseBurst({ dur: 0.05, vol: path ? 0.07 : 0.045, freq: path ? 2400 * r() : 1400 * r(), type: path ? 'bandpass' : 'lowpass', q: 1.5 });
        break;
      }
      case 'ui':
        this.tone({ freq: 880 * r(), dur: 0.06, vol: 0.12, type: 'triangle' });
        break;
      case 'select':
        this.tone({ freq: 660, dur: 0.05, vol: 0.08, type: 'triangle' });
        break;
      case 'open':
        this.tone({ freq: 523, dur: 0.12, vol: 0.12, type: 'triangle' });
        this.tone({ freq: 784, t: 0.06, dur: 0.16, vol: 0.12, type: 'triangle', send: 0.2 });
        break;
      case 'close':
        this.tone({ freq: 784, dur: 0.1, vol: 0.1, type: 'triangle' });
        this.tone({ freq: 523, t: 0.06, dur: 0.14, vol: 0.1, type: 'triangle' });
        break;
      case 'error':
        this.tone({ freq: 220, dur: 0.12, vol: 0.14, type: 'triangle' });
        this.tone({ freq: 185, t: 0.09, dur: 0.16, vol: 0.14, type: 'triangle' });
        break;
      case 'talk':
        this.tone({ freq: (opt.pitch || 520) * (0.9 + Math.random() * 0.25), dur: 0.045, vol: 0.06, type: 'triangle' });
        break;
      case 'quest':
        [523, 659, 784, 1047].forEach((f, i) => this.tone({ freq: f, t: i * 0.09, dur: 0.4, vol: 0.13, type: 'triangle', send: 0.4 }));
        break;
      case 'sleep':
        [1047, 784, 659, 523, 392].forEach((f, i) => this.tone({ freq: f, t: i * 0.18, dur: 0.9, vol: 0.1, send: 0.6 }));
        break;
      case 'sprinkler':
        this.noiseBurst({ dur: 1.2, vol: 0.12, freq: 4000, type: 'highpass', attack: 0.15 });
        break;
      case 'grow':
        this.tone({ freq: 1568, dur: 0.15, vol: 0.05, send: 0.5 });
        break;
      case 'pickup':
        this.tone({ freq: 520 * r(), glide: 820, dur: 0.09, vol: 0.14, type: 'triangle' });
        break;
      case 'drop':
        this.tone({ freq: 300 * r(), glide: 160, dur: 0.1, vol: 0.28, type: 'triangle' });
        this.noiseBurst({ dur: 0.06, vol: 0.18, freq: 1800 });
        break;
      case 'trash':
        this.noiseBurst({ dur: 0.12, vol: 0.22, freq: 2600, type: 'bandpass', q: 3 });
        this.tone({ freq: 340 * r(), glide: 150, dur: 0.12, vol: 0.22, type: 'square' });
        this.tone({ freq: 1180, t: 0.04, dur: 0.18, vol: 0.05, type: 'triangle', send: 0.3 });
        break;
      case 'knock':
        this.tone({ freq: (opt.n === 2 ? 210 : 260) * r(), glide: 120, dur: 0.09, vol: 0.4, type: 'triangle' });
        this.noiseBurst({ dur: 0.05, vol: 0.3, freq: 1400, type: 'bandpass', q: 2 });
        break;
      case 'crate':
        this.noiseBurst({ dur: 0.2, vol: 0.35, freq: 900, sweep: 2600, type: 'bandpass', q: 1.2 });
        this.tone({ freq: 180, glide: 90, dur: 0.15, vol: 0.35, type: 'triangle' });
        [784, 988, 1175, 1568].forEach((f, i) => this.tone({ freq: f, t: 0.12 + i * 0.07, dur: 0.35, vol: 0.11, type: 'triangle', send: 0.4 }));
        break;
      case 'thud':
        this.tone({ freq: 120, glide: 55, dur: 0.22, vol: 0.45 });
        this.noiseBurst({ dur: 0.15, vol: 0.25, freq: 500 });
        break;
      case 'pluck':
        this.tone({ freq: 380 * r(), glide: 900, dur: 0.08, vol: 0.2, type: 'triangle' });
        this.noiseBurst({ dur: 0.1, vol: 0.2, freq: 1200, sweep: 3000, type: 'bandpass' });
        break;
      case 'rustle':
        this.noiseBurst({ dur: 0.35, vol: 0.18, freq: 3000 * r(), type: 'bandpass', q: 0.8, attack: 0.03 });
        this.noiseBurst({ t: 0.12, dur: 0.25, vol: 0.12, freq: 2400 * r(), type: 'bandpass', q: 0.8 });
        break;
      case 'plop':
        this.tone({ freq: 900 * r(), glide: 250, dur: 0.12, vol: 0.2 });
        this.tone({ freq: 1300 * r(), glide: 600, t: 0.05, dur: 0.08, vol: 0.06 });
        break;
      case 'tok':
        this.tone({ freq: 700 * r(), dur: 0.05, vol: 0.18, type: 'triangle' });
        break;
      case 'hover':
        this.tone({ freq: 1400 * r(), dur: 0.03, vol: 0.03, type: 'triangle' });
        break;
      case 'swing':
        this.noiseBurst({ dur: 0.12, vol: 0.12, freq: 1500, sweep: 3500, type: 'bandpass', q: 1.5, attack: 0.03 });
        break;
    }
  }

  /* ----------------------------- music ----------------------------- */

  startMusic() {
    this.bpm = 74;
    this.step = 0; // 8th notes
    this.nextTime = this.ctx.currentTime + 0.3;
    this.prog = PROGRESSIONS[0];
    this.melodyPos = 4;
    this.phrase = this.makePhrase();
    setInterval(() => this.scheduler(), 60);
  }

  makePhrase() {
    // 16 eighth-note slots; null = rest
    const out = [];
    let pos = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < 16; i++) {
      if (Math.random() < 0.42 || i % 8 === 7) { out.push(null); continue; }
      pos = Math.max(0, Math.min(PENTA.length - 1, pos + [-2, -1, -1, 1, 1, 2, 0][Math.floor(Math.random() * 7)]));
      out.push(PENTA[pos]);
    }
    return out;
  }

  scheduler() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const eighth = 60 / this.bpm / 2;
    while (this.nextTime < this.ctx.currentTime + 0.35) {
      this.playStep(this.step, this.nextTime);
      this.nextTime += eighth * (this.step % 2 ? 0.92 : 1.08); // a little swing
      this.step++;
    }
  }

  playStep(step, time) {
    const t = time - this.ctx.currentTime;
    const night = this.state.hour >= 20.5 || this.state.hour < 5.5;
    const rain = this.state.raining;
    const barLen = 16; // 2 bars of 8ths per chord
    const chordIdx = Math.floor(step / barLen) % 4;
    if (step % (barLen * 4) === 0) {
      this.prog = PROGRESSIONS[Math.floor(Math.random() * PROGRESSIONS.length)];
      if (Math.random() < 0.6) this.phrase = this.makePhrase();
    }
    const chord = CHORDS[this.prog[chordIdx]];
    const s = step % barLen;
    // chords: strum on 1, soft restrike on beat 3 of 2nd bar
    if (s === 0 || (s === 12 && !night)) {
      chord.forEach((m, i) => this.epNote(mtof(m), t + i * 0.035, s === 0 ? 3.8 : 1.6, (s === 0 ? 0.055 : 0.035) * (night ? 0.8 : 1)));
    }
    // bass
    if (s === 0 || s === 6 || s === 8) {
      this.tone({ freq: mtof(chord[0] - 12), t, dur: s === 0 ? 1.6 : 0.8, vol: night ? 0.11 : 0.14, bus: 'music', attack: 0.02, filter: { freq: 400 } });
    }
    // light percussion (day only)
    if (!night && !this.state.title) {
      if (s % 8 === 0) this.tone({ freq: 90, glide: 45, t, dur: 0.18, vol: 0.12, bus: 'music' });
      if (s % 4 === 2) this.noiseBurst({ t, dur: 0.05, vol: rain ? 0.015 : 0.025, freq: 8000, type: 'highpass', bus: 'music' });
      if (s % 8 === 4) this.noiseBurst({ t, dur: 0.09, vol: 0.03, freq: 2500, type: 'bandpass', q: 0.6, bus: 'music' });
    }
    // melody
    const note = this.phrase[step % 16];
    const density = night ? 0.45 : 0.85;
    if (note && Math.random() < density) {
      const m = note + (night ? 12 : 0);
      this.pluck(mtof(m), t, night ? 0.05 : 0.06);
    }
  }

  epNote(freq, t, dur, vol) {
    const ctx = this.ctx;
    const t0 = ctx.currentTime + t;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(vol * 0.35, t0 + 0.9);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 1700;
    g.connect(f);
    f.connect(this.musicBus);
    const send = ctx.createGain(); send.gain.value = 0.5;
    f.connect(send).connect(this.reverb);
    for (const [mult, type, lvl, det] of [[1, 'sine', 1, 0], [1, 'triangle', 0.35, 6], [2, 'sine', 0.18, -4]]) {
      const o = ctx.createOscillator();
      o.type = type; o.frequency.value = freq * mult; o.detune.value = det;
      const og = ctx.createGain(); og.gain.value = lvl;
      o.connect(og).connect(g);
      o.start(t0); o.stop(t0 + dur + 0.1);
    }
  }

  pluck(freq, t, vol) {
    const ctx = this.ctx;
    const t0 = ctx.currentTime + t;
    const o = ctx.createOscillator();
    const mod = ctx.createOscillator();
    const modG = ctx.createGain();
    o.type = 'sine'; o.frequency.value = freq;
    mod.type = 'sine'; mod.frequency.value = freq * 3.01;
    modG.gain.setValueAtTime(freq * 0.9, t0);
    modG.gain.exponentialRampToValueAtTime(1, t0 + 0.4);
    mod.connect(modG).connect(o.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.1);
    o.connect(g);
    g.connect(this.musicBus);
    g.connect(this.delay);
    const s = ctx.createGain(); s.gain.value = 0.6; g.connect(s).connect(this.reverb);
    o.start(t0); mod.start(t0);
    o.stop(t0 + 1.2); mod.stop(t0 + 1.2);
  }

  /* ----------------------------- ambience ----------------------------- */

  startAmbience() {
    const ctx = this.ctx;
    // rain bed
    const rain = ctx.createBufferSource(); rain.buffer = this.noise; rain.loop = true;
    const rlp = ctx.createBiquadFilter(); rlp.type = 'lowpass'; rlp.frequency.value = 2200;
    const rhp = ctx.createBiquadFilter(); rhp.type = 'highpass'; rhp.frequency.value = 350;
    this.rainGain = ctx.createGain(); this.rainGain.gain.value = 0;
    rain.connect(rhp).connect(rlp).connect(this.rainGain).connect(this.ambBus);
    rain.start();
    // gentle wind
    const wind = ctx.createBufferSource(); wind.buffer = this.noise; wind.loop = true; wind.playbackRate.value = 0.5;
    const wlp = ctx.createBiquadFilter(); wlp.type = 'lowpass'; wlp.frequency.value = 380;
    this.windGain = ctx.createGain(); this.windGain.gain.value = 0.06;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lfoG = ctx.createGain(); lfoG.gain.value = 0.04;
    lfo.connect(lfoG).connect(this.windGain.gain);
    lfo.start();
    wind.connect(wlp).connect(this.windGain).connect(this.ambBus);
    wind.start();
    setInterval(() => this.ambienceTick(), 250);
  }

  ambienceTick() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const { hour, raining } = this.state;
    const t = this.ctx.currentTime;
    this.rainGain.gain.setTargetAtTime(raining ? 0.32 : 0, t, 1.5);
    const day = hour > 5.5 && hour < 19.5;
    if (day && !raining && Math.random() < 0.07) this.birdCall();
    if (!day && !raining && Math.random() < 0.22) this.cricket();
    if (raining && Math.random() < 0.3) this.tone({ freq: 2000 + Math.random() * 2500, dur: 0.02, vol: 0.02, bus: 'amb', pan: Math.random() * 2 - 1 });
  }

  birdCall() {
    const base = 2200 + Math.random() * 1800;
    const n = 2 + Math.floor(Math.random() * 4);
    const pan = Math.random() * 1.6 - 0.8;
    const style = Math.random();
    for (let i = 0; i < n; i++) {
      const f = base * (style < 0.5 ? 1 + i * 0.06 : 1 - i * 0.05);
      this.tone({ freq: f, glide: f * (style < 0.5 ? 1.35 : 0.75), t: i * (0.09 + Math.random() * 0.05), dur: 0.07, vol: 0.045, bus: 'amb', pan, send: 0.3 });
    }
  }

  cricket() {
    const pan = Math.random() * 1.6 - 0.8;
    const f = 4200 + Math.random() * 600;
    for (let i = 0; i < 3; i++) this.tone({ freq: f, t: i * 0.045, dur: 0.03, vol: 0.022, bus: 'amb', pan, type: 'triangle' });
  }
}

export const audio = new AudioEngine();
