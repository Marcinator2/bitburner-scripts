/** @param {NS} ns */
export async function main(ns) {
  // Das Skript läuft in einer Endlosschleife
  while (true) {
    // ns.share() nutzt automatisch den verfügbaren RAM des Servers
    await ns.share();
  }
}