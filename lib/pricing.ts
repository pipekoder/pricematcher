import type { CompetitorOffer, MerchantPolicy, PricingDecision, Product } from "./types";

export type PricingClock = { now: () => Date };

const systemClock: PricingClock = { now: () => new Date() };

export function competitorTotal(offer: CompetitorOffer) {
  return offer.productPrice + offer.shipping + offer.fees;
}

export function findMatchingOffer(product: Pick<Product, "id" | "gtin">, offers: CompetitorOffer[]) {
  return offers.find((offer) =>
    offer.productId === product.id &&
    offer.productGtin === product.gtin &&
    offer.productEquivalent,
  );
}

export function evaluatePrice(
  product: Pick<Product, "id" | "gtin" | "price">,
  offer: CompetitorOffer | undefined,
  policy: MerchantPolicy,
  clock: PricingClock = systemClock,
): PricingDecision {
  const originalPrice = product.price;
  const noOffer = (reason: string): PricingDecision => ({ eligible: false, originalPrice, proposedPrice: originalPrice, discount: 0, savings: 0, reason });
  if (!policy.enabled) return noOffer("Price matching is not enabled for this product.");
  if (!offer) return noOffer("No exact product and variant match was found.");
  if (offer.productId !== product.id || offer.productGtin !== product.gtin) return noOffer("The competitor offer is for a different product or variant.");
  if (offer.currency !== policy.currency) return noOffer("The competitor offer uses a different currency.");
  if (!offer.inStock) return noOffer("The competitor product is out of stock.");
  if (!offer.productEquivalent) return noOffer("The competitor product is not an exact match.");
  if (policy.requireVerifiedSeller && !offer.verified) return noOffer("The competitor retailer could not be verified.");
  if (new Date(offer.expiresAt) <= clock.now()) return noOffer("The competitor offer has expired.");
  const total = policy.includeShipping ? competitorTotal(offer) : offer.productPrice;
  if (total >= originalPrice) return { ...noOffer("Your current price is already competitive."), competitorTotal: total };
  const discountLimit = originalPrice * (1 - policy.maximumDiscountPercent / 100);
  const strategyPrice = total - Math.max(0, policy.pricingStrategy.amount);
  const proposedPrice = Math.ceil(Math.max(strategyPrice, policy.minimumPrice, discountLimit));
  if (proposedPrice >= originalPrice) return { ...noOffer("This offer falls outside the merchant's approved pricing policy."), competitorTotal: total };
  return {
    eligible: true, originalPrice, competitorTotal: total, proposedPrice,
    discount: originalPrice - proposedPrice, savings: originalPrice - proposedPrice,
    reason: "We verified the same model in stock and found a lower delivered price. This merchant-approved offer keeps local pickup and faster delivery.",
  };
}
