export const VERSION = '1.3.0';
export const TILE = 16;
export const ORIG_W = 60; // the farm (garden, meadow, hills) is the first 60 columns
export const MAP_W = 100; // + the Wildwood to the east (columns 60..99)
export const WILD_X = 60;
export const ORIG_H = 44; // rows of the original garden
export const MEADOW_END = 70; // + the Riverside Meadow below it (rows ORIG_H..69)
export const MAP_H = 100; // + Blossom Hills below that (rows 70..99)
export const MEADOW_PRICE = 50000;
export const HILLS_PRICE = 500000;

export const HOUR_SECONDS = 20; // real seconds per in-game hour (a full day ≈ 8 minutes)
export const WET_HOURS = 22; // how long watered soil stays wet
export const DAY_START = 6 * 60; // minutes

export const G_GRASS = 0;
export const G_SOIL = 1;
export const G_WATER = 2;

export const F_NONE = 0;
export const F_PATH = 1;

export const PAN_SPEED = 260; // keyboard camera pan, world px / s
export const ZOOM_LEVELS = [560, 440, 340, 270, 210, 165]; // target view height in world px (bigger = further out)
export const DEFAULT_ZOOM = 3;


export const SAVE_KEY = 'dewdrop-garden-save-v2';
export const SETTINGS_KEY = 'dewdrop-garden-settings';

// Global leaderboard (Firebase Realtime Database). Leave empty to hide it.
// See docs/LEADERBOARD_SETUP.md: it's free and takes about 5 minutes.
export const LEADERBOARD = {
  apiKey: 'AIzaSyConaii2Yj0PB10dFMftvXdDuo8MPzS5pM',
  dbUrl: 'https://dewdrop-garden-default-rtdb.firebaseio.com',
};
