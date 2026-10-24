import { randomUUID } from "node:crypto";
import { getProduct } from "../catalog";
import { multiplyMoney, subtractMoney } from "../money";
import type { PriceIntelligenceRepository } from "../persistence/repository";
import { buildCartSnapshot, cartFingerprint } from "../price-intelligence/service";
import { evaluatePricing, type PricingClock, systemClock } from "../pricing";
import type { CartItemInput, PaymentInstruction } from "../types";
import { TransactionStateError, type TransactionRepository } from "./transaction-repository";

export type ApprovalContext = { sessionId: string; cart: CartItemInput[]; idempotencyKey: string };
export type ApprovedCheckoutExecutor = (offerId: string, approvalContext: ApprovalContext) => Promise<{ instruction: PaymentInstruction; checkoutAttemptId: string; created: boolean }>;

export function createApprovedCheckoutExecutor(deps: { offers: PriceIntelligenceRepository; transactions: TransactionRepository; clock?: PricingClock }): ApprovedCheckoutExecutor {
  const clock=deps.clock??systemClock;
  return async function executeApprovedCheckout(offerId, approvalContext) {
    const now=clock.now(); const offer=await deps.offers.getOffer(offerId);
    if(!offer||offer.status!=="accepted")throw new TransactionStateError("offer_not_accepted","Accepted offer required");
    if(offer.sessionId!==approvalContext.sessionId)throw new TransactionStateError("unauthorized","Offer belongs to another session");
    if(new Date(offer.expiresAt)<=now)throw new TransactionStateError("expired","Offer expired before checkout preparation");
    const policy=await deps.offers.getPolicy(offer.merchantId); if(!policy||policy.id!==offer.policyId||policy.version!==offer.policyVersion)throw new TransactionStateError("policy_changed","Merchant policy changed");
    const evidenceAt=new Date(offer.evidenceSnapshot.retrievedAt).getTime();const deliveredAt=new Date(offer.evidenceSnapshot.deliveredCostRetrievedAt??"").getTime();if(!Number.isFinite(evidenceAt)||!Number.isFinite(deliveredAt)||now.getTime()-evidenceAt>policy.evidenceMaxAgeSeconds*1000||now.getTime()-deliveredAt>policy.evidenceMaxAgeSeconds*1000)throw new TransactionStateError("stale_evidence","Competitor evidence is stale");
    const product=getProduct(offer.productId); if(!product)throw new TransactionStateError("product_changed","Product unavailable");
    const snapshot=buildCartSnapshot(approvalContext.cart);const currentFingerprint=cartFingerprint(offer.sessionId,snapshot);
    if(currentFingerprint!==offer.cartFingerprint)throw new TransactionStateError("cart_changed","Current authoritative cart changed");
    const decision=evaluatePricing(product,[offer.evidenceSnapshot],policy); if(!decision.eligible||decision.approvedUnitPrice.amountMinor!==offer.approvedUnitPrice.amountMinor)throw new TransactionStateError("pricing_changed","Offer no longer meets policy");
    const target=snapshot.lines.find((line)=>line.productId===offer.productId)!; const discount=subtractMoney(multiplyMoney(product.price,target.quantity),multiplyMoney(decision.approvedUnitPrice,target.quantity)); const expected=subtractMoney(snapshot.total,discount);
    if(expected.amountMinor!==offer.finalTotal.amountMinor||expected.currency!==offer.currency)throw new TransactionStateError("amount_changed","Authoritative amount changed");
    const checkoutAttemptId=randomUUID(); const instruction:PaymentInstruction={checkoutAttemptId,offerId:offer.id,merchantId:offer.merchantId,provider:"paypal_sandbox",intent:"CAPTURE",amount:{...offer.finalTotal},idempotencyKey:approvalContext.idempotencyKey,description:`PriceMatcher offer ${offer.id}`};
    const prepared=await deps.transactions.prepareCheckout({offerId:offer.id,merchantId:offer.merchantId,sessionId:offer.sessionId,cartFingerprint:currentFingerprint,expectedAmount:{...expected},idempotencyKey:approvalContext.idempotencyKey,expectedPolicyId:policy.id,expectedPolicyVersion:policy.version,instruction,now});
    return {instruction:prepared.instruction,checkoutAttemptId:prepared.attempt.id,created:prepared.created};
  };
}
