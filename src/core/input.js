// Pointer (mouse + touch) and keyboard state. The game is played entirely with the cursor;
// keys are optional shortcuts. UI code sets `input.blocked` while menus are open.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();
    this.blocked = false;
    this.wheel = 0;
    this.wheelX = 0; this.wheelY = 0;
    this.mouse = {
      x: innerWidth / 2, y: innerHeight / 2, onCanvas: false,
      left: false, right: false, middle: false,
      leftPressed: false, leftReleased: false, rightPressed: false, rightReleased: false, middlePressed: false,
      downX: 0, downY: 0, moved: 0, // distance moved since the last press
    };
    this.touches = new Map();
    this.pinch = null; // { dist, cx, cy } while two fingers are down
    this.pinchDelta = { dx: 0, dy: 0, zoom: 0 };

    addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (!this.keys.has(k)) this.pressed.add(k);
      this.keys.add(k);
      if ([' ', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key));
    addEventListener('blur', () => { this.keys.clear(); this.release(); });

    canvas.addEventListener('pointerdown', (e) => this.onDown(e));
    addEventListener('pointermove', (e) => this.onMove(e));
    addEventListener('pointerup', (e) => this.onUp(e));
    addEventListener('pointercancel', (e) => this.onUp(e));
    canvas.addEventListener('pointerenter', () => { this.mouse.onCanvas = true; });
    canvas.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') this.mouse.onCanvas = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.wheel += Math.sign(e.deltaY);
      this.wheelX = e.clientX; this.wheelY = e.clientY;
    }, { passive: false });
  }

  onDown(e) {
    const m = this.mouse;
    m.x = e.clientX; m.y = e.clientY; m.onCanvas = true;
    try { this.canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    if (e.pointerType === 'touch') {
      this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.touches.size === 2) {
        // second finger: cancel the one-finger action and start a pan/pinch gesture
        if (m.left) { m.left = false; m.leftCancelled = true; }
        this.pinch = this.pinchInfo();
        return;
      }
      if (this.touches.size > 2) return;
    }
    m.downX = e.clientX; m.downY = e.clientY; m.moved = 0;
    if (e.button === 0) { m.left = true; m.leftPressed = true; m.leftCancelled = false; }
    if (e.button === 2) { m.right = true; m.rightPressed = true; }
    if (e.button === 1) { m.middle = true; m.middlePressed = true; e.preventDefault(); }
  }

  onMove(e) {
    const m = this.mouse;
    if (e.pointerType === 'touch' && this.touches.has(e.pointerId)) {
      this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pinch && this.touches.size === 2) {
        const p = this.pinchInfo();
        this.pinchDelta.dx += p.cx - this.pinch.cx;
        this.pinchDelta.dy += p.cy - this.pinch.cy;
        const ratio = p.dist / this.pinch.dist;
        if (ratio > 1.35 || ratio < 0.74) { this.pinchDelta.zoom += ratio > 1 ? -1 : 1; this.pinch.dist = p.dist; }
        this.pinch.cx = p.cx; this.pinch.cy = p.cy;
        m.x = p.cx; m.y = p.cy;
        return;
      }
    }
    m.moved = Math.max(m.moved, Math.hypot(e.clientX - m.downX, e.clientY - m.downY));
    m.x = e.clientX; m.y = e.clientY;
  }

  onUp(e) {
    const m = this.mouse;
    if (e.pointerType === 'touch') {
      this.touches.delete(e.pointerId);
      if (this.pinch) { if (this.touches.size < 2) this.pinch = null; if (this.touches.size === 0) m.left = false; return; }
    }
    if (e.button === 0 && m.left) { m.left = false; m.leftReleased = true; }
    if (e.button === 2 && m.right) { m.right = false; m.rightReleased = true; }
    if (e.button === 1) m.middle = false;
  }

  pinchInfo() {
    const [a, b] = [...this.touches.values()];
    return { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
  }

  release() {
    const m = this.mouse;
    m.left = m.right = m.middle = false;
  }

  down(...ks) { return !this.blocked && ks.some((k) => this.keys.has(k)); }
  hit(...ks) { return ks.some((k) => this.pressed.has(k)); }

  /** Swallow everything currently pressed (used when the UI handles a click/key). */
  consume() {
    this.pressed.clear();
    this.keys.clear();
    const m = this.mouse;
    m.left = m.right = m.middle = false;
    m.leftPressed = m.rightPressed = m.middlePressed = m.leftReleased = m.rightReleased = false;
  }

  endFrame() {
    this.pressed.clear();
    const m = this.mouse;
    m.leftPressed = m.leftReleased = m.rightPressed = m.rightReleased = m.middlePressed = false;
    this.wheel = 0;
    this.pinchDelta = { dx: 0, dy: 0, zoom: 0 };
  }
}
