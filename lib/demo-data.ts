import type { CompetitorOffer, MerchantPolicy } from "./types";

export const demoOffer: CompetitorOffer = {
  id: "cmp-demo-001", retailer: "Nordic Audio Market", productId: "nord-sound-2",
  productPrice: 1349, shipping: 79, fees: 0, currency: "SEK", verified: true,
  productEquivalent: true, inStock: true, retrievedAt: "2026-10-24T10:42:00+02:00",
  expiresAt: "2027-10-24T11:42:00+02:00", delivery: "3–5 business days",
  sourceUrl: "https://example.com/demo-offer", source: "demo",
};

export const defaultPolicy: MerchantPolicy = {
  enabled: true, maximumDiscountPercent: 10, minimumPrice: 1350,
  requireVerifiedSeller: true, includeShipping: true, currency: "SEK",
};
