// STATUS: Experimental scratch script for manual buy/display checks.
// Do not include in production flows unless the logic is intentionally ported over.
/** @param {NS} ns */
export async function main(ns) {
  const ram = 2**16;
  const targetServerName = "the-hub";
  
  // 1. Calculate cost
  const cost = ns.cloud.getServerCost(ram);

  // 2. Format values
  // ns.format.ram turns 1048576 GB -> "1.00 PB" (Petabyte)
  const ramFormatted = ns.format.ram(ram);
  
  // ns.format.number turns 1000000 -> "1.000m"
  const costFormatted = "$" + ns.format.number(cost);

  // 3. Output
  
  await ns.prompt(`Server Purchase Check:
A new server costs:
--------------------------
RAM:    ${ramFormatted}
Cost:   ${costFormatted}
--------------------------

Target has the following values:
Target:   ${targetServerName}
Max Money: $${ns.format.number(ns.getServerMaxMoney(targetServerName))}
Current:   $${ns.format.number(ns.getServerMoneyAvailable(targetServerName))}`);

  ns.tprint(`Report for ${ramFormatted} created.`);
}