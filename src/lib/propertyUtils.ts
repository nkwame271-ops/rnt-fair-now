/**
 * Normalize an address string for duplicate matching.
 * Lowercases, trims, removes special characters, collapses whitespace.
 */
export function normalizeAddress(address: string): string {
  return address
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Determine the pricing band for a given asking rent vs benchmark.
 */
export function getPricingBand(
  askingRent: number,
  benchmarkMax: number
): { band: string; label: string } {
  if (benchmarkMax <= 0) return { band: "unknown", label: "" };

  const softCap = Math.round(benchmarkMax * 1.25);
  const hardCap = Math.round(benchmarkMax * 1.5);

  if (askingRent <= benchmarkMax) {
    return { band: "within", label: "Within Benchmark" };
  } else if (askingRent <= softCap) {
    return { band: "above", label: "Above Benchmark" };
  } else if (askingRent <= hardCap) {
    return { band: "pending_justification", label: "Pending Justification" };
  } else {
    return { band: "rejected", label: "Rejected — Excessive Pricing" };
  }
}
