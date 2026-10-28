# KrackedDMath

KrackedDMath is a browser-based mental-math tug-of-war game for solo players and two-player duels. **[Play the game](https://strdst7.github.io/KrackedDMath/).**

[![Deploy game](https://github.com/strdst7/KrackedDMath/actions/workflows/deploy.yml/badge.svg)](https://github.com/strdst7/KrackedDMath/actions/workflows/deploy.yml)
[![Play online](https://img.shields.io/badge/Play-online-ffb020)](https://strdst7.github.io/KrackedDMath/)

## The game

Two contenders solve arithmetic problems while pulling the same rope. Correct answers heave the rope toward the opponent's boundary. Cross the line to win.

- **Modes:** Play against a bot, watch two bots compete, or share a keyboard for a local duel.
- **Online duel:** Create a room and send its five-character code or invite link. The host plays red, and the guest plays blue.
- **Problems:** Addition, subtraction, multiplication, and division span four complexity tiers: Novice, Standard, Advanced, and Master.
- **Momentum:** Correct streaks build a power surge. Once full, the next correct answer triggers a stronger heave. Wrong answers cost surge and lower the offline tier.
- **Career stats:** The browser stores match records, accuracy, streaks, and fastest solves in local storage. The Stats panel can clear them.
- **Sound:** Toggle sound effects from the game header.

### Controls

| Action | Control |
| --- | --- |
| Select an answer | Click or tap its card |
| Select cards 1–4 | `1`–`4`, `Q W E R`, or `A S D F` |
| Select the blue player's cards in a local duel | Arrow keys or number pad |
| Enter an answer directly | Type its digits |
| Rematch after a win | `Space`, `Enter`, or `R` |
| Close an overlay or room lobby | `Escape` |

The in-game **How to play** panel shows the controls and scoring mechanics.

### Online connection

PeerJS provides the cross-device WebRTC connection through its public broker. BroadcastChannel provides a same-browser, two-tab path. The host computes the online match state and sends snapshots to the guest. The public relay and peer network must be reachable for cross-device play. Cross-device multiplayer has not received an end-to-end check on the live site.

## Run locally

Use Node.js 22 and npm from the repository root:

```bash
git clone https://github.com/strdst7/KrackedDMath.git
cd KrackedDMath
npm ci
npm run dev
```

Open the local URL printed by Vite. Run these checks before publishing changes:

```bash
npx tsc --noEmit
npm run build
```

`npm run preview` serves the production build locally. Vite builds the application JavaScript and CSS into `dist/index.html`. Character artwork remains under `dist/images/`.

## Project map

| Path | Purpose |
| --- | --- |
| `src/App.tsx` | Match state, controls, scoring, and UI wiring |
| `src/game/math.ts` | Problems, tiers, and game modes |
| `src/game/net.ts` | PeerJS and BroadcastChannel room link |
| `src/game/audio.ts` | Sound effects |
| `src/components/` | Lobby, answer cards, overlays, and display |
| `public/images/` and `src/assets/` | Character and arena artwork |
| `.github/workflows/deploy.yml` | Build and GitHub Pages deployment |

## Deployment

Pushes to `main` run `npm ci`, the TypeScript check, and `npm run build`. The workflow publishes `dist/` to GitHub Pages at https://strdst7.github.io/KrackedDMath/. Vite's base path is `/KrackedDMath/` in `vite.config.ts`; update it when changing the deployment path.

## License and assets

The repository includes the [GNU General Public License v3.0](LICENSE) for the game code. Read its terms before copying, modifying, or distributing the code.

The character and arena artwork's origin and redistribution rights remain unconfirmed. Do not assume the code license grants rights to reuse the artwork.
