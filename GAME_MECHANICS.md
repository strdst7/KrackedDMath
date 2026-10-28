# Game mechanics

KrackedDMath is a real-time arithmetic tug-of-war game for solo players, local duels, and online opponents. Play the [live game](https://strdst7.github.io/KrackedDMath/).

This document describes the current implementation, not proposed rules. `src/App.tsx` owns match state and scoring. `src/game/math.ts` creates problems and defines modes. `src/game/net.ts` carries online messages.

## Objective and match flow

- **Red:** Correct answers heave the rope left.
- **Blue:** Correct answers heave the rope right.
- **Win:** The first side to move the rope position to `-100` or `+100` wins.
- **Pull counter:** Starts at `1` and increases after each correct answer. It counts successful heaves, not distance.
- **Reset or rematch:** Restarts a match at the center and resets its scores, streaks, and surge.

The rope position starts at zero. Each frame applies velocity to the position and damps velocity exponentially. Heaves add velocity rather than instantly moving the rope a fixed distance. A small center zone displays `DEADLOCK` when the position stays within ten units of zero. The displayed tug marker tracks rope position. The drawn rope joins both characters' hands and moves with their shared stage.

## Modes

| Mode | Red side | Blue side | Problems |
| --- | --- | --- | --- |
| `1P vs Bot` | Player | Bot | Separate equations |
| `Bot vs Bot` | Bot | Bot | Separate equations |
| `2P Duel` | Local player one | Local player two | Separate equations |
| `Online Duel` | Host | Guest | Same equation |

The default offline mode is `1P vs Bot` at Standard complexity. Desktop controls cycle through offline modes and complexity tiers. The online room replaces the offline match until a player leaves it.

## Problems and complexity

`generateProblem()` chooses addition, subtraction, multiplication, or division. Every problem presents four distinct positive answers, including exactly one correct answer. Division always produces an integer. The tier stays between `1` and `4`.

| Tier | Name | Example range or construction | Bot thinking time |
| --- | --- | --- | --- |
| `1` | Novice | Small sums, differences, products, and exact division | `1,200–1,800 ms` |
| `2` | Standard | Two-digit sums and differences, multiplication tables, exact division | `1,800–2,600 ms` |
| `3` | Advanced | Larger sums and differences, teen products, exact division | `2,500–3,500 ms` |
| `4` | Master | Large sums and differences, larger products, exact division | `3,400–4,600 ms` |

The table describes problem types, not strict result limits. `src/game/math.ts` defines the operand ranges. A new offline problem appears after the answer cooldown. Each offline contender tracks its own tier and problem. The online host generates a shared problem for both players.

### Tier changes

- **Offline correct:** At streak `3` or higher, each subsequent correct answer raises the tier by one until tier `4`.
- **Offline wrong:** The tier falls by one until tier `1`.
- **Online correct:** The host computes `baseTier + floor(hotStreak / 3)`, clamped to `1–4`.
- **Online wrong:** The shared tier does not fall.

`hotStreak` is the larger of the red streak and the answering side's new streak in the current code. Online tier progression therefore does not symmetrically consider an existing blue streak.

## Answer resolution

Players tap or click an answer card. The game compares that card's numeric value with the problem's answer. A correct answer increases score, streak, surge, and pull count. A wrong answer clears the streak and reduces surge. The selected card flashes green or red during its cooldown.

| Rule | Offline | Online |
| --- | --- | --- |
| Correct cooldown | `620 ms` for the answering side | `620 ms` for both sides |
| Wrong cooldown | `800 ms` for the answering side | `800 ms` for the answering side |
| Next problem | Only that side gets a new problem | Correct answer replaces the shared problem immediately |
| Incorrect answer | Answering side receives a new problem after cooldown | Shared problem stays active |

Online guests send the selected answer index to the host. The host compares it with the current shared answer. It rejects answer indices outside the four cards and answers during an active lock.

### Score and speed

A correct answer awards `10 + round(speedBonus / 2) + min(streak × 2, 10)` score points. The new streak counts for that answer.

| Solve time | `speedBonus` | Visible feedback |
| --- | --- | --- |
| Less than `1.4 s` | `20` | `FAST! +20%` |
| At least `1.4 s`, less than `2.2 s` | `10` | Normal heave or streak feedback |
| `2.2 s` or more | `0` | Normal heave or streak feedback |

`FAST! +20%` is display text. In the current code, the bonus affects score and surge, not the rope's heave strength.

### Surge and heave

- **Correct answer below full surge:** Add `35 + speedBonus + min(streak × 4, 16)` surge, capped at `100`.
- **Correct answer at full surge:** Spend all surge and trigger a super heave. The same answer does not refill surge.
- **Wrong answer:** Subtract `15` surge, floored at zero.
- **Normal heave:** Add velocity in the answering side's direction.
- **Super heave:** Multiply normal heave strength by `1.75`.

A streak increases heave strength by five percent per additional answer. The increase caps at 20%. Near the winning boundary, heaves lose half their strength. `heaveFx()` defines both rules in `src/App.tsx`.

## Bot behavior

Offline bots wait for a randomized thinking interval based on the selected complexity. They answer correctly with `94%` probability. On a miss, they choose one of the three wrong cards. Their cards show shape labels `◆`, `★`, `●`, and `▲` instead of player hotkeys. The answer values remain numeric. Bots use the same offline scoring, surge, heave, and cooldown rules as players.

The bot thinking interval comes from the selected complexity, even when streaks change its problem tier. The bot does not run in `Online Duel`.

## Controls

| Input | Effect |
| --- | --- |
| Tap or click an answer card | Select that card |
| `1`–`4` | Select the matching card for the active player |
| `Q W E R` or `A S D F` | Select cards one through four for the active player |
| Arrow keys | Select blue cards in `2P Duel` or as an online guest |
| Number pad | Select blue cards in `2P Duel`; other modes use red |
| Other typed digits | Build a direct numeric answer, up to four digits |
| `Space`, `Enter`, or `R` after a win | Rematch |
| `Escape` | Close a help/stats overlay or the room lobby |

Keys `1`–`4` take priority as card shortcuts, including when entering a numeric answer. Direct numeric entry therefore does not work reliably for answers containing those digits. Avoid treating it as an equivalent input method. The mobile interface supports answer-card taps. Offline mode and complexity controls appear only at the `sm` breakpoint and above.

## Online rooms and sync

The host creates a five-character room code. An invite uses the same page path with `?join=<code>`. The guest joins as blue. PeerJS connects different browsers or devices through its public broker. BroadcastChannel connects two tabs in the same browser as a local fallback. The lobby runs a three-step countdown after the connection opens.

The host owns the shared problem, answer decisions, rope physics, scores, and winner. It sends match snapshots roughly `15` times per second. The guest smooths its visible rope position toward the host snapshot. The room link also sends events for heaves, misses, surge, and the win. It pings every two seconds and closes after eleven seconds without inbound messages.

Cross-device play depends on the public PeerJS relay and a working peer connection. The same-browser fallback cannot connect separate devices. The current client trusts the host; the room code is not authentication. Cross-device play has not received an end-to-end live check.

## Career stats and persistence

The browser stores matches, wins, losses, attempted and correct problems, streaks, fastest solve, and online win/loss counts in `localStorage`. The Stats panel displays those values and can wipe them. Sound and handle preferences also persist in `localStorage`. These records do not sync across browsers or devices.

Offline human answers update problem stats. Bot answers do not. The online host records its own answers and match result. The guest records answer events. The guest does not record the match result after a host win snapshot. In `Bot vs Bot`, match stats treat a blue win as a player win. These bookkeeping limits prevent reliable competitive rankings.

## Source map

| File | Mechanic |
| --- | --- |
| `src/game/math.ts` | Operators, operand ranges, answer cards, tiers, modes |
| `src/App.tsx` | Match state, scoring, streaks, surge, heave physics, controls, stats |
| `src/game/net.ts` | Room codes, peer link, local fallback, messages, timeouts |
| `src/game/types.ts` | Match, card, career, and snapshot shapes |
| `src/components/CombatCard.tsx` | Answer cards, bot symbols, status, surge display |
| `src/components/Lobby.tsx` | Host/join controls and start countdown |
| `src/components/Overlays.tsx` | Help, career stats, win, and rematch panels |
