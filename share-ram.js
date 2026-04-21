/** @param {NS} ns */
export async function main(ns) {
  // The script runs in an endless loop
  while (true) {
    // ns.share() automatically uses the available RAM of the server
    await ns.share();
  }
}