/** @param {NS} ns */
export async function main(ns) {
  const targets = ns.infiltration.getPossibleLocations()
    .map(target => ({
      city: target.city,
      name: target.name,
      info: ns.infiltration.getInfiltration(target.name),
    }))
    .sort((a, b) => b.info.difficulty - a.info.difficulty);

  for (const target of targets) {
    ns.tprint(`${target.city} - ${target.name}: Reward: ${target.info.reward.tradeRep} | Difficulty: ${target.info.difficulty}`);
  }
}