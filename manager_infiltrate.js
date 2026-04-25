/** @param {NS} ns */
// manager_infiltrate.js
// Finds the best infiltration targets matching a desired difficulty level.
// Args: [difficulty] — a number (e.g. 1.5) or "easy" / "medium" / "hard"
// With Singularity (SF4), automatically navigates to the best match.

export async function main(ns) {
  ns.disableLog("ALL");

  if (!ns.infiltration) {
    ns.tprint("Error: Infiltration API not available.");
    return;
  }

  const DIFFICULTY_NAMES = { easy: 1.0, medium: 2.0, hard: 3.0 };
  const DEFAULT_DIFF = 1.5;
  const TOP_N = 5;

  const rawArg = ns.args[0];
  let targetDiff;
  if (typeof rawArg === "string") {
    targetDiff = DIFFICULTY_NAMES[rawArg.toLowerCase()] ?? parseFloat(rawArg);
  } else if (typeof rawArg === "number") {
    targetDiff = rawArg;
  } else {
    targetDiff = DEFAULT_DIFF;
  }

  if (isNaN(targetDiff)) {
    ns.tprint(`Error: Invalid difficulty "${rawArg}". Use a number (e.g. 1.5) or easy / medium / hard.`);
    return;
  }

  let locations;
  try {
    locations = ns.infiltration.getInfiltrations();
  } catch (e) {
    ns.tprint(`Error: Could not read infiltration data: ${e}`);
    return;
  }

  if (!locations || locations.length === 0) {
    ns.tprint("Error: No infiltration locations found.");
    return;
  }

  const sorted = [...locations].sort(
    (a, b) => Math.abs(a.difficulty - targetDiff) - Math.abs(b.difficulty - targetDiff)
  );

  const COL_NAME = 30;
  const COL_CITY = 14;
  const SEP = "─".repeat(COL_NAME + COL_CITY + 28);

  ns.tprint(`[Infiltration] Target difficulty: ${targetDiff.toFixed(2)}`);
  ns.tprint(SEP);
  ns.tprint(
    "Location".padEnd(COL_NAME) +
    "City".padEnd(COL_CITY) +
    "Diff  " +
    "Cash".padEnd(12) +
    "Rep"
  );
  ns.tprint(SEP);

  for (const loc of sorted.slice(0, TOP_N)) {
    const name = loc.location.name.substring(0, COL_NAME - 2).padEnd(COL_NAME);
    const city = String(loc.location.city).padEnd(COL_CITY);
    const diff = loc.difficulty.toFixed(2).padEnd(6);
    const cash = ("$" + ns.formatNumber(loc.reward.sellCash)).padEnd(12);
    const rep  = ns.formatNumber(loc.reward.tradeRep);
    ns.tprint(`${name}${city}${diff}${cash}${rep}`);
  }

  ns.tprint(SEP);

  const best = sorted[0];
  ns.tprint(
    `[Infiltration] Best match: ${best.location.name}` +
    ` (${best.location.city}) — difficulty ${best.difficulty.toFixed(2)}`
  );

  if (ns.singularity) {
    try {
      const moved = ns.singularity.goToLocation(best.location.name);
      if (moved) {
        ns.tprint(`[Infiltration] Navigated to ${best.location.name}.`);
      } else {
        ns.tprint(`[Infiltration] Could not navigate — travel to ${best.location.city} first.`);
      }
    } catch (_) {}
  }
}
