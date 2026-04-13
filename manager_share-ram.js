/** @param {NS} ns */
//needs Source-File 4 to run
export async function main(ns) {
    const hostname = ns.getHostname();
    const worker = "share-ram.js";
    const shareQuota = 0.1;
    let ram_available = ns.getServerMaxRam(hostname) - ns.getServerUsedRam(hostname);
    const ram_needed = ns.getScriptRam(worker, hostname);
    const reservedForShare = ns.getServerMaxRam(hostname) * shareQuota;
    let threads = Math.max(1, Math.floor(Math.min(ram_available, reservedForShare) / ram_needed));

    if (ns.scriptRunning(worker, hostname)) {
        return;
    }

    if (threads > 0) {

        ns.exec(worker, hostname, threads);
        
    }
}
