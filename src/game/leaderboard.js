// Global leaderboard backed by Firebase Realtime Database (free tier), using plain REST calls.
// Each browser signs in anonymously, so a player can only ever overwrite their own entry
// (see database.rules.json). Configure the project in LEADERBOARD inside src/config.js.
import { LEADERBOARD } from '../config.js';

const AUTH_KEY = 'dewdrop-garden-lb-auth';
export const STATS = {
  coins: { label: 'Coins', short: 'Coins' },
  earned: { label: 'Total earned', short: 'Earned' },
  harvested: { label: 'Crops harvested', short: 'Harvested' },
};

class Leaderboard {
  constructor() {
    this.cfg = { authHost: 'https://identitytoolkit.googleapis.com', tokenHost: 'https://securetoken.googleapis.com', ...LEADERBOARD };
    // debug/testing: ?debug&lbtest=http://localhost:PORT points everything at a fake server
    const q = new URLSearchParams(location.search);
    if (q.has('debug') && q.get('lbtest')) {
      const t = q.get('lbtest');
      this.cfg = { apiKey: 'test', dbUrl: t, authHost: t, tokenHost: t };
    }
    try { this.auth = JSON.parse(localStorage.getItem(AUTH_KEY) || 'null'); } catch { this.auth = null; }
    this.lastSent = '';
    this.sending = null;
  }

  get enabled() { return !!(this.cfg.apiKey && this.cfg.dbUrl); }
  get uid() { return this.auth && this.auth.uid; }
  get base() { return this.cfg.dbUrl.replace(/\/$/, '') + '/dewdrop/scores'; }

  storeAuth(a) {
    this.auth = a;
    try { localStorage.setItem(AUTH_KEY, JSON.stringify(a)); } catch { /* private mode */ }
  }

  async token() {
    const a = this.auth;
    if (a && a.idToken && a.exp > Date.now() + 60_000) return a.idToken;
    if (a && a.refreshToken) {
      const r = await fetch(`${this.cfg.tokenHost}/v1/token?key=${this.cfg.apiKey}`, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(a.refreshToken)}`,
      });
      if (r.ok) {
        const j = await r.json();
        this.storeAuth({ uid: j.user_id, idToken: j.id_token, refreshToken: j.refresh_token, exp: Date.now() + Number(j.expires_in) * 1000 });
        return this.auth.idToken;
      }
    }
    const r = await fetch(`${this.cfg.authHost}/v1/accounts:signUp?key=${this.cfg.apiKey}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ returnSecureToken: true }),
    });
    if (!r.ok) throw new Error('Leaderboard sign-in failed');
    const j = await r.json();
    this.storeAuth({ uid: j.localId, idToken: j.idToken, refreshToken: j.refreshToken, exp: Date.now() + Number(j.expiresIn) * 1000 });
    return this.auth.idToken;
  }

  static entryFor(game) {
    const harvested = Object.values(game.stats.harvested || {}).reduce((a, b) => a + b, 0);
    return {
      name: String(game.name || 'Gardener').replace(/[^\p{L}\p{N} _.'!-]/gu, '').slice(0, 16) || 'Gardener',
      coins: Math.max(0, Math.floor(game.coins)),
      earned: Math.max(0, Math.floor(game.stats.earned || 0)),
      harvested,
      days: game.day,
      meadow: !!game.meadowOwned,
    };
  }

  /** Upload this garden's stats (skipped for sandbox gardens and when nothing changed). */
  async submit(game, force = false) {
    if (!this.enabled || game.sandbox) return false;
    const entry = Leaderboard.entryFor(game);
    const key = JSON.stringify(entry);
    if (!force && key === this.lastSent) return false;
    if (this.sending) return this.sending;
    this.sending = (async () => {
      try {
        const t = await this.token();
        const r = await fetch(`${this.base}/${this.uid}.json?auth=${t}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...entry, updated: { '.sv': 'timestamp' } }),
        });
        if (r.ok) this.lastSent = key;
        return r.ok;
      } catch {
        return false;
      } finally {
        this.sending = null;
      }
    })();
    return this.sending;
  }

  /** Top players for a stat, best first. */
  async top(stat, n = 50) {
    if (!this.enabled) return [];
    const r = await fetch(`${this.base}.json?orderBy=${encodeURIComponent(JSON.stringify(stat))}&limitToLast=${n}`);
    if (!r.ok) throw new Error('Could not load the leaderboard');
    const j = (await r.json()) || {};
    return Object.entries(j)
      .map(([id, e]) => ({ id, ...e }))
      .sort((a, b) => (b[stat] || 0) - (a[stat] || 0));
  }
}

export const leaderboard = new Leaderboard();
