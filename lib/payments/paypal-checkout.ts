import type { PriceIntelligenceRepository } from "../persistence/repository";
import type { CheckoutAttempt } from "../types";
import type { PaymentProvider, ProviderError } from "./provider";
import { TransactionStateError, type TransactionRepository } from "./transaction-repository";

type Dependencies = { offers: PriceIntelligenceRepository; transactions: TransactionRepository; provider: PaymentProvider; now?: () => Date };
function sameAmount(attempt: CheckoutAttempt, amount: CheckoutAttempt["expectedAmount"]) { return attempt.expectedAmount.currency === amount.currency && attempt.expectedAmount.amountMinor === amount.amountMinor; }
function assertOwner(attempt: CheckoutAttempt | undefined, sessionId: string): asserts attempt is CheckoutAttempt {
  if (!attempt) throw new TransactionStateError("not_found", "Checkout attempt not found");
  if (attempt.sessionId !== sessionId) throw new TransactionStateError("unauthorized", "Checkout attempt belongs to another session");
}
function providerFailure(error: ProviderError) { return new TransactionStateError(error.code, error.message); }

export function createPayPalCheckoutService(deps: Dependencies) {
  const now = deps.now ?? (() => new Date());
  async function verifyExact(attempt: CheckoutAttempt, transactionId: string) {
    const verification = await deps.provider.verifyPayment({ orderId: attempt.providerOrderId!, transactionId, expectedAmount: attempt.expectedAmount });
    if (!verification.ok || !verification.value.verified || verification.value.orderId !== attempt.providerOrderId || verification.value.transactionId !== transactionId || verification.value.captureStatus !== "COMPLETED") throw new TransactionStateError("verification_failed", "Exact PayPal capture could not be independently verified");
  }
  async function finalizeCapture(attempt: CheckoutAttempt, transactionId: string) {
    if (attempt.providerTransactionId && attempt.providerTransactionId !== transactionId) throw new TransactionStateError("capture_mismatch", "PayPal capture does not match the persisted transaction");
    if (!attempt.providerTransactionId) attempt = await deps.transactions.recordProviderCapture({ id: attempt.id, providerOrderId: attempt.providerOrderId!, providerTransactionId: transactionId, now: now() });
    try { await verifyExact(attempt, transactionId); }
    catch {
      if (attempt.status === "capture_pending") await deps.transactions.transitionCheckout({ id: attempt.id, from: ["capture_pending"], to: "reconciliation_required", providerTransactionId: transactionId, failureCode: "verification_failed", reconciliationStatus: "mismatch", now: now() });
      throw new TransactionStateError("verification_failed", "Captured payment requires reconciliation");
    }
    if (attempt.status === "capture_pending") attempt = await deps.transactions.transitionCheckout({ id: attempt.id, from: ["capture_pending"], to: "captured", providerTransactionId: transactionId, reconciliationStatus: "matched", now: now() });
    try {
      const offer = await deps.offers.getOffer(attempt.offerId); if (offer?.status !== "consumed") await deps.offers.consumeOffer(attempt.offerId, now());
    } catch {
      if (attempt.status === "captured") await deps.transactions.transitionCheckout({ id: attempt.id, from: ["captured"], to: "reconciliation_required", providerTransactionId: transactionId, failureCode: "offer_consumption_failed", reconciliationStatus: "pending", now: now() });
      throw new TransactionStateError("reconciliation_required", "Payment completed but local reconciliation is required");
    }
    if (attempt.status === "reconciliation_required") await deps.transactions.transitionCheckout({ id: attempt.id, from: ["reconciliation_required"], to: "reconciled", providerTransactionId: transactionId, reconciliationStatus: "matched", now: now() });
    return { checkoutAttemptId: attempt.id, status: "captured" as const, verified: true };
  }
  return {
    async createOrder(checkoutAttemptId: string, sessionId: string) {
      let attempt = await deps.transactions.getCheckoutAttempt(checkoutAttemptId); assertOwner(attempt, sessionId);
      const authorized = await deps.offers.getOffer(attempt.offerId);
      if (!authorized || authorized.status !== "accepted" || authorized.sessionId !== sessionId || new Date(authorized.expiresAt) <= now()) throw new TransactionStateError("offer_invalid", "Accepted offer is unavailable or expired");
      const activePolicy = await deps.offers.getPolicy(authorized.merchantId);
      if (!activePolicy || activePolicy.id !== authorized.policyId || activePolicy.version !== authorized.policyVersion) throw new TransactionStateError("policy_changed", "Merchant policy changed");
      if (authorized.finalTotal.currency !== attempt.expectedAmount.currency || authorized.finalTotal.amountMinor !== attempt.expectedAmount.amountMinor) throw new TransactionStateError("amount_changed", "Authorized checkout amount changed");
      if (attempt.providerOrderId && ["order_created","buyer_approved","capture_pending","captured","reconciliation_required","reconciled"].includes(attempt.status)) return { orderId: attempt.providerOrderId, status: attempt.status, created: false };
      if (attempt.status !== "prepared") throw new TransactionStateError("invalid_transition", "Checkout is not ready to create an order");
      attempt = await deps.transactions.transitionCheckout({ id: attempt.id, from: ["prepared"], to: "order_pending", now: now() });
      const result = await deps.provider.createOrder({ checkoutAttemptId: attempt.id, idempotencyKey: attempt.id, amount: attempt.expectedAmount, intent: "CAPTURE", description: `PriceMatcher checkout ${attempt.id}` });
      if (!result.ok) {
        await deps.transactions.transitionCheckout({ id: attempt.id, from: ["order_pending"], to: result.error.retryable ? "reconciliation_required" : "failed", failureCode: result.error.code, reconciliationStatus: result.error.retryable ? "pending" : "not_required", now: now() });
        throw providerFailure(result.error);
      }
      attempt = await deps.transactions.transitionCheckout({ id: attempt.id, from: ["order_pending"], to: "order_created", providerOrderId: result.value.orderId, now: now() });
      return { orderId: result.value.orderId, status: attempt.status, created: true };
    },

    async captureApprovedOrder(checkoutAttemptId: string, sessionId: string) {
      let attempt = await deps.transactions.getCheckoutAttempt(checkoutAttemptId); assertOwner(attempt, sessionId);
      if (!attempt.providerOrderId) throw new TransactionStateError("order_missing", "PayPal order has not been created");
      if (attempt.status === "captured" || attempt.status === "reconciled") {
        if (!attempt.providerTransactionId) throw new TransactionStateError("verification_failed", "Stored PayPal capture identifier is missing");
        await verifyExact(attempt, attempt.providerTransactionId);
        return { checkoutAttemptId: attempt.id, status: "captured" as const, verified: true };
      }
      if (!["order_created","capture_pending","reconciliation_required"].includes(attempt.status)) throw new TransactionStateError("payment_in_progress", "Payment is already processing or cannot be recovered automatically");
      const observed = await deps.provider.getOrder(attempt.providerOrderId); if (!observed.ok) throw providerFailure(observed.error);
      if (observed.value.status === "COMPLETED") {
        const capture = observed.value.captures.length === 1 ? observed.value.captures[0] : undefined;
        if (!capture || capture.status !== "COMPLETED" || !sameAmount(attempt, observed.value.amount) || !sameAmount(attempt, capture.amount)) throw new TransactionStateError("capture_mismatch", "PayPal returned a missing, mismatched, or ambiguous capture");
        return finalizeCapture(attempt, capture.transactionId);
      }
      if (observed.value.status !== "APPROVED" || observed.value.captures.length !== 0 || !sameAmount(attempt, observed.value.amount)) throw new TransactionStateError("approval_invalid", "PayPal buyer approval, amount, or capture state could not be verified");
      if (attempt.status === "order_created") {
        attempt = await deps.transactions.transitionCheckout({ id: attempt.id, from: ["order_created"], to: "buyer_approved", now: now() });
        attempt = await deps.transactions.transitionCheckout({ id: attempt.id, from: ["buyer_approved"], to: "capture_pending", now: now() });
      } else if (attempt.status === "reconciliation_required") {
        attempt = await deps.transactions.transitionCheckout({ id: attempt.id, from: ["reconciliation_required"], to: "capture_pending", failureCode: undefined, reconciliationStatus: "pending", now: now() });
      }
      const captured = await deps.provider.captureOrder({ orderId: attempt.providerOrderId!, idempotencyKey: attempt.id });
      if (!captured.ok) {
        await deps.transactions.transitionCheckout({ id: attempt.id, from: ["capture_pending"], to: captured.error.retryable ? "reconciliation_required" : "failed", failureCode: captured.error.code, reconciliationStatus: captured.error.retryable ? "pending" : "not_required", now: now() });
        throw providerFailure(captured.error);
      }
      attempt = await deps.transactions.recordProviderCapture({ id: attempt.id, providerOrderId: attempt.providerOrderId!, providerTransactionId: captured.value.transactionId, now: now() });
      if (captured.value.orderId !== attempt.providerOrderId || captured.value.status !== "COMPLETED" || !sameAmount(attempt, captured.value.amount)) {
        await deps.transactions.transitionCheckout({ id: attempt.id, from: ["capture_pending"], to: "reconciliation_required", providerTransactionId: captured.value.transactionId, failureCode: "capture_mismatch", reconciliationStatus: "mismatch", now: now() });
        throw new TransactionStateError("capture_mismatch", "Captured payment requires reconciliation");
      }
      return finalizeCapture(attempt, captured.value.transactionId);
    },
  };
}
