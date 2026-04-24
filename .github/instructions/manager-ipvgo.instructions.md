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
