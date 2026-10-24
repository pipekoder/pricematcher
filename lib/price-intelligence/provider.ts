import type { Currency, DataProvenance, Money, Product } from "../types";

export type DiscoveredOffer = {
  providerProductId: string; retailer: string; retailerDomain: string; sourceUrl: string;
  sourceType: DataProvenance; retrievedAt: string; productTitle: string;
  brand?: string; model?: string; gtin?: string; color?: string; size?: string;
  condition?: "new" | "used"; productPrice: Money; shipping: Money | null;
  fees: Money | null; availability: "in_stock" | "out_of_stock" | "unknown";
};

export interface PriceIntelligenceProvider {
  readonly sourceType: DataProvenance;
  search(product: Product): Promise<DiscoveredOffer[]>;
}

export function decimalToMinor(value: number, currency: Currency): Money | null {
  if (!Number.isFinite(value) || value < 0) return null;
  const fixed = value.toFixed(2);
  if (Math.abs(Number(fixed) - value) > 0.000001) return null;
  return { amountMinor: Number(fixed.replace(".", "")), currency };
}
