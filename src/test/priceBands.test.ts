import { describe, it, expect } from "vitest";
import { getPricingBand } from "@/lib/propertyUtils";

describe("getPricingBand", () => {
  const benchmarkMax = 1000;

  it("returns 'within' when rent <= benchmark max", () => {
    expect(getPricingBand(800, benchmarkMax).band).toBe("within");
    expect(getPricingBand(1000, benchmarkMax).band).toBe("within");
  });

  it("returns 'above' when rent > max but <= soft cap (1.25x)", () => {
    expect(getPricingBand(1001, benchmarkMax).band).toBe("above");
    expect(getPricingBand(1250, benchmarkMax).band).toBe("above");
  });

  it("returns 'pending_justification' when rent > soft cap but <= hard cap (1.50x)", () => {
    expect(getPricingBand(1251, benchmarkMax).band).toBe("pending_justification");
    expect(getPricingBand(1500, benchmarkMax).band).toBe("pending_justification");
  });

  it("returns 'rejected' when rent > hard cap", () => {
    expect(getPricingBand(1501, benchmarkMax).band).toBe("rejected");
    expect(getPricingBand(5000, benchmarkMax).band).toBe("rejected");
  });

  it("returns 'unknown' when benchmarkMax is 0", () => {
    expect(getPricingBand(500, 0).band).toBe("unknown");
  });

  it("returns correct labels", () => {
    expect(getPricingBand(800, benchmarkMax).label).toBe("Within Benchmark");
    expect(getPricingBand(1100, benchmarkMax).label).toBe("Above Benchmark");
    expect(getPricingBand(1400, benchmarkMax).label).toBe("Pending Justification");
    expect(getPricingBand(2000, benchmarkMax).label).toBe("Rejected — Excessive Pricing");
  });
});
