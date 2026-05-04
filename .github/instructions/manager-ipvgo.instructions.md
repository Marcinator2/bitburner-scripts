---
description: "Use when working on manager_ipvgo.js. Contains IPvGO strategy weights, opponent profiles, and move scoring logic."
applyTo: "manager_ipvgo.js"
---

# manager_ipvgo.js — IPvGO Manager

## Purpose
Plays IPvGO matches in an endless loop against a configurable opponent. Uses a heuristic scoring function with per-opponent tuned strategy weights.

## Args
| Index | Default | Purpose |
|-------|---------|---------|
| 0 | `"Slum Snakes"` | Opponent name |
| 1 | 7 | Board size |

## Supported Opponents
`Netburners`, `Slum Snakes`, `The Black Hand`, `Tetrads`, `Illuminati`.
Any other name falls back to `DEFAULT_STRATEGY`.

## Strategy Weight Fields
Each strategy entry in `STRATEGIES` controls the scoring weights:

| Field | Effect |
|-------|--------|
| `captureW` | Bonus per captured opponent stone |
| `connW` | Bonus per adjacent own stone (connectivity) |
| `atariW` | Bonus per opponent chain placed in atari (1 liberty) |
| `preAtariW` | Bonus per opponent chain reduced to 2 liberties |
| `cutW` | Bonus per opponent group separated by this move |
| `bridgeW` | Bonus per own group connected by this move |
| `selfAtari1` | Penalty when new chain has only 1 liberty and no captures |
| `selfAtari2` | Penalty when new chain has only 2 liberties and no captures |
| `eyeFill` | Penalty for filling own eye |
| `cornerW` | Early-game multiplier for corner/edge preference |
| `passThresh` | Pass the move if best score is below this value |
| `opponentSkillW` | 0 = ignore opponent reply, 1 = assume perfect opponent response |
| `oppAtariW` | (optional) 2-ply: bonus for reducing X chain to 1 lib (default 14) |
| `oppPreAtariW` | (optional) 2-ply: bonus for reducing X chain to 2 libs (default 6) |
| `oppCutW` | (optional) 2-ply: bonus per X group separated (default 10) |
| `oppEdgeW` | (optional) 2-ply: extra bonus for threatening X chains near edge (default 0) |

## Opponent Profiles (rationale)
- **Netburners**: weak, isolated stones — high atari weight, low `opponentSkillW`.
- **Slum Snakes**: long snake chains — high cut weight, medium `opponentSkillW`.
- **The Black Hand**: aggressive surrounder — high connectivity and bridge weight, full `opponentSkillW`.
- **Tetrads**: cutters — high bridge and cut weight, high `opponentSkillW`.
- **Illuminati**: trap-based defense — high self-atari penalties, full `opponentSkillW`.

## Adding a New Opponent
Add an entry to `STRATEGIES` with all fields defined. Do not leave any field undefined — missing fields are not defaulted by the code.

## Game Loop
- Calls `ns.go.resetBoardState(opponent, boardSize)` to start each game.
- On `resetBoardState` failure: waits 5 s and retries.
- Tracks win/loss/draw stats across the session.
- Passes (`consecutivePasses`) ends the game after 2 consecutive passes by both sides.

---

## Illuminati — Tried Optimizations (do not repeat)

Reference: ~370 games played, 6 wins total. Only 1 win in the first 311 games (game 291, 21 moves, won by 1.5). Current win rate ~1.6%.

### What is known about Illuminati
- Hard AI that punishes every tactical mistake immediately.
- Favors encirclement — edge stones get surrounded fast.
- The only consistent win (game 291) was a **connected line of stones**, NOT a cluster.
- Games with ≤5 moves always end in catastrophic loss (score 0–49, full captures).
- Games with 15–21 moves are competitive but still usually lost.

### ❌ TRIED — opponentSkillW 0.5 (was 1.0)
**Hypothesis:** At 1.0 the 2-ply territory delta collapses to ≈0 for all moves, making the engine quasi-random and causing early passes.  
**Result:** Worse. The engine played more moves but built tight clusters that Illuminati surrounded and captured entirely (games 349, 352: score 0–49). Do NOT lower `opponentSkillW` below 1.0 for Illuminati.

### ❌ TRIED — connW 3.0 + bridgeW 12 (was 1.5 / 6)
**Hypothesis:** Connected groups survive; isolated stones get captured.  
**Result:** These were set alongside `opponentSkillW 0.5`. The high connectivity weights caused clustering, which is exactly what Illuminati exploits. Cannot isolate effect from `opponentSkillW` change, but cluster-building is demonstrably bad. Do NOT raise `connW` above ~2.0 for Illuminati.

### ❌ TRIED — passThresh -6 (was -2)
**Hypothesis:** Keep playing longer; premature passes hand Illuminati free territory.  
**Result:** Applied together with the above, outcome worse. The sole win (game 291) had a -0.5 second move, so some tolerance is needed, but -6 is too permissive. Marginal value: using -4 as compromise.

### ❌ TRIED — saveAtariW 50, savePreAtariW 20, selfAtari1 60, selfAtari2 20 (aggressive rescue)
**Hypothesis:** Escaping encirclement must dominate all other decisions.  
**Result:** No measurable improvement over the conservative baseline values. Illuminati still wins by territory/encirclement even when we escape individual atari threats.

### ⚠️ TRYING — Improved opponentBestResponse (encirclement modelling)
**Hypothesis:** The old `opponentBestResponse` only scored `(oT - xT)*2 + xCaps*5`. This means the 2-ply assumed Illuminati plays pure territory, missing atari threats and cut moves. By adding local atari detection (+14 per adjacent X chain at 1 lib, +6 at 2 libs) and cut bonus (+10 per X group separated), the 2-ply should now anticipate Illuminati's real strategy and prefer moves that leave our chains harder to encircle.
**Result:** TBD
- **passThresh: -1.5** (trying since ~game 48): scores in recent games are all well above -1.5, so this is not causing early exits. Short games (3-5 moves) are Illuminati dominating, not premature passes.
- **Board size stats** (current log, 20 Illuminati entries):
  - 7x7: **0/7 wins**, avg score diff -15.4, avg 10.6 moves
  - 9x9: **1/9 wins**, avg score diff -15.9, avg 17.1 moves ← only size with a win recently
  - 13x13: **0/4 wins**, avg score diff -26.5, avg 37.2 moves
  - Conclusion: 9x9 and 7x7 are similarly competitive. 13x13 is worse. Historical wins (291, 36) were on 7x7, so 7x7 is not hopeless.

### Log files
One file per opponent: `ipvgo_gamelog_<safe_name>.js` (spaces → `_`). Each file stores a JSON array of up to `IPVGO_LOG_MAX = 100` game entries. Files do NOT grow further once full.

---

## Tetrads — Log Analysis & Tried Optimizations

Reference: 20 games logged (3 wins all on 9x9, 0 wins on 7x7).

### Board size stats (20 entries)
- 9x9: **3/17 wins**, avg score diff −13.1, avg 30.2 moves
- 7x7: **0/3 wins**, avg score diff −11.2, avg 13.0 moves ← dies after only 4 moves

### What is known about Tetrads
- Martial AI — excels at edge encirclement of chains that drift to corners.
- 9x9 is competitive (3 wins); 7x7 breaks after 4 moves due to premature passing.
- Winning games (12, 13, 14) had high avg move scores and full game length.

### ❌ TRIED — passThresh 0.0 (was tried, caused 7x7 to abort after 4 moves)
**Hypothesis:** Negative-scoring moves hurt territory; pass instead.  
**Result:** On 7x7 with `opponentSkillW=0.9`, the 2-ply territory delta collapses near zero on an early open board, causing all expansion moves to score <0. Game 1 (7x7) ended at move 3 (score 0.4). Do NOT use passThresh≥0 for Tetrads.

### ❌ TRIED — opponentSkillW 1.0 (was 0.9)
**Hypothesis:** More accurate 2-ply prediction detects Tetrads traps earlier.  
**Result:** 2-ply territory delta collapses to ≈0 on open 9x9 boards. Games 12, 17, 18 ended after only 1 move. Do NOT raise opponentSkillW above 0.9 for Tetrads.

### ❌ TRIED — cornerW -1.5 (was tried, caused corner clustering)
**Hypothesis:** -1.5 penalty is enough to keep us out of corners/edges.  
**Result:** Game 19 (21-58.5, avg score 25.4): move 3 jumped to edge (6,7) scoring 8.5 despite -1.5 edge penalty, then moves 4-8 all stayed in that corner cluster → Tetrads surrounded the whole group. -1.5 is too weak for high-scoring corner salvage moves. Replaced with -2.5.

### ❌ TRIED — cornerW -2.5 (was -1.5)
**Hypothesis:** Stronger edge penalty prevents corner clustering (game 19 edge jump).  
**Result:** Catastrophic. On 7x7, only dist=3 (center) gets +2.5; all other cells get 0 or negative. Forces all play into a tight center cluster. Tetrads surrounds it easily. Dropped from 2/8 to 1/18 wins on 7x7. Do NOT lower cornerW below -1.5 for Tetrads.

### ⚠️ TRYING — connW 0.5 (was 1.0, since game 6 7x7)
**Hypothesis:** On 7x7, `cornerW=-1.5` makes only center (3,3) positive. Adjacent cells score 0 from cornerW but get +1.0 from connW per neighbor → engine clusters around center. Lowering to 0.5 reduces the clustering pull.  
**Result:** TBD

### ⚠️ TRYING — opponent-specific 2-ply response profile (since game 9 9x9)
**Hypothesis:** The shared `opponentBestResponse` was tuned for Illuminati (slow atari-chain reduction). Tetrads plays differently: aggressive edge encirclement + cutting. New `opp*` fields in the Tetrads strategy override the response model: `oppAtariW=8`, `oppPreAtariW=3`, `oppCutW=20`, `oppEdgeW=10`. The edge bonus rewards Tetrads for threatening our chains near edges (dist≤1), so our 2-ply now anticipates and avoids placing stones on the edge where Tetrads can trap them.  
**Result:** TBD
**Hypothesis:** cornerW=-2.5 gives: corner=-5, edge=-2.5, 2-in=0, center=+5. Stronger deterrent against early corner jumps. opponentSkillW reverted to 0.9 to prevent 1-move collapse. passThresh=-1.5 stays (fixed 7x7).  
**Result:** TBD

### Improved eye detection
The current `isEye()` only checks 4 cardinal neighbors are own stones (full eye). False eyes are not detected.

### 3-ply or iterative deepening
2-ply may not be deep enough to see Tetrads' multi-step encirclement setups.

---

## Illuminati — Tried Optimizations (do not repeat)
