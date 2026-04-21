/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("sleep");

  const augName = "NeuroFlux Governor";
  const reserveMoney = Number(ns.args[1] ?? 0);
  const preferredFaction = ns.args[0] ? String(ns.args[0]) : null;

  if (!ns.singularity) {
    ns.tprint("Singularity API not available. Requires Source-File 4.");
    return;
  }

  const player = ns.getPlayer();
  const factions = Array.isArray(player.factions) ? player.factions : [];
  if (factions.length === 0) {
    ns.tprint("You are not in any faction. NeuroFlux can only be purchased through a faction.");
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
    ns.tprint(`No faction found with ${augName}. Please join a suitable faction.`);
    return;
  }

  let buyFaction = preferredFaction && candidateFactions.includes(preferredFaction)
    ? preferredFaction
    : candidateFactions[0];

  if (preferredFaction && !candidateFactions.includes(preferredFaction)) {
    ns.tprint(`Preferred faction '${preferredFaction}' does not have ${augName} or is not available. Using ${buyFaction} instead.`);
  }

  ns.tprint(`Starting endless buy loop for ${augName} via faction '${buyFaction}' (reserve ${ns.formatNumber(reserveMoney)}$).`);

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
          ns.tprint(`Purchase successful: ${augName} from ${buyFaction} for ${ns.formatNumber(price)}$. Balance now ${ns.formatNumber(ns.getPlayer().money)}$.`);
          await ns.sleep(1000);
          continue;
        }

        ns.tprint(`Purchase attempt failed: ${augName} from ${buyFaction}. Check whether prerequisites are met.`);
      }

      if (!canAfford) {
        ns.tprint(`Not enough money for ${augName} (price ${ns.formatNumber(price)}$, reserve ${ns.formatNumber(reserveMoney)}$). Balance ${ns.formatNumber(money)}$.`);
      }

      if (factionRep < repReq) {
        ns.tprint(`Not enough reputation at ${buyFaction} for ${augName} (${ns.formatNumber(factionRep)}/${ns.formatNumber(repReq)}).`);
        if (canDonate && money > reserveMoney + 1e6) {
          const donateAmount = Math.max(0, Math.min(money - reserveMoney, price * 2));
          if (donateAmount > 0) {
            const donated = ns.singularity.donateToFaction(buyFaction, donateAmount);
            if (donated) {
              ns.tprint(`Donated ${ns.formatNumber(donateAmount)}$ to ${buyFaction} for reputation gain. Balance ${ns.formatNumber(ns.getPlayer().money)}$.`);
              await ns.sleep(1000);
              continue;
            }
            ns.tprint(`Donation to ${buyFaction} failed despite sufficient favor. Waiting briefly...`);
          }
        } else if (!canDonate) {
          ns.tprint(`You do not yet have enough favor at ${buyFaction} to donate there.`);
        }
      }

      await ns.sleep(5000);
    } catch (error) {
      ns.tprint(`Error in buy loop: ${String(error)}`);
      await ns.sleep(10000);
    }
  }
}
