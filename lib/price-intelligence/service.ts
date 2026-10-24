import { createHash, randomUUID } from "node:crypto";
import { getProduct } from "../catalog";
import { defaultPolicy } from "../demo-data";
import { addMoney, money, multiplyMoney, subtractMoney } from "../money";
import { evaluatePricing, type PricingClock, systemClock } from "../pricing";
import type { AuthorizedOffer, CartItemInput, CartSnapshot, ComparisonRequest, CompetitorEvidence, ComparisonResult, MerchantPolicy } from "../types";
import { OfferValidationError, type PriceIntelligenceRepository } from "../persistence/repository";
import { verifyEquivalence, unavailableAiEvaluator, type AiEquivalenceEvaluator } from "./equivalence";
import type { PriceIntelligenceProvider } from "./provider";

export const DEMO_MERCHANT_ID = "north-01";
export const productVariantKey = (product: NonNullable<ReturnType<typeof getProduct>>) => `${product.sku}:${product.variant.color}:${product.variant.size ?? ""}:${product.variant.condition}`;

export function buildCartSnapshot(items: CartItemInput[]): CartSnapshot {
  if (!items.length) throw new OfferValidationError("invalid_cart", "Cart cannot be empty");
  const merged = new Map<string, CartItemInput>();
  for (const item of items) {
    if (!Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 9) throw new OfferValidationError("invalid_cart", "Invalid quantity");
    const product = getProduct(item.productId);
    if (!product || item.variantKey !== productVariantKey(product)) throw new OfferValidationError("invalid_cart", "Unknown product or variant");
    if (merged.has(item.productId)) throw new OfferValidationError("invalid_cart", "Duplicate cart line");
    merged.set(item.productId, item);
  }
  const lines = [...merged.values()].sort((a, b) => a.productId.localeCompare(b.productId)).map((item) => {
    const product = getProduct(item.productId)!;
    return { ...item, unitPrice: { ...product.price }, lineTotal: multiplyMoney(product.price, item.quantity) };
  });
  const subtotal = addMoney(...lines.map((line) => line.lineTotal));
  const shipping = money(subtotal.amountMinor >= 7500 ? 0 : 590, "USD");
  const tax = money(0, "USD"); const fees = money(0, "USD");
  return { lines, currency: "USD", subtotal, shipping, tax, fees, total: addMoney(subtotal, shipping, tax, fees) };
}

export function cartFingerprint(sessionId: string, snapshot: CartSnapshot) {
  const canonical = JSON.stringify({ sessionId, currency: snapshot.currency, lines: snapshot.lines.map(({ productId, variantKey, quantity, unitPrice, lineTotal }) => ({ productId, variantKey, quantity, unitPrice, lineTotal })), shipping: snapshot.shipping, tax: snapshot.tax, fees: snapshot.fees, total: snapshot.total });
  return createHash("sha256").update(canonical).digest("hex");
}

function evidenceIsFresh(evidence: CompetitorEvidence, policy: MerchantPolicy, now: Date) {
  const retrieved = new Date(evidence.retrievedAt).getTime();
  const delivered = evidence.deliveredCostRetrievedAt ? new Date(evidence.deliveredCostRetrievedAt).getTime() : Number.NaN;
  return Number.isFinite(retrieved) && retrieved <= now.getTime() && now.getTime() - retrieved <= policy.evidenceMaxAgeSeconds * 1000 && Number.isFinite(delivered) && delivered <= now.getTime() && now.getTime() - delivered <= policy.evidenceMaxAgeSeconds * 1000;
}

export class PriceIntelligenceService {
  constructor(private provider: PriceIntelligenceProvider, private repo: PriceIntelligenceRepository, private ai: AiEquivalenceEvaluator = unavailableAiEvaluator, private clock: PricingClock = systemClock) {}
  async compare(input: { sessionId: string; productId: string; cart: CartItemInput[] }): Promise<ComparisonResult> {
    const product = getProduct(input.productId); if (!product) throw new Error("Unknown product");
    const snapshot = buildCartSnapshot(input.cart); const target = snapshot.lines.find((line) => line.productId === product.id); if (!target) throw new OfferValidationError("invalid_cart", "Compared product is not in the cart");
    const now = this.clock.now(); const comparison: ComparisonRequest = { id: randomUUID(), merchantId: DEMO_MERCHANT_ID, sessionId: input.sessionId, productId: product.id, quantity: target.quantity, cartFingerprint: cartFingerprint(input.sessionId, snapshot), status: "requested", sourceType: this.provider.sourceType, createdAt: now.toISOString() };
    await this.repo.saveComparison(comparison);
    const discovered = await this.provider.search(product);
    let policy = await this.repo.getPolicy(DEMO_MERCHANT_ID); if (!policy) { policy = defaultPolicy; await this.repo.savePolicy(policy); }
    const evidence: CompetitorEvidence[] = [];
    for (const item of discovered) { const verification = await verifyEquivalence(product, item, this.ai); evidence.push({ id: randomUUID(), comparisonId: comparison.id, ...item, variant: { color: item.color, size: item.size, condition: item.condition }, sellerVerification: policy.approvedCompetitorDomains.includes(item.retailerDomain) ? "approved" : "unverified", productMatch: verification.match, aiAssisted: verification.aiAssisted, verificationReasons: verification.reasons }); }
    await this.repo.saveEvidence(evidence);
    const evaluatedAt = this.clock.now(); const freshEvidence = evidence.filter((item) => evidenceIsFresh(item, policy, evaluatedAt)); const decision = evaluatePricing(product, freshEvidence, policy);
    let offer: AuthorizedOffer | undefined;
    if (decision.eligible && decision.evidenceId) {
      const selected = freshEvidence.find((item) => item.id === decision.evidenceId)!; const originalSubtotal = multiplyMoney(product.price, target.quantity); const approvedSubtotal = multiplyMoney(decision.approvedUnitPrice, target.quantity); const discountAmount = subtractMoney(originalSubtotal, approvedSubtotal); const finalTotal = subtractMoney(snapshot.total, discountAmount);
      offer = { id: randomUUID(), comparisonId: comparison.id, merchantId: DEMO_MERCHANT_ID, sessionId: input.sessionId, productId: product.id, productGtin: product.gtin, variantKey: target.variantKey, quantity: target.quantity, cartFingerprint: comparison.cartFingerprint, originalUnitPrice: { ...product.price }, approvedUnitPrice: { ...decision.approvedUnitPrice }, originalSubtotal, approvedSubtotal, tax: { ...snapshot.tax }, shipping: { ...snapshot.shipping }, fees: { ...snapshot.fees }, finalTotal, currency: "USD", discountAmount, policyId: policy.id, policyVersion: policy.version, evidenceId: selected.id, evidenceSnapshot: structuredClone(selected), cartSnapshot: structuredClone(snapshot), createdAt: evaluatedAt.toISOString(), expiresAt: new Date(evaluatedAt.getTime() + policy.offerTtlSeconds * 1000).toISOString(), status: "issued" };
      await this.repo.saveOffer(offer);
    }
    comparison.status = "completed"; comparison.completedAt = this.clock.now().toISOString(); await this.repo.saveComparison(comparison); return { comparison, decision, evidence, offer };
  }
  async accept(input: { offerId: string; sessionId: string; cart: CartItemInput[] }) {
    const now = this.clock.now(); const existing = await this.repo.getOffer(input.offerId); if (!existing) throw new OfferValidationError("not_found", "Offer not found");
    if (new Date(existing.expiresAt) <= now) throw new OfferValidationError("expired", "Offer has expired; check the price again");
    const snapshot = buildCartSnapshot(input.cart); const fingerprint = cartFingerprint(input.sessionId, snapshot);
    if (existing.sessionId !== input.sessionId) throw new OfferValidationError("unauthorized", "Offer belongs to another session");
    if (existing.cartFingerprint !== fingerprint) throw new OfferValidationError("cart_changed", "Cart no longer matches the authorized snapshot");
    const product = getProduct(existing.productId); if (!product) throw new OfferValidationError("product_changed", "Product is no longer available");
    const policy = await this.repo.getPolicy(existing.merchantId); if (!policy || policy.id !== existing.policyId || policy.version !== existing.policyVersion) throw new OfferValidationError("policy_changed", "Merchant policy changed; check the price again");
    if (!evidenceIsFresh(existing.evidenceSnapshot, policy, now)) throw new OfferValidationError("stale_evidence", "Competitor evidence is stale; check the price again");
    const decision = evaluatePricing(product, [existing.evidenceSnapshot], policy);
    const target = snapshot.lines.find((line) => line.productId === product.id);
    if (!target || !decision.eligible || decision.evidenceId !== existing.evidenceId || decision.approvedUnitPrice.amountMinor !== existing.approvedUnitPrice.amountMinor) throw new OfferValidationError("offer_invalid", "Offer no longer satisfies merchant policy");
    const originalSubtotal = multiplyMoney(product.price, target.quantity); const approvedSubtotal = multiplyMoney(decision.approvedUnitPrice, target.quantity); const discount = subtractMoney(originalSubtotal, approvedSubtotal); const total = subtractMoney(snapshot.total, discount);
    if (existing.originalUnitPrice.amountMinor !== product.price.amountMinor || existing.originalSubtotal.amountMinor !== originalSubtotal.amountMinor || existing.approvedSubtotal.amountMinor !== approvedSubtotal.amountMinor || existing.finalTotal.amountMinor !== total.amountMinor || existing.tax.amountMinor !== snapshot.tax.amountMinor || existing.shipping.amountMinor !== snapshot.shipping.amountMinor || existing.fees.amountMinor !== snapshot.fees.amountMinor) throw new OfferValidationError("totals_changed", "Authoritative totals changed; check the price again");
    return this.repo.acceptOffer({ offerId: existing.id, sessionId: input.sessionId, cartFingerprint: fingerprint, now });
  }
}
