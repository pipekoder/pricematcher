import type { Currency, DataProvenance, Money, Product } from "../types";

export type DiscoveredOffer = {
  providerProductId: string; retailer: string; retailerDomain: string; sourceUrl: string;
  sourceType: DataProvenance; retrievedAt: string; productTitle: string;
  brand?: string; model?: string; gtin?: string; color?: string; size?: string;
  condition?: "new" | "used"; productPrice: Money; shipping: Money | null;
  fees: Money | null; deliveredCostSource: "channel3" | "retailer_api" | "fixture" | "unknown";
  deliveredCostRetrievedAt?: string; availability: "in_stock" | "out_of_stock" | "unknown";
};

export interface PriceIntelligenceProvider {
  readonly sourceType: DataProvenance;
  search(product: Product): Promise<DiscoveredOffer[]>;
}

export type DeliveredCostQuote = { shipping: Money; mandatoryFees: Money; obtainedAt: string; method: "retailer_api" | "channel3" };
export interface DeliveredCostResolver { resolve(input: { sourceUrl: string; productPrice: Money }): Promise<DeliveredCostQuote | null> }
export const unknownDeliveredCostResolver: DeliveredCostResolver = { resolve: async () => null };

export function decimalToMinor(value: number, currency: Currency): Money | null {
  if (!Number.isFinite(value) || value < 0) return null;
  const fixed = value.toFixed(2);
  if (Math.abs(Number(fixed) - value) > 0.000001) return null;
  return { amountMinor: Number(fixed.replace(".", "")), currency };
}
