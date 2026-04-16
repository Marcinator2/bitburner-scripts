/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("sleep");
  ns.disableLog("getPlayer");
  ns.disableLog("getAugmentationPrice");

  const augName = "NeuroFlux Governor";
  const reserveMoney = Number(ns.args[1] ?? 0);
  const preferredFaction = ns.args[0] ? String(ns.args[0]) : null;

  if (!ns.singularity) {
    ns.tprint("Singularity API nicht verfügbar. Benötigt Source-File 4.");
    return;
  }

  const player = ns.getPlayer();
  const factions = Array.isArray(player.factions) ? player.factions : [];
  if (factions.length === 0) {
    ns.tprint("Du bist in keiner Fraktion. NeuroFlux kann nur über eine Fraktion gekauft werden.");
    return;
  }

  const candidateFactions = factions.filter(faction => {
    try {
      const augs = ns.singularity.getAugmentationsFromFaction(faction);
      return Array.isArray(augs) && augs.includes(augName);
    } catch {
      return false;
    }
  });

  if (candidateFactions.length === 0) {
    ns.tprint(`Keine Fraktion mit ${augName} gefunden. Bitte tritt einer passenden Fraktion bei.`);
    return;
  }

  let buyFaction = preferredFaction && candidateFactions.includes(preferredFaction)
    ? preferredFaction
    : candidateFactions[0];

  if (preferredFaction && !candidateFactions.includes(preferredFaction)) {
    ns.tprint(`Bevorzugte Fraktion '${preferredFaction}' hat ${augName} nicht oder ist nicht verfügbar. Nutze ${buyFaction} statt dessen.`);
  }

  ns.tprint(`Starte endlosen Kaufloop für ${augName} über Fraktion '${buyFaction}' (Reserve ${ns.formatNumber(reserveMoney)}$).`);

  while (true) {
    try {
      const price = ns.singularity.getAugmentationPrice(augName);
      const repReq = ns.singularity.getAugmentationRepReq(augName);
      const factionRep = ns.singularity.getFactionRep(buyFaction);
      const factionFavor = typeof ns.singularity.getFactionFavor === "function"
        ? ns.singularity.getFactionFavor(buyFaction)
        : 0;
      const canDonate = typeof ns.getFavorToDonate === "function"
        ? factionFavor >= ns.getFavorToDonate()
        : false;
      const money = ns.getPlayer().money;
      const canAfford = money >= price + reserveMoney;

      if (canAfford && factionRep >= repReq) {
        const success = ns.singularity.purchaseAugmentation(buyFaction, augName);
        if (success) {
          ns.tprint(`Kauf erfolgreich: ${augName} von ${buyFaction} für ${ns.formatNumber(price)}$. Kontostand jetzt ${ns.formatNumber(ns.getPlayer().money)}$.`);
          await ns.sleep(1000);
          continue;
        }

        ns.tprint(`Kaufversuch fehlgeschlagen: ${augName} von ${buyFaction}. Prüfe, ob die Voraussetzungen erfüllt sind.`);
      }

      if (!canAfford) {
        ns.tprint(`Nicht genug Geld für ${augName} (Preis ${ns.formatNumber(price)}$, Reserve ${ns.formatNumber(reserveMoney)}$). Kontostand ${ns.formatNumber(money)}$.`);
      }

      if (factionRep < repReq) {
        ns.tprint(`Nicht genug Ruf bei ${buyFaction} für ${augName} (${ns.formatNumber(factionRep)}/${ns.formatNumber(repReq)}).`);
        if (canDonate && money > reserveMoney + 1e6) {
          const donateAmount = Math.max(0, Math.min(money - reserveMoney, price * 2));
          if (donateAmount > 0) {
            const donated = ns.singularity.donateToFaction(buyFaction, donateAmount);
            if (donated) {
              ns.tprint(`Gespendet ${ns.formatNumber(donateAmount)}$ an ${buyFaction} für Rufgewinn. Kontostand ${ns.formatNumber(ns.getPlayer().money)}$.`);
              await ns.sleep(1000);
              continue;
            }
            ns.tprint(`Spende an ${buyFaction} fehlgeschlagen, obwohl Favor vorhanden. Warte kurz...`);
          }
        } else if (!canDonate) {
          ns.tprint(`Du hast noch nicht genug Favor bei ${buyFaction}, um dort zu spenden.`);
        }
      }

      await ns.sleep(5000);
    } catch (error) {
      ns.tprint(`Fehler im Kaufloop: ${String(error)}`);
      await ns.sleep(10000);
    }
  }
}
