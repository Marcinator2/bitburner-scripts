// STATUS: Experimental scratch script for manual buy/display checks.
// Do not include in production flows unless the logic is intentionally ported over.
/** @param {NS} ns */
export async function main(ns) {
  const ram = 2**16;
  const targetServerName = "the-hub";
  
  // 1. Calculate cost
  const cost = ns.getPurchasedServerCost(ram);

  // 2. Format values
  // ns.formatRam turns 1048576 GB -> "1.00 PB" (Petabyte)
  const ramFormatted = ns.formatRam(ram);
  
  // ns.formatNumber turns 1000000 -> "1.000m"
  const costFormatted = "$" + ns.formatNumber(cost);

  // 3. Output
  
  await ns.prompt(`Server Purchase Check:
A new server costs:
--------------------------
RAM:    ${ramFormatted}
Cost:   ${costFormatted}
--------------------------

Target has the following values:
Target:   ${targetServerName}
Max Money: $${ns.formatNumber(ns.getServerMaxMoney(targetServerName))}
Current:   $${ns.formatNumber(ns.getServerMoneyAvailable(targetServerName))}`);

  ns.tprint(`Report for ${ramFormatted} created.`);
}