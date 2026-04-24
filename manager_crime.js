/** @param {NS} ns */
// manager_crime.js
// Automatically commits the best crime by $/s based on current player stats.
// Rechecks every CHECK_INTERVAL_MS and switches crime if a better one is found.

const CRIME_TYPES = [
  "Shoplift",
  "Rob Store",
  "Mug",
  "Larceny",
  "Deal Drugs",
  "Bond Forgery",
  "Traffick Arms",
  "Homicide",
  "Grand Theft Auto",
  "Kidnap",
  "Assassination",
  "Heist",
];

export async function main(ns) {
  if (!ns.singularity) {
    ns.tprint("[Crime] Error: Singularity API not available (requires SF4).");
    return;
  }

  ns.disableLog("ALL");

  const DEFAULT_LOOP_MS = 10000;
  const FOCUS = false;
  let loopMs = DEFAULT_LOOP_MS;
  try {
    const cfgRaw = ns.read("main_manager_config.js");
    if (cfgRaw) loopMs = Number(JSON.parse(cfgRaw)?.services?.crime?.loopMs) || DEFAULT_LOOP_MS;
  } catch { /* use fallback */ }

  while (true) {
    ns.clearLog();

    const best = getBestMoneyCrime(ns);

    if (!best) {
      ns.print("[Crime] No suitable crime found.");
      await ns.sleep(loopMs);
      continue;
    }

    const currentWork = ns.singularity.getCurrentWork?.() ?? null;
    const alreadyDoing = isCrimeWork(currentWork, best.type);

    if (!alreadyDoing) {
      ns.singularity.commitCrime(best.type, FOCUS);
    }

    ns.print("MONEY GRINDER");
    ns.print("");
    ns.print(`Crime:    ${best.type}`);
    ns.print(`$/s:      ${ns.formatNumber(best.moneyPerSec)}$`);
    ns.print(`Chance:   ${(best.chance * 100).toFixed(1)}%`);
    ns.print(`Eff $/s:  ${ns.formatNumber(best.effectiveMoneyPerSec)}$ (chance-weighted)`);
    ns.print(`Time:     ${best.timeMs}ms`);
    ns.print("");
    ns.print("Top 5:");
    for (const c of best.top5) {
      ns.print(`  ${c.type.padEnd(22)} ${ns.formatNumber(c.effectiveMoneyPerSec).padStart(8)}$/s  ${(c.chance * 100).toFixed(0).padStart(3)}%`);
    }

    await ns.sleep(loopMs);
  }
}

function getBestMoneyCrime(ns) {
  const ranked = CRIME_TYPES
    .map(type => {
      const stats  = ns.singularity.getCrimeStats(type);
      const timeMs = Number(stats?.time ?? 0);
      const money  = Number(stats?.money ?? 0);
      const chance = Number(ns.singularity.getCrimeChance(type) ?? 0);

      if (timeMs <= 0 || money <= 0) return null;

      const moneyPerSec          = money / (timeMs / 1000);
      const effectiveMoneyPerSec = moneyPerSec * chance;

      return { type, timeMs, money, chance, moneyPerSec, effectiveMoneyPerSec };
    })
    .filter(Boolean)
    .sort((a, b) => b.effectiveMoneyPerSec - a.effectiveMoneyPerSec);

  if (ranked.length === 0) return null;

  return { ...ranked[0], top5: ranked.slice(0, 5) };
}

function isCrimeWork(work, crimeType) {
  if (!work || typeof work !== "object") return false;
  if (String(work.type ?? "").toLowerCase() !== "crime") return false;
  return !crimeType || String(work.crimeType ?? "") === crimeType;
}
