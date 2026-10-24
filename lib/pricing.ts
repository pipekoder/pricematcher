import { addMoney, money, subtractMoney } from "./money";
import type { CompetitorEvidence, MerchantPolicy, PricingDecision, Product } from "./types";

export type PricingClock = { now: () => Date };
export const systemClock: PricingClock = { now: () => new Date() };

export function deliveredTotal(evidence: CompetitorEvidence) {
  if (!evidence.shipping || !evidence.fees) return null;
  return addMoney(evidence.productPrice, evidence.shipping, evidence.fees);
}

export function evaluatePricing(product: Product, evidence: CompetitorEvidence[], policy: MerchantPolicy): PricingDecision {
  const noOffer = (reason: string, reasonCode: PricingDecision["reasonCode"] = "no_eligible_offer"): PricingDecision => ({
    eligible: false, reasonCode, reason, originalUnitPrice: product.price,
    approvedUnitPrice: product.price, discountAmount: money(0, product.price.currency),
  });
  if (!policy.enabled || !product.priceMatchEligible || !policy.eligibleProductIds.includes(product.id)) return noOffer("This product is not eligible for a price match.");
  if (product.price.currency !== policy.currency) return noOffer("The merchant policy uses a different currency.");

  const eligible = evidence.flatMap((item) => {
    if (item.productPrice.currency !== policy.currency || item.shipping?.currency !== policy.currency || item.fees?.currency !== policy.currency) return [];
    const total = deliveredTotal(item);
    if (!total) return [];
    if (item.productMatch !== "exact" || item.sellerVerification !== "approved") return [];
    if (item.availability !== "in_stock" || item.variant.condition !== "new") return [];
    if (!policy.approvedCompetitorDomains.includes(item.retailerDomain)) return [];
    return [{ item, total }];
  }).sort((a, b) => a.total.amountMinor - b.total.amountMinor);

  if (!eligible.length) return noOffer("We could not verify a like-for-like delivered offer from an approved retailer.");
  const best = eligible[0];
  if (best.total.amountMinor >= product.price.amountMinor) return { ...noOffer("Your current price is already competitive.", "already_competitive"), competitorDeliveredTotal: best.total, evidenceId: best.item.id };

  const strategyAmount = policy.pricingStrategy.type === "match"
    ? best.total.amountMinor
    : best.total.amountMinor - Math.max(0, policy.pricingStrategy.amountMinor);
  const discountFloor = Math.ceil(product.price.amountMinor * (10_000 - policy.maximumDiscountBps) / 10_000);
  const productFloor = policy.minimumPriceByProduct[product.id]?.amountMinor ?? 0;
  const approvedMinor = Math.max(strategyAmount, discountFloor, productFloor);
  if (approvedMinor >= product.price.amountMinor) return { ...noOffer("The verified price is outside this retailer's approved offer limits."), competitorDeliveredTotal: best.total, evidenceId: best.item.id };
  const approvedUnitPrice = money(approvedMinor, policy.currency);
  return {
    eligible: true, reasonCode: "eligible",
    reason: "We verified the same product and variant from an approved retailer, including delivery costs.",
    originalUnitPrice: product.price, competitorDeliveredTotal: best.total,
    approvedUnitPrice, discountAmount: subtractMoney(product.price, approvedUnitPrice), evidenceId: best.item.id,
  };
}
