---
description: "Use when working on manager_backdoor.js. Contains BFS backdoor logic and connect/reconnect safety."
applyTo: "manager_backdoor.js"
---

# manager_backdoor.js — Backdoor Manager

## Purpose
Installs backdoors on all reachable servers in a loop. Requires Source-File 4 (Singularity API).

## API Guard
- Check `typeof ns.singularity?.installBackdoor === "function"`.
- Exit with `ns.tprint("ERROR: Singularity API not available (SF4 required).")` + `return`.

## Key Constants (inside main)
| Constant | Value | Purpose |
|----------|-------|---------|
| `LOOP_DELAY_MS` | 30 000 ms | Pause between full BFS passes |

## BFS Logic
- `scanAll()`: BFS from `"home"` collects all reachable servers.
- `findPath(target)`: BFS to build the connect-chain from home to a target (needed for `singularity.connect()`).

## Candidate Selection
A server is a backdoor candidate if:
1. Not `"home"`.
2. Not a purchased server.
3. Has root access.
4. Required hack level ≤ player hack level.
5. Does **not** already have a backdoor (`ns.getServer(s).backdoorInstalled !== true`).

## Safety: Always Reconnect to Home
- At the start of every pass: `ns.singularity.connect("home")` inside a try/catch.
- This ensures we return home even if the script was killed mid-connect-chain.
- Never remove this reconnect.

## Connect Chain
- To install a backdoor, the player must navigate to the server via `singularity.connect()`.
- `findPath()` builds the full path; each hop is connected in sequence.
- After installing, reconnect to `"home"` before continuing to the next target.
