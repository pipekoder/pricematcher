import { products } from "./catalog";
import type { MerchantPolicy } from "./types";

const now = "2026-10-24T00:00:00.000Z";
export const defaultPolicy: MerchantPolicy = {
  id: "policy-north-01-v1", merchantId: "north-01", version: 1, enabled: true,
  eligibleProductIds: products.map(({ id }) => id), maximumDiscountBps: 1000,
  minimumPriceByProduct: {
    "nord-sound-2": { amountMinor: 13500, currency: "USD" },
    "arc-lamp": { amountMinor: 8000, currency: "USD" },
  },
  approvedCompetitorDomains: ["audio.example", "home.example"],
  includeShipping: true, requireKnownShipping: true, currency: "USD",
  pricingStrategy: { type: "match" },
  offerTtlSeconds: 15 * 60, createdAt: now,
};
