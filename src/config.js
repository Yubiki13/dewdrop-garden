export const VERSION = '0.2.0';
export const TILE = 16;
export const MAP_W = 60;
export const MAP_H = 44;

export const HOUR_SECONDS = 20; // real seconds per in-game hour (a full day ≈ 8 minutes)
export const WET_HOURS = 22; // how long watered soil stays wet
export const DAY_START = 6 * 60; // minutes

export const G_GRASS = 0;
export const G_SOIL = 1;
export const G_WATER = 2;

export const F_NONE = 0;
export const F_PATH = 1;

export const PAN_SPEED = 260; // keyboard camera pan, world px / s
export const ZOOM_LEVELS = [380, 310, 250, 200, 160]; // target view height in world px (bigger = further out)
export const DEFAULT_ZOOM = 2;


export const SAVE_KEY = 'dewdrop-garden-save-v2';
export const SETTINGS_KEY = 'dewdrop-garden-settings';
