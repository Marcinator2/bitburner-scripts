/** @param {NS} ns */
export async function main(ns) {
  const ziel = ns.args[0];
  await ns.hack(ziel, { stock: true });
}