---
description: "General coding guidelines for all Bitburner NS2 scripts in this project. Use when writing or editing any .js file."
applyTo: "**/*.js"
---

# Project-Wide Coding Guidelines

## Language
- All code comments and `ns.print` / `ns.tprint` messages must be written in **English**.

## Script Structure
- Every runnable script starts with `/** @param {NS} ns */` directly above `export async function main(ns)`.
- Library files (no `main`) use named exports only.

## Constants
- All configuration constants are defined **inside `main()`**, not at module level.
- Exception: `manager_corporation.js` keeps module-level constants because they are shared across many helper functions — this pattern stays as-is in that file.
- Library constants (exported from `training_location_utils.js` etc.) are module-level by necessity — that is also fine.
- Use `SCREAMING_SNAKE_CASE` for all constants.

## Config Reading
- Every manager that has a loop reads its `loopMs` from `main_manager_config.js` via `ns.read()` or `ensureJsonFile()`.
- Always provide a local fallback constant (e.g. `const DEFAULT_LOOP_MS = 5000`).
- The config file is `main_manager_config.js` (despite the `.js` extension it is pure JSON).

## Logging
| Situation | Function |
|-----------|----------|
| API not available, fatal error, script start/stop | `ns.tprint(...)` |
| Recurring status output inside the loop | `ns.print(...)` |
| Clear previous loop output before reprinting | `ns.clearLog()` at top of loop body |

- Do **not** mix `ns.tprint` and `ns.print` for the same type of message.
- Do **not** use `console.log`.

## Error Handling — Missing APIs
- Always check API availability at startup, before the main loop.
- On failure: print a clear message with `ns.tprint`, then `return`.

```js
// Correct
if (!ns.singularity) {
  ns.tprint("Error: Singularity API not available. Requires Source-File 4.");
  return;
}
```

## No Commented-Out Code
- Do not leave commented-out code in files (`//ns.disableLog`, `//test`, etc.).
- Dead code must be deleted, not commented out.
- Temporary debug output must be removed before committing.

## Loop Pattern
```js
while (true) {
  // ... work ...
  await ns.sleep(loopMs);
}
```
- Always yield with `await ns.sleep(...)` — never use busy loops.
- Managers that process many items per cycle must also yield with `await ns.sleep(0)` regularly to prevent infinite-loop detection by the game engine.

## Imports
- Always use relative imports: `import { foo } from "./library.js"`.
- Never import from absolute paths.

## NS API Safety
- Always check that a function exists before calling it if it may be absent:
  ```js
  if (typeof ns.singularity.getCurrentWork === "function") { ... }
  ```
- Never assume optional API methods exist without a guard.
