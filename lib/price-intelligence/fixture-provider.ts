import type { Product } from "../types";
import type { DiscoveredOffer, PriceIntelligenceProvider } from "./provider";

export class FixturePriceProvider implements PriceIntelligenceProvider {
  readonly sourceType = "fixture" as const;
  constructor(private readonly now = () => new Date()) {}
  async search(product: Product): Promise<DiscoveredOffer[]> {
    if (product.id === "nord-sound-2") return [{
      providerProductId: "fixture-ns2", retailer: "Audio Example", retailerDomain: "audio.example",
      sourceUrl: "https://audio.example/products/auralis-nord-sound-2", sourceType: "fixture",
      retrievedAt: this.now().toISOString(), productTitle: "Auralis Nord Sound 2 — Midnight",
      brand: "Auralis", model: "NS2", gtin: product.gtin, color: "Midnight", condition: "new",
      productPrice: { amountMinor: 13500, currency: "USD" }, shipping: { amountMinor: 400, currency: "USD" },
      fees: { amountMinor: 0, currency: "USD" }, deliveredCostSource: "fixture", deliveredCostRetrievedAt: this.now().toISOString(), availability: "in_stock",
    }];
    if (product.id === "arc-lamp") return [{
      providerProductId: "fixture-arc", retailer: "Home Example", retailerDomain: "home.example",
      sourceUrl: "https://home.example/products/norr-form-arc", sourceType: "fixture",
      retrievedAt: this.now().toISOString(), productTitle: "Norr Form Arc Table Lamp — Sand",
      brand: "Norr Form", model: "ARC-01", gtin: product.gtin, color: "Sand", condition: "new",
      productPrice: { amountMinor: 8800, currency: "USD" }, shipping: { amountMinor: 400, currency: "USD" },
      fees: { amountMinor: 0, currency: "USD" }, deliveredCostSource: "fixture", deliveredCostRetrievedAt: this.now().toISOString(), availability: "in_stock",
    }];
    return [];
  }
}
