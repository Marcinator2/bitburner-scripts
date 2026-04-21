/** @param {NS} ns */

const CONFIG_FILE = "main_manager_config.js";
const NEUROFLUX = "NeuroFlux Governor";

// Stat-Felder pro Kategorie (aus ns.singularity.getAugmentationStats)
const HACKING_FIELDS = new Set([
  "hacking", "hacking_speed", "hacking_money", "hacking_grow",
  "hacking_chance", "hacking_exp",
]);
const COMBAT_FIELDS = new Set([
  "strength", "strength_exp", "defense", "defense_exp",
  "dexterity", "dexterity_exp", "agility", "agility_exp",
  "crime_money", "crime_success",
]);
const CHARISMA_FIELDS = new Set([
  "charisma", "charisma_exp", "faction_rep", "company_rep", "work_money",
]);

function classifyAugment(stats) {
  const cats = new Set();
  for (const key of Object.keys(stats)) {
    if (HACKING_FIELDS.has(key))          cats.add("hacking");
    else if (COMBAT_FIELDS.has(key))      cats.add("combat");
    else if (CHARISMA_FIELDS.has(key))    cats.add("charisma");
    else if (key.startsWith("hacknet_"))  cats.add("hacknet");
    else if (key.startsWith("bladeburner_")) cats.add("bladeburner");
  }
  return cats;
}

function loadConfig(ns, configFile) {
  try {
    const raw = ns.read(configFile);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function getAugConfig(config) {
  const s = config.services?.augments || {};
  return {
    categories: {
      hacking:     s.categories?.hacking     ?? true,
      combat:      s.categories?.combat      ?? true,
      hacknet:     s.categories?.hacknet     ?? false,
      bladeburner: s.categories?.bladeburner ?? false,
      charisma:    s.categories?.charisma    ?? false,
    },
    minMoneyBuffer: typeof s.minMoneyBuffer === "number" ? s.minMoneyBuffer : 0,
    repFarming: s.repFarming ?? false,
  };
}

export async function main(ns) {
  ns.disableLog("ALL");

  if (!ns.singularity || typeof ns.singularity.getAugmentationsFromFaction !== "function") {
    ns.tprint("ERROR: Singularity API not available.");
    return;
  }

  const configFile = String(ns.args[0] || CONFIG_FILE);

  while (true) {
    const config = loadConfig(ns, configFile);
    const augConfig = getAugConfig(config);
    const loopMs = config.loopMs ?? 10000;

    // Already owned + queued augments
    const owned = new Set(ns.singularity.getOwnedAugmentations(true));

    // Per augment: find faction with highest rep
    const augFactionMap = new Map(); // augName → { faction, rep }
    for (const faction of ns.getPlayer().factions) {
      let factionRep;
      try {
        factionRep = ns.singularity.getFactionRep(faction);
      } catch {
        continue;
      }

      for (const aug of ns.singularity.getAugmentationsFromFaction(faction)) {
        if (aug === NEUROFLUX) continue;
        if (owned.has(aug)) continue;

        const existing = augFactionMap.get(aug);
        if (!existing || factionRep > existing.rep) {
          augFactionMap.set(aug, { faction, rep: factionRep });
        }
      }
    }

    // Classify and filter candidates
    const candidates = [];
    for (const [aug, { faction, rep }] of augFactionMap) {
      const stats = ns.singularity.getAugmentationStats(aug);
      const cats = classifyAugment(stats);

      // Uncategorized → always buy (e.g. pure Intelligence augments)
      const isWanted = cats.size === 0 || [...cats].some(c => augConfig.categories[c]);
      if (!isWanted) continue;

      const repReq = ns.singularity.getAugmentationRepReq(aug);
      const price  = ns.singularity.getAugmentationPrice(aug);
      const prereqs = ns.singularity.getAugmentationPrereq(aug);

      candidates.push({ name: aug, faction, rep, repReq, price, prereqs, cats });
    }

    // Buy most expensive first (reduces total cost due to 1.9× price escalation)
    candidates.sort((a, b) => b.price - a.price);

    const bought   = [];
    const pending  = [];

    for (const aug of candidates) {
      // Check prerequisites
      const missingPrereq = aug.prereqs.find(p => !owned.has(p));
      if (missingPrereq) {
        pending.push({ ...aug, reason: `prereq:${missingPrereq}` });
        continue;
      }

      // Query current price (rises by factor 1.9 after each purchase)
      const currentPrice = ns.singularity.getAugmentationPrice(aug.name);
      const currentRep   = ns.singularity.getFactionRep(aug.faction);
      const money        = ns.getPlayer().money;

      if (currentRep < aug.repReq) {
        pending.push({ ...aug, price: currentPrice, reason: "rep" });
        continue;
      }

      if (money < currentPrice + augConfig.minMoneyBuffer) {
        pending.push({ ...aug, price: currentPrice, reason: "money" });
        continue;
      }

      if (ns.singularity.purchaseAugmentation(aug.faction, aug.name)) {
        owned.add(aug.name); // for subsequent prereq checks
        bought.push(aug.name);
        ns.print(`BUY: ${aug.name} (${aug.faction}) – ${ns.formatNumber(currentPrice)}$`);
      } else {
        pending.push({ ...aug, price: currentPrice, reason: "failed" });
      }
    }

    // Output status
    ns.clearLog();
    if (bought.length > 0) {
      ns.print(`[BUY x${bought.length}] ${bought.join(", ")}`);
    }

    const repPending    = pending.filter(p => p.reason === "rep");
    const moneyPending  = pending.filter(p => p.reason === "money");
    const prereqPending = pending.filter(p => p.reason.startsWith("prereq"));

    ns.print(
      `[STATUS] Owned: ${owned.size} | Pending: ${pending.length}` +
      ` (Rep: ${repPending.length}, Money: ${moneyPending.length}, Prereq: ${prereqPending.length})`
    );

    if (moneyPending.length > 0) {
      // Cheapest pending = last in descending sorted list
      const next = moneyPending[moneyPending.length - 1];
      ns.print(`[NEXT] ${next.name} – ${ns.formatNumber(next.price)}$ (${next.faction})`);
    }

    if (repPending.length > 0) {
      const nearest = [...repPending].sort((a, b) => a.repReq - b.repReq)[0];
      const missing = Math.max(0, nearest.repReq - nearest.rep);
      ns.print(`[REP] ${nearest.name} – still ${ns.formatNumber(missing)} Rep needed (${nearest.faction})`);
    }

  // Rep-Farming
  manageRepFarming(ns, augConfig, repPending, candidates);

    await ns.sleep(loopMs);
  }
}

/**
 * Selects the faction with the most pending (rep-blocked) augments
 * and starts faction work for it. Stops when all augments of that
 * faction are purchasable.
 */
function manageRepFarming(ns, augConfig, repPending, allCandidates) {
  if (!augConfig.repFarming) {
    // Farming disabled – do nothing
    return;
  }

  if (repPending.length === 0) {
    // No more rep needed – stop running faction work if active
    try {
      const work = ns.singularity.getCurrentWork();
      if (work && work.type === "FACTION") {
        ns.singularity.stopAction();
        ns.print("[REP-FARM] All augments purchasable – work stopped.");
      }
    } catch (_) {}
    return;
  }

  // Select faction with the most rep-blocked augments
  // Exclude gang faction (no work possible while in a gang)
  let gangFaction = null;
  try {
    if (ns.gang) gangFaction = ns.gang.getGangInformation().faction;
  } catch (_) {}

  const validPending = gangFaction
    ? repPending.filter(aug => aug.faction !== gangFaction)
    : repPending;

  if (validPending.length === 0) {
    ns.print(`[REP-FARM] All rep-blocked augments belong to the gang faction (${gangFaction}) – skipped.`);
    return;
  }

  const factionCount = new Map();
  for (const aug of validPending) {
    factionCount.set(aug.faction, (factionCount.get(aug.faction) ?? 0) + 1);
  }
  const targetFaction = [...factionCount.entries()]
    .sort((a, b) => b[1] - a[1])[0][0];

  // Check if already working for this faction
  try {
    const work = ns.singularity.getCurrentWork();
    if (work && work.type === "FACTION" && work.factionName === targetFaction) {
      ns.print(`[REP-FARM] Working for ${targetFaction} (${factionCount.get(targetFaction)} augments)`);
      return;
    }
  } catch (_) {}

  // Determine best available work type (Hacking > Field > Security)
  const started =
    tryFactionWork(ns, targetFaction, "hacking") ||
    tryFactionWork(ns, targetFaction, "field") ||
    tryFactionWork(ns, targetFaction, "security");

  if (started) {
    ns.print(`[REP-FARM] Started: ${targetFaction} (${factionCount.get(targetFaction)} augments open)`);
  } else {
    ns.print(`[REP-FARM] Could not start work for ${targetFaction}.`);
  }
}

function tryFactionWork(ns, faction, type) {
  try {
    return ns.singularity.workForFaction(faction, type, false);
  } catch (_) {
    return false;
  }
}
