/** @param {NS} ns */
export async function main(ns) {
  const ziel = ns.args[0];
  // Das zweite Argument 'true' aktiviert den Einfluss auf den Aktienmarkt
  await ns.grow(ziel, { stock: true });
}