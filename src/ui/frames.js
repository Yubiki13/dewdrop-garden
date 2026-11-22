// Generates the pixel-art 9-slice frames used by the DOM UI and exposes them as CSS variables.
import { makeCanvas } from '../core/util.js';

function frame(size, paint) {
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const px = (x, y, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); };
  const rect = (x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); };
  paint({ px, rect, S: size });
  return c.toDataURL();
}

export function installFrames() {
  const panel = frame(16, ({ rect, px, S }) => {
    rect(1, 0, S - 2, S, '#3b2416'); rect(0, 1, S, S - 2, '#3b2416');
    rect(1, 1, S - 2, S - 2, '#8a5a34');
    rect(1, 1, S - 2, 1, '#c08a58'); rect(1, 1, 1, S - 2, '#a8723f');
    rect(1, S - 2, S - 2, 1, '#6a4024');
    rect(3, 3, S - 6, S - 6, '#5a3a20');
    rect(4, 4, S - 8, S - 8, '#f4e4c1');
    rect(4, 4, S - 8, 1, '#fff4dc');
    px(1, 1, '#3b2416'); px(S - 2, 1, '#3b2416'); px(1, S - 2, '#3b2416'); px(S - 2, S - 2, '#3b2416');
  });
  const paper = frame(8, ({ rect, S }) => {
    rect(1, 0, S - 2, S, '#b08a5a'); rect(0, 1, S, S - 2, '#b08a5a');
    rect(1, 1, S - 2, S - 2, '#f8ecd0');
    rect(1, 1, S - 2, 1, '#fffaf0');
  });
  const dark = frame(8, ({ rect, S }) => {
    rect(1, 0, S - 2, S, '#140e18'); rect(0, 1, S, S - 2, '#140e18');
    rect(1, 1, S - 2, S - 2, '#2e2238');
    rect(1, 1, S - 2, 1, '#4a3a58');
  });
  const slot = frame(8, ({ rect, S }) => {
    rect(0, 0, S, S, '#9a7a50');
    rect(1, 1, S - 2, S - 2, '#c9ab7a');
    rect(2, 2, S - 3, S - 3, '#fff2d4');
    rect(2, 2, S - 4, S - 4, '#ead3a6');
  });
  const slotSel = frame(8, ({ rect, S }) => {
    rect(0, 0, S, S, '#c98f22');
    rect(1, 1, S - 2, S - 2, '#f5d44a');
    rect(2, 2, S - 4, S - 4, '#fff0c0');
  });
  const btn = (fill, hi, lo) => frame(10, ({ rect, px, S }) => {
    rect(1, 0, S - 2, S, '#3b2416'); rect(0, 1, S, S - 2, '#3b2416');
    rect(1, 1, S - 2, S - 2, fill);
    rect(1, 1, S - 2, 1, hi); rect(1, 2, 1, S - 4, hi);
    rect(1, S - 3, S - 2, 2, lo);
    px(1, 1, '#3b2416'); px(S - 2, 1, '#3b2416'); px(1, S - 2, '#3b2416'); px(S - 2, S - 2, '#3b2416');
  });
  const root = document.documentElement.style;
  root.setProperty('--img-panel', `url(${panel})`);
  root.setProperty('--img-paper', `url(${paper})`);
  root.setProperty('--img-dark', `url(${dark})`);
  root.setProperty('--img-slot', `url(${slot})`);
  root.setProperty('--img-slot-sel', `url(${slotSel})`);
  root.setProperty('--img-btn', `url(${btn('#e0b27a', '#f4d0a0', '#b07a4a')})`);
  root.setProperty('--img-btn-hover', `url(${btn('#ecc28a', '#fff0c8', '#c08a58')})`);
  root.setProperty('--img-btn-down', `url(${btn('#c08a58', '#a8723f', '#d49a64')})`);
}
