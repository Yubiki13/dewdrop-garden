# Turning on the global leaderboard

The leaderboard uses **Firebase Realtime Database** (Google, free "Spark" plan, no credit card).
It takes about 5 minutes and you only do it once.

1. Go to <https://console.firebase.google.com> and sign in with a Google account.
2. **Create a project** → name it e.g. `dewdrop-garden` → you can turn Google Analytics **off** → *Create project*.
3. In the left menu open **Build → Authentication** → *Get started* → **Sign-in method** tab →
   click **Anonymous** → switch it **on** → *Save*.
4. In the left menu open **Build → Realtime Database** → *Create Database* → pick a location →
   choose **Start in locked mode** → *Enable*.
5. Still in Realtime Database, open the **Rules** tab, delete everything in the box and paste the
   contents of [`database.rules.json`](../database.rules.json) from this repo → *Publish*.
6. Copy two things:
   - the **database URL** shown at the top of the Realtime Database page
     (looks like `https://dewdrop-garden-xxxxx-default-rtdb.firebaseio.com`)
   - the **Web API Key**: click the ⚙️ gear next to *Project Overview* → **Project settings** →
     *General* tab → "Web API Key".
7. Put them into `src/config.js`:

   ```js
   export const LEADERBOARD = {
     apiKey: 'AIza...your key...',
     dbUrl: 'https://dewdrop-garden-xxxxx-default-rtdb.firebaseio.com',
   };
   ```

8. Commit and push. The Leaderboard button appears in the game.

**Is it safe to put the key in a public repo?** Yes. A Firebase Web API key only identifies the
project; it isn't a password. What protects the data is the rules file: anyone can *read* the
board, but each player can only write their *own* entry, and only with sensible values.
(It's a browser game, so a determined cheater could still fake their own score. That's normal
for small indie leaderboards.)
