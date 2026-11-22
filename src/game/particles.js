// Lightweight particle system (all coordinates in world pixels).
import { rand, pick } from '../core/util.js';
import { drawSprite } from '../art/palette.js';

export class Particles {
  constructor() {
    this.list = [];
    this.texts = [];
  }

  add(p) {
    p.life = p.life ?? 1;
    p.max = p.life;
    p.vx = p.vx || 0; p.vy = p.vy || 0; p.g = p.g || 0;
    p.z = p.z || 0; p.vz = p.vz || 0;
    this.list.push(p);
    return p;
  }

  burst(x, y, n, opts) {
    for (let i = 0; i < n; i++) {
      const a = rand(Math.PI * 2), s = rand(opts.speedMin ?? 10, opts.speed ?? 40);
      this.add({
        type: opts.type || 'px', x: x + rand(-(opts.spread || 3), opts.spread || 3), y: y + rand(-(opts.spread || 3), opts.spread || 3),
        vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6, z: opts.z ?? 2, vz: opts.vz != null ? rand(opts.vz * 0.6, opts.vz) : 0,
        g: opts.g ?? 0, color: Array.isArray(opts.color) ? pick(opts.color) : opts.color,
        life: rand((opts.life || 0.6) * 0.6, opts.life || 0.6), size: opts.size || 1, drag: opts.drag ?? 2,
      });
    }
  }

  dirt(x, y) { this.burst(x, y, 9, { color: ['#7a4c30', '#946040', '#5e3a26', '#a8724a'], speed: 38, vz: 55, g: 260, life: 0.55 }); }
  water(x, y, n = 10) {
    this.burst(x, y, n, { type: 'drop', color: ['#8ac4f0', '#d4efff', '#4a7ad0'], speed: 30, vz: 50, g: 260, life: 0.6 });
    this.add({ type: 'ripple', x, y: y + 2, life: 0.5, r: 7, color: '#d4efff' });
  }
  sparkle(x, y, n = 6, color = ['#fff3a0', '#ffffff', '#f5d44a']) {
    this.burst(x, y, n, { type: 'spark', color, speed: 25, vz: 20, g: 0, life: 0.8, spread: 6 });
  }
  leafPuff(x, y) { this.burst(x, y, 6, { color: ['#4fa64a', '#8fd65a', '#2f7a3e'], speed: 30, vz: 40, g: 200, life: 0.5 }); }

  text(x, y, str, color = '#fff3a0') {
    this.texts.push({ x, y, str, color, life: 1.4, max: 1.4 });
  }

  /** Item icon that hops from (x,y) to the player. */
  pickup(spr, x, y, target) {
    this.add({ type: 'item', spr, x, y, z: 0, vz: 90, g: 380, life: 0.9, target, sx: x, sy: y });
  }

  update(dt) {
    for (const p of this.list) {
      p.life -= dt;
      if (p.type === 'item') {
        const k = 1 - p.life / p.max;
        p.z = Math.max(0, p.z + p.vz * dt); p.vz -= p.g * dt;
        p.x = p.sx + (p.target.x - p.sx) * k * k;
        p.y = p.sy + (p.target.y - 10 - p.sy) * k * k;
        continue;
      }
      const drag = Math.exp(-(p.drag ?? 0) * dt);
      p.vx *= drag; p.vy *= drag;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.g || p.vz) {
        p.vz -= p.g * dt; p.z += p.vz * dt;
        if (p.z < 0) { p.z = 0; p.vz *= -0.3; p.vx *= 0.5; p.vy *= 0.5; }
      }
    }
    this.list = this.list.filter((p) => p.life > 0);
    for (const t of this.texts) { t.life -= dt; t.y -= 14 * dt * (t.life / t.max + 0.2); }
    this.texts = this.texts.filter((t) => t.life > 0);
  }

  draw(ctx, cx, cy) {
    for (const p of this.list) {
      const x = Math.round(p.x - cx), y = Math.round(p.y - cy - p.z);
      const a = Math.min(1, p.life / p.max * 2);
      ctx.globalAlpha = a;
      switch (p.type) {
        case 'drop':
          ctx.fillStyle = p.color; ctx.fillRect(x, y, 1, 2); break;
        case 'spark': {
          ctx.fillStyle = p.color;
          const tw = Math.sin(p.life * 20) > 0;
          ctx.fillRect(x, y, 1, 1);
          if (tw) { ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3); }
          break;
        }
        case 'ripple': {
          const k = 1 - p.life / p.max;
          const r = 2 + k * p.r;
          ctx.strokeStyle = p.color; ctx.globalAlpha = (1 - k) * 0.8; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.ellipse(x + 0.5, y + 0.5, r, r * 0.45, 0, 0, Math.PI * 2); ctx.stroke();
          break;
        }
        case 'smoke': {
          const k = 1 - p.life / p.max;
          ctx.fillStyle = p.color; ctx.globalAlpha = 0.45 * (1 - k);
          const s = Math.round(2 + k * 4);
          ctx.fillRect(x - (s >> 1), y - (s >> 1), s, s);
          break;
        }
        case 'leaf':
          ctx.fillStyle = p.color;
          ctx.fillRect(x, y, 2, 1);
          if (Math.sin(p.life * 6) > 0) ctx.fillRect(x + 1, y + 1, 1, 1);
          break;
        case 'item':
          ctx.globalAlpha = 1;
          drawSprite(ctx, p.spr, x - 8, y - 8);
          break;
        default:
          ctx.fillStyle = p.color; ctx.fillRect(x, y, p.size, p.size);
      }
    }
    ctx.globalAlpha = 1;
  }

  /** Drawn on the full-resolution overlay canvas so text stays crisp. S = pixel scale. */
  drawTexts(ctx, cx, cy, S) {
    ctx.font = `${Math.round(7 * S)}px Pixelify, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const t of this.texts) {
      const a = Math.min(1, t.life / t.max * 3);
      const x = Math.round((t.x - cx) * S), y = Math.round((t.y - cy) * S);
      ctx.globalAlpha = a;
      ctx.fillStyle = '#241826';
      const o = Math.max(1, Math.round(S * 0.75));
      for (const [dx, dy] of [[o, 0], [-o, 0], [0, o], [0, -o], [o, o]]) ctx.fillText(t.str, x + dx, y + dy);
      ctx.fillStyle = t.color;
      ctx.fillText(t.str, x, y);
    }
    ctx.globalAlpha = 1;
  }
}
