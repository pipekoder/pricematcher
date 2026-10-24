import { describe, expect, it } from "vitest";
import { products } from "./catalog";
import { demoOffer, defaultPolicy } from "./demo-data";
import { competitorTotal, evaluatePrice, findMatchingOffer } from "./pricing";

const headphones = products.find(({ id }) => id === "nord-sound-2")!;
const lamp = products.find(({ id }) => id === "arc-lamp")!;
const clock = (value = "2026-10-24T08:00:00Z") => ({ now: () => new Date(value) });

describe("pricing engine", () => {
  it("includes shipping and fees in the competitor total", () => expect(competitorTotal(demoOffer)).toBe(1428));
  it("respects both the floor and discount cap", () => {
    const result = evaluatePrice(headphones, demoOffer, defaultPolicy, clock());
    expect(result).toMatchObject({ eligible: true, competitorTotal: 1428, proposedPrice: 1399, discount: 100 });
  });
  it("rejects unverified sellers", () => expect(evaluatePrice(headphones, { ...demoOffer, verified: false }, defaultPolicy, clock()).eligible).toBe(false));
  it("rejects product mismatches", () => expect(evaluatePrice(headphones, { ...demoOffer, productEquivalent: false }, defaultPolicy, clock()).eligible).toBe(false));
  it("rejects an offer for a different cart product or variant", () => {
    expect(findMatchingOffer(lamp, [demoOffer])).toBeUndefined();
    expect(evaluatePrice(lamp, demoOffer, defaultPolicy, clock())).toMatchObject({ eligible: false, proposedPrice: lamp.price });
  });
  it("rejects missing offers", () => expect(evaluatePrice(lamp, undefined, defaultPolicy, clock()).eligible).toBe(false));
  it("rejects expired offers using an injected clock", () => {
    const result = evaluatePrice(headphones, { ...demoOffer, expiresAt: "2026-10-24T07:59:59Z" }, defaultPolicy, clock());
    expect(result).toMatchObject({ eligible: false, reason: "The competitor offer has expired." });
  });
  it("rejects currency mismatches", () => expect(evaluatePrice(headphones, { ...demoOffer, currency: "EUR" as "SEK" }, defaultPolicy, clock()).eligible).toBe(false));
  it("uses the configured fixed-amount strategy", () => {
    const result = evaluatePrice(headphones, demoOffer, { ...defaultPolicy, pricingStrategy: { type: "beat-competitor-by-fixed-amount", amount: 10 } }, clock());
    expect(result.proposedPrice).toBe(1418);
  });
  it("enforces the maximum discount boundary", () => {
    const result = evaluatePrice(headphones, { ...demoOffer, productPrice: 900, shipping: 0 }, { ...defaultPolicy, minimumPrice: 0, maximumDiscountPercent: 10 }, clock());
    expect(result).toMatchObject({ eligible: true, proposedPrice: 1350, discount: 149 });
  });
  it("enforces the price-floor boundary", () => {
    const result = evaluatePrice(headphones, { ...demoOffer, productPrice: 1300, shipping: 0 }, { ...defaultPolicy, minimumPrice: 1400, maximumDiscountPercent: 50 }, clock());
    expect(result).toMatchObject({ eligible: true, proposedPrice: 1400, discount: 99 });
  });
  it("returns no offer when policy boundaries reach the original price", () => {
    const result = evaluatePrice(headphones, demoOffer, { ...defaultPolicy, minimumPrice: headphones.price }, clock());
    expect(result).toMatchObject({ eligible: false, proposedPrice: headphones.price, discount: 0 });
  });
});
