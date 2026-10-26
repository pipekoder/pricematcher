import { describe, expect, it } from "vitest";
import { getProduct } from "../catalog";
import { verifyEquivalence } from "./equivalence";
import type { DiscoveredOffer } from "./provider";

const product = getProduct("nord-sound-2")!;
const candidate = (overrides: Partial<DiscoveredOffer> = {}): DiscoveredOffer => ({
  providerProductId: "candidate",
  retailer: "Example",
  retailerDomain: "example.com",
  sourceUrl: "https://example.com/product",
  sourceType: "fixture",
  retrievedAt: "2026-10-26T06:00:00.000Z",
  productTitle: product.name,
  brand: product.brand,
  model: product.model,
  gtin: product.gtin,
  color: product.variant.color,
  condition: "new",
  productPrice: { amountMinor: 13900, currency: "USD" },
  shipping: null,
  fees: null,
  deliveredCostSource: "unknown",
  availability: "in_stock",
  ...overrides,
});

describe("identity comparison explanations", () => {
  it("lists matched, differed, and missing attributes for an exact match", async () => {
    const result = await verifyEquivalence(product, candidate());
    expect(result.reasons).toEqual(expect.arrayContaining([
      expect.stringContaining("Matched: brand, model, GTIN, color, condition"),
      "Missing: none",
      "Differed: none",
    ]));
  });

  it("identifies a differing variant without hiding missing identifiers", async () => {
    const result = await verifyEquivalence(product, candidate({ gtin: undefined, color: "Silver" }));
    expect(result.match).toBe("mismatch");
    expect(result.reasons).toEqual(expect.arrayContaining(["Missing: GTIN", "Differed: color"]));
  });

  it("does not claim an exact variant when the stable identifier is missing", async () => {
    const result = await verifyEquivalence(product, candidate({ gtin: undefined }));
    expect(result).toMatchObject({ match: "uncertain", aiAssisted: false });
    expect(result.reasons).toContain("Missing: GTIN");
  });

  it("treats a missing required condition as insufficient evidence, not a conflict", async () => {
    const result = await verifyEquivalence(product, candidate({ condition: undefined }));
    expect(result).toMatchObject({ match: "uncertain", aiAssisted: false });
    expect(result.reasons).toContain("Missing: condition");
  });

  it("rejects a conflicting required size", async () => {
    const sizedProduct = { ...product, variant: { ...product.variant, size: "M" } };
    const result = await verifyEquivalence(sizedProduct, candidate({ size: "L" }));
    expect(result).toMatchObject({ match: "mismatch", aiAssisted: false });
    expect(result.reasons).toContain("Differed: size");
  });

  it("reports a missing required size as insufficient evidence", async () => {
    const sizedProduct = { ...product, variant: { ...product.variant, size: "M" } };
    const result = await verifyEquivalence(sizedProduct, candidate({ size: undefined }));
    expect(result).toMatchObject({ match: "uncertain", aiAssisted: false });
    expect(result.reasons).toContain("Missing: size");
  });

  it("rejects a conflicting model even when the title is similar", async () => {
    const result = await verifyEquivalence(product, candidate({ model: "NS3", productTitle: product.name }));
    expect(result).toMatchObject({ match: "mismatch", aiAssisted: false });
    expect(result.reasons).toContain("Differed: model");
  });

  it("labels a real AI evaluation only when an evaluator is called", async () => {
    const result = await verifyEquivalence(product, candidate({ gtin: undefined }), { source: "ai", evaluate: async () => "probable" });
    expect(result).toMatchObject({ match: "probable", aiAssisted: true });
  });
});
