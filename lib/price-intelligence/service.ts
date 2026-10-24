import { createHash, randomUUID } from "node:crypto";
import { getProduct } from "../catalog";
import { defaultPolicy } from "../demo-data";
import { money, multiplyMoney, subtractMoney } from "../money";
import { evaluatePricing, type PricingClock, systemClock } from "../pricing";
import type { AuthorizedOffer, ComparisonRequest, CompetitorEvidence, ComparisonResult } from "../types";
import type { PriceIntelligenceRepository } from "../persistence/repository";
import { verifyEquivalence, unavailableAiEvaluator, type AiEquivalenceEvaluator } from "./equivalence";
import type { PriceIntelligenceProvider } from "./provider";

export const DEMO_MERCHANT_ID = "north-01";
export function cartFingerprint(sessionId: string, productId: string, variantKey: string, quantity: number) { return createHash("sha256").update(`${sessionId}:${productId}:${variantKey}:${quantity}`).digest("hex"); }
const variantKey = (p: NonNullable<ReturnType<typeof getProduct>>) => `${p.sku}:${p.variant.color}:${p.variant.size ?? ""}:${p.variant.condition}`;

export class PriceIntelligenceService {
  constructor(private provider: PriceIntelligenceProvider, private repo: PriceIntelligenceRepository, private ai: AiEquivalenceEvaluator = unavailableAiEvaluator, private clock: PricingClock = systemClock) {}
  async compare(input: { sessionId: string; productId: string; quantity: number }): Promise<ComparisonResult> {
    const product = getProduct(input.productId); if (!product) throw new Error("Unknown product");
    const now = this.clock.now(); const comparison: ComparisonRequest = { id: randomUUID(), merchantId: DEMO_MERCHANT_ID, ...input, cartFingerprint: cartFingerprint(input.sessionId, product.id, variantKey(product), input.quantity), status: "requested", sourceType: this.provider.sourceType, createdAt: now.toISOString() };
    await this.repo.saveComparison(comparison);
    const discovered = await this.provider.search(product);
    const policy = (await this.repo.getPolicy(DEMO_MERCHANT_ID)) ?? defaultPolicy; if (!(await this.repo.getPolicy(DEMO_MERCHANT_ID))) await this.repo.savePolicy(policy);
    const evidence: CompetitorEvidence[] = [];
    for (const item of discovered) { const v = await verifyEquivalence(product, item, this.ai); evidence.push({ id: randomUUID(), comparisonId: comparison.id, ...item, variant: { color: item.color, size: item.size, condition: item.condition }, sellerVerification: policy.approvedCompetitorDomains.includes(item.retailerDomain) ? "approved" : "unverified", productMatch: v.match, aiAssisted: v.aiAssisted, verificationReasons: v.reasons }); }
    await this.repo.saveEvidence(evidence); const decision = evaluatePricing(product, evidence, policy);
    let offer: AuthorizedOffer | undefined;
    if (decision.eligible && decision.evidenceId) { const selected = evidence.find((e) => e.id === decision.evidenceId)!; const zero = money(0, "USD"); const originalSubtotal = multiplyMoney(product.price, input.quantity); const approvedSubtotal = multiplyMoney(decision.approvedUnitPrice, input.quantity); offer = { id: randomUUID(), comparisonId: comparison.id, merchantId: DEMO_MERCHANT_ID, sessionId: input.sessionId, productId: product.id, productGtin: product.gtin, variantKey: variantKey(product), quantity: input.quantity, cartFingerprint: comparison.cartFingerprint, originalUnitPrice: product.price, approvedUnitPrice: decision.approvedUnitPrice, originalSubtotal, approvedSubtotal, tax: { ...zero }, shipping: { ...zero }, fees: { ...zero }, finalTotal: { ...approvedSubtotal }, currency: "USD", discountAmount: subtractMoney(originalSubtotal, approvedSubtotal), policyId: policy.id, policyVersion: policy.version, evidenceId: selected.id, evidenceSnapshot: structuredClone(selected), createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + policy.offerTtlSeconds * 1000).toISOString(), status: "issued" }; await this.repo.saveOffer(offer); }
    comparison.status = "completed"; comparison.completedAt = this.clock.now().toISOString(); await this.repo.saveComparison(comparison); return { comparison, decision, evidence, offer };
  }
  async accept(input: { offerId: string; sessionId: string; productId: string; quantity: number }) { const product = getProduct(input.productId); if (!product) throw new Error("Unknown product"); const existing = await this.repo.getOffer(input.offerId); if (!existing) throw new Error("Offer not found"); const original = multiplyMoney(product.price, existing.quantity); const approved = multiplyMoney(existing.approvedUnitPrice, existing.quantity); if (existing.productId !== product.id || existing.originalSubtotal.amountMinor !== original.amountMinor || existing.approvedSubtotal.amountMinor !== approved.amountMinor || approved.amountMinor + existing.tax.amountMinor + existing.shipping.amountMinor + existing.fees.amountMinor !== existing.finalTotal.amountMinor) throw new Error("Stored offer totals failed server validation"); return this.repo.acceptOffer({ offerId: input.offerId, sessionId: input.sessionId, cartFingerprint: cartFingerprint(input.sessionId, product.id, variantKey(product), input.quantity), now: this.clock.now() }); }
}
