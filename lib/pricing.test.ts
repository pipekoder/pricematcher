import { describe, expect, it } from "vitest";
import { demoOffer, defaultPolicy } from "./demo-data";
import { competitorTotal, evaluatePrice } from "./pricing";

describe("pricing engine", () => {
  it("includes shipping and fees in the competitor total", () => expect(competitorTotal(demoOffer)).toBe(1428));
  it("respects both the floor and discount cap", () => {
    const result = evaluatePrice(1499, demoOffer, defaultPolicy, new Date("2026-10-24"));
    expect(result).toMatchObject({ eligible: true, competitorTotal: 1428, proposedPrice: 1399, discount: 100 });
  });
  it("rejects unverified sellers", () => expect(evaluatePrice(1499, { ...demoOffer, verified: false }, defaultPolicy).eligible).toBe(false));
  it("rejects product mismatches", () => expect(evaluatePrice(1499, { ...demoOffer, productEquivalent: false }, defaultPolicy).eligible).toBe(false));
  it("rejects expired offers", () => expect(evaluatePrice(1499, { ...demoOffer, expiresAt: "2025-01-01" }, defaultPolicy, new Date("2026-01-01")).eligible).toBe(false));
  it("rejects currency mismatches", () => expect(evaluatePrice(1499, { ...demoOffer, currency: "EUR" as "SEK" }, defaultPolicy).eligible).toBe(false));
});
