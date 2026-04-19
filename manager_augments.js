/** @param {NS} ns */

const CONFIG_FILE = "main_manager_config.txt";
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
  };
}

export async function main(ns) {
  ns.disableLog("ALL");

  if (!ns.singularity || typeof ns.singularity.getAugmentationsFromFaction !== "function") {
    ns.tprint("FEHLER: Singularity API nicht verfügbar.");
    return;
  }

  const configFile = String(ns.args[0] || CONFIG_FILE);

  while (true) {
    const config = loadConfig(ns, configFile);
    const augConfig = getAugConfig(config);
    const loopMs = config.loopMs ?? 10000;

    // Bereits besessene + in Warteschlange stehende Augments
    const owned = new Set(ns.singularity.getOwnedAugmentations(true));

    // Pro Augment: Faction mit höchstem Rep ermitteln
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

    // Kandidaten klassifizieren und filtern
    const candidates = [];
    for (const [aug, { faction, rep }] of augFactionMap) {
      const stats = ns.singularity.getAugmentationStats(aug);
      const cats = classifyAugment(stats);

      // Unkategorisiert → immer kaufen (z.B. reine Intelligence-Augments)
      const isWanted = cats.size === 0 || [...cats].some(c => augConfig.categories[c]);
      if (!isWanted) continue;

      const repReq = ns.singularity.getAugmentationRepReq(aug);
      const price  = ns.singularity.getAugmentationPrice(aug);
      const prereqs = ns.singularity.getAugmentationPrereq(aug);

      candidates.push({ name: aug, faction, rep, repReq, price, prereqs, cats });
    }

    // Teuerste zuerst kaufen (senkt Gesamtkosten wegen 1.9× Preiseskalation)
    candidates.sort((a, b) => b.price - a.price);

    const bought   = [];
    const pending  = [];

    for (const aug of candidates) {
      // Voraussetzungen prüfen
      const missingPrereq = aug.prereqs.find(p => !owned.has(p));
      if (missingPrereq) {
        pending.push({ ...aug, reason: `prereq:${missingPrereq}` });
        continue;
      }

      // Aktuellen Preis abfragen (steigt nach jedem Kauf um Faktor 1.9)
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
        owned.add(aug.name); // für nachfolgende Prereq-Checks
        bought.push(aug.name);
        ns.print(`KAUF: ${aug.name} (${aug.faction}) – ${ns.formatNumber(currentPrice)}$`);
      } else {
        pending.push({ ...aug, price: currentPrice, reason: "failed" });
      }
    }

    // Status ausgeben
    ns.clearLog();
    if (bought.length > 0) {
      ns.print(`[KAUF x${bought.length}] ${bought.join(", ")}`);
    }

    const repPending    = pending.filter(p => p.reason === "rep");
    const moneyPending  = pending.filter(p => p.reason === "money");
    const prereqPending = pending.filter(p => p.reason.startsWith("prereq"));

    ns.print(
      `[STATUS] Owned: ${owned.size} | Offen: ${pending.length}` +
      ` (Rep: ${repPending.length}, Geld: ${moneyPending.length}, Prereq: ${prereqPending.length})`
    );

    if (moneyPending.length > 0) {
      // Günstigstes Ausstehende = letzte in absteigend-sortierter Liste
      const next = moneyPending[moneyPending.length - 1];
      ns.print(`[NÄCHST] ${next.name} – ${ns.formatNumber(next.price)}$ (${next.faction})`);
    }

    if (repPending.length > 0) {
      const nearest = [...repPending].sort((a, b) => a.repReq - b.repReq)[0];
      const missing = Math.max(0, nearest.repReq - nearest.rep);
      ns.print(`[REP] ${nearest.name} – noch ${ns.formatNumber(missing)} Rep (${nearest.faction})`);
    }

    await ns.sleep(loopMs);
  }
}
