export type Product = {
  id: string; name: string; brand: string; category: string; price: number;
  compareAt?: number; sku: string; gtin: string; color: string; image: string;
  stock: "In stock" | "Low stock"; delivery: string; description: string;
  features: string[];
};

export type CompetitorOffer = {
  id: string; retailer: string; productId: string; productPrice: number;
  shipping: number; fees: number; currency: "SEK"; verified: boolean;
  productEquivalent: boolean; inStock: boolean; retrievedAt: string;
  expiresAt: string; delivery: string; sourceUrl: string; source: "demo" | "live" | "cache";
};

export type MerchantPolicy = {
  enabled: boolean; maximumDiscountPercent: number; minimumPrice: number;
  requireVerifiedSeller: boolean; includeShipping: boolean; currency: "SEK";
};

export type PricingDecision = {
  eligible: boolean; originalPrice: number; competitorTotal?: number;
  proposedPrice: number; discount: number; savings: number; reason: string;
};
