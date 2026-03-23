import { describe, it, expect } from "vitest";
import { normalizeAddress } from "@/lib/propertyUtils";

describe("normalizeAddress", () => {
  it("lowercases and trims", () => {
    expect(normalizeAddress("  East Legon  ")).toBe("east legon");
  });

  it("removes special characters", () => {
    expect(normalizeAddress("Plot #12, Osu-Badu Rd.")).toBe("plot 12 osubadu rd");
  });

  it("collapses multiple spaces", () => {
    expect(normalizeAddress("Tema   Community   25")).toBe("tema community 25");
  });

  it("handles empty string", () => {
    expect(normalizeAddress("")).toBe("");
  });

  it("handles numbers and letters only", () => {
    expect(normalizeAddress("Block A3, House 14")).toBe("block a3 house 14");
  });
});
