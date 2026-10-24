import { describe, expect, it } from "vitest";
import { getProduct } from "./catalog";
import { defaultPolicy } from "./demo-data";
import { evaluatePricing } from "./pricing";
import type { CompetitorEvidence } from "./types";

const product = getProduct("nord-sound-2")!;
const evidence = (overrides: Partial<CompetitorEvidence> = {}): CompetitorEvidence => ({ id: "e1", comparisonId: "c1", providerProductId: "p1", retailer: "Audio Example", retailerDomain: "audio.example", sourceUrl: "https://audio.example/p", sourceType: "fixture", retrievedAt: new Date().toISOString(), productTitle: product.name, brand: product.brand, model: product.model, gtin: product.gtin, variant: { color: product.variant.color, condition: "new" }, productPrice: { amountMinor: 13500, currency: "USD" }, shipping: { amountMinor: 400, currency: "USD" }, fees: { amountMinor: 0, currency: "USD" }, deliveredCostSource: "fixture", availability: "in_stock", sellerVerification: "approved", productMatch: "exact", aiAssisted: false, verificationReasons: [], ...overrides });

describe("merchant pricing boundaries", () => {
  it("includes shipping and applies the configured match strategy", () => { const decision = evaluatePricing(product, [evidence()], defaultPolicy); expect(decision.eligible).toBe(true); expect(decision.competitorDeliveredTotal?.amountMinor).toBe(13900); expect(decision.approvedUnitPrice.amountMinor).toBe(13900); });
  it("supports a configured better-by amount", () => { const decision = evaluatePricing(product, [evidence()], { ...defaultPolicy, pricingStrategy: { type: "better_by_fixed_amount", amountMinor: 100 } }); expect(decision.approvedUnitPrice.amountMinor).toBe(13800); });
  it("enforces maximum discount and minimum price", () => { const result = evaluatePricing(product, [evidence({ productPrice: { amountMinor: 10000, currency: "USD" }, shipping: { amountMinor: 0, currency: "USD" } })], defaultPolicy); expect(result.approvedUnitPrice.amountMinor).toBe(13500); });
  it.each([{ shipping: null }, { sellerVerification: "unverified" as const }, { productMatch: "probable" as const }, { availability: "out_of_stock" as const }, { retailerDomain: "other.example" }, { productPrice: { amountMinor: 10000, currency: "EUR" as never } }])("fails closed for incomplete or ineligible evidence", (change) => { expect(evaluatePricing(product, [evidence(change)], defaultPolicy).eligible).toBe(false); });
  it("reports already competitive", () => { const result = evaluatePricing(product, [evidence({ productPrice: { amountMinor: 14900, currency: "USD" }, shipping: { amountMinor: 0, currency: "USD" } })], defaultPolicy); expect(result.reasonCode).toBe("already_competitive"); expect(result.eligible).toBe(false); });
});
