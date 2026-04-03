/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("sleep");
  ns.clearLog();

  // Konfiguration
  const reserveCash = 0//500_000_000; // festen Betrag in $ behalten (anstatt Prozent)
  const minAffordableMargin = 0; // minimale Reserve in $, zusätzlich zur reserveCash
  const maxShownOptions = 0//8; // wie viele Optionen in der Übersicht gezeigt werden
  const loopDelayMs = 30; // Pause zwischen Durchläufen (30 Sekunden)

  // Prüfe ob hacknet-API vorhanden (frühzeitig)
  if (!ns.hacknet || typeof ns.hacknet.numNodes !== "function") {
   // ns.tprint("❌ ns.hacknet API nicht verfügbar. Script beendet.");
    return;
  }

  while (true) {
    // Hole verfügbares Geld (bevorzugt ns.getPlayer())
    let playerMoney = 0;
    try {
      if (typeof ns.getPlayer === "function") {
        const p = ns.getPlayer();
        if (p && typeof p.money === "number") playerMoney = p.money;
      }
    } catch (e) {
      // ignore
    }
    if (!playerMoney || typeof playerMoney !== "number") {
      try {
        playerMoney = ns.getServerMoneyAvailable("home");
      } catch (e) {
        playerMoney = 0;
      }
    }
    const availableCash = Math.max(0, playerMoney - reserveCash - minAffordableMargin);
   // ns.tprint(`ℹ️ Verfügbares Geld (nach Reserve ${reserveCash.toLocaleString()}): ${Math.floor(availableCash).toLocaleString()}`);

    // Lese Nodes
    const numNodes = ns.hacknet.numNodes();
    let nodes = [];
    for (let i = 0; i < numNodes; i++) {
      try {
        nodes.push(ns.hacknet.getNodeStats(i));
      } catch (e) {
       // ns.tprint("❌ ns.hacknet.getNodeStats nicht verfügbar oder Fehler beim Lesen von Node " + i);
        return;
      }
    }

    // Durchschnittsproduktion pro Node (für neue Nodes-Schätzung)
    const avgProd = nodes.length ? (nodes.reduce((s, n) => s + (n.production || 0), 0) / nodes.length) : 0.1;

    // Sammle mögliche Aktionen mit geschätztem deltaProd und Kosten
    let actions = [];

    // Upgrade-Optionen für existierende Nodes
    for (let i = 0; i < numNodes; i++) {
      const s = nodes[i];
      const curProd = s.production ?? 0.000001;
      const level = s.level ?? 1;
      const ram = s.ram ?? 1;
      const cores = s.cores ?? 1;
      const cache = s.cache ?? 0;

      // Level +1
      if (typeof ns.hacknet.getLevelUpgradeCost === "function") {
        const cost = ns.hacknet.getLevelUpgradeCost(i, 1);
        if (isFinite(cost) && cost > 0) {
          const newLevel = level + 1;
          const estNewProd = curProd * (newLevel / Math.max(1, level));
          const delta = Math.max(0, estNewProd - curProd);
          actions.push({ type: "level", index: i, cost, delta, desc: `Node ${i} level+1` });
        }
      }

      // RAM Upgrade +1
      if (typeof ns.hacknet.getRamUpgradeCost === "function") {
        const cost = ns.hacknet.getRamUpgradeCost(i, 1);
        if (isFinite(cost) && cost > 0) {
          const newRam = ram * 2;
          const estNewProd = curProd * (newRam / Math.max(1, ram));
          const delta = Math.max(0, estNewProd - curProd);
          actions.push({ type: "ram", index: i, cost, delta, desc: `Node ${i} ram*2 (geschätzt)` });
        }
      }

      // Cores +1
      if (typeof ns.hacknet.getCoreUpgradeCost === "function") {
        const cost = ns.hacknet.getCoreUpgradeCost(i, 1);
        if (isFinite(cost) && cost > 0) {
          const newCores = cores + 1;
          const estNewProd = curProd * (newCores / Math.max(1, cores));
          const delta = Math.max(0, estNewProd - curProd);
          actions.push({ type: "cores", index: i, cost, delta, desc: `Node ${i} cores+1` });
        }
      }

      // Cache +1 (konservativ +10%)
      if (typeof ns.hacknet.getCacheUpgradeCost === "function") {
        const cost = ns.hacknet.getCacheUpgradeCost(i, 1);
        if (isFinite(cost) && cost > 0) {
          const estNewProd = curProd * 1.10;
          const delta = Math.max(0, estNewProd - curProd);
          actions.push({ type: "cache", index: i, cost, delta, desc: `Node ${i} cache+1 (geschätzt +10%)` });
        }
      }
    }

    // Kauf eines neuen Node
    if (typeof ns.hacknet.getPurchaseNodeCost === "function" && typeof ns.hacknet.purchaseNode === "function") {
      const cost = ns.hacknet.getPurchaseNodeCost();
      if (isFinite(cost) && cost > 0) {
        const estNewProd = Math.max(0.1, avgProd);
        const delta = estNewProd;
        actions.push({ type: "purchase", cost, delta, desc: `Kaufe neuen Node (geschätzte prod ${estNewProd.toFixed(6)}/s)` });
      }
    }

    if (actions.length === 0) {
    //  ns.tprint("ℹ️ Keine Hacknet-Aktionen gefunden (API-Funktionen fehlen oder keine Nodes/Optionen).");
      return;
    }

    // ROI berechnen und sortieren (deltaProd / cost), höhere ROI zuerst
    actions = actions
      .map(a => ({ ...a, roi: a.cost > 0 ? (a.delta / a.cost) : 0 }))
      .sort((a, b) => b.roi - a.roi);

    // Ausgabe der Top-Optionen
   // ns.tprint("🔎 Top Hacknet-Optionen (geschätztes Δprod / $):");
    for (let i = 0; i < Math.min(maxShownOptions, actions.length); i++) {
      const a = actions[i];
     // ns.tprint(`${i + 1}. ${a.desc} — cost: ${Math.floor(a.cost).toLocaleString()} | est Δprod: ${a.delta.toFixed(6)} | ROI: ${a.roi.toExponential(6)}`);
    }

    const best = actions[0];
   // ns.tprint(`➡️ Beste Aktion: ${best.desc} | cost ${Math.floor(best.cost).toLocaleString()} | est Δprod ${best.delta.toFixed(6)} | ROI ${best.roi.toExponential(6)}`);

    if (best.cost > availableCash) {
    //  ns.tprint(`❌ Nicht genug Geld für die beste Aktion. Benötigt ${Math.floor(best.cost).toLocaleString()}, verfügbar ${Math.floor(availableCash).toLocaleString()}.`);
      // Warte und wiederhole später
      await ns.sleep(loopDelayMs);
      continue;
    }

    // Aktion ausführen (mit Prüfung, ob jeweilige Funktion existiert)
    let success = false;
    try {
      switch (best.type) {
        case "purchase":
          if (typeof ns.hacknet.purchaseNode === "function") {
            success = ns.hacknet.purchaseNode();
            ns.tprint(success ? `✅ Neuer Node gekauft.` : `❌ Kauf fehlgeschlagen.`);
          } else ns.tprint("❌ purchaseNode nicht verfügbar.");
          break;
        case "level":
          if (typeof ns.hacknet.upgradeLevel === "function") {
            success = ns.hacknet.upgradeLevel(best.index, 1);
            ns.tprint(success ? `✅ Node ${best.index} Level+1` : `❌ Level-Upgrade fehlgeschlagen (Node ${best.index}).`);
          } else ns.tprint("❌ upgradeLevel nicht verfügbar.");
          break;
        case "ram":
          if (typeof ns.hacknet.upgradeRam === "function") {
            success = ns.hacknet.upgradeRam(best.index, 1);
            ns.tprint(success ? `✅ Node ${best.index} RAM upgrade` : `❌ RAM-Upgrade fehlgeschlagen (Node ${best.index}).`);
          } else ns.tprint("❌ upgradeRam nicht verfügbar.");
          break;
        case "cores":
          if (typeof ns.hacknet.upgradeCore === "function") {
            success = ns.hacknet.upgradeCore(best.index, 1);
            ns.tprint(success ? `✅ Node ${best.index} Cores+1` : `❌ Core-Upgrade fehlgeschlagen (Node ${best.index}).`);
          } else ns.tprint("❌ upgradeCore nicht verfügbar.");
          break;
        case "cache":
          if (typeof ns.hacknet.upgradeCache === "function") {
            success = ns.hacknet.upgradeCache(best.index, 1);
            ns.tprint(success ? `✅ Node ${best.index} Cache+1` : `❌ Cache-Upgrade fehlgeschlagen (Node ${best.index}).`);
          } else ns.tprint("❌ upgradeCache nicht verfügbar.");
          break;
        default:
          ns.tprint("❌ Unbekannte Aktion: " + best.type);
      }
    } catch (e) {
      ns.tprint("❌ Fehler beim Ausführen der Aktion: " + String(e));
      success = false;
    }

    if (success) ns.tprint("ℹ️ Aktion erfolgreich ausgeführt.");
   // else ns.tprint("ℹ️ Aktion konnte nicht ausgeführt werden (vermutlich Race-Condition oder fehlende Mittel).");

    // Warte vor dem nächsten Durchlaufkk
    await ns.sleep(loopDelayMs);
  }
}