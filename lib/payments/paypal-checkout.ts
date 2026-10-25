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
  return {
    async createOrder(checkoutAttemptId: string, sessionId: string) {
      let attempt = await deps.transactions.getCheckoutAttempt(checkoutAttemptId); assertOwner(attempt, sessionId);
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
        const verification = await deps.provider.verifyPayment({ orderId: attempt.providerOrderId, transactionId: attempt.providerTransactionId, expectedAmount: attempt.expectedAmount });
        if (!verification.ok || !verification.value.verified) throw new TransactionStateError("verification_failed", "Stored PayPal payment could not be verified");
        return { checkoutAttemptId: attempt.id, status: "captured" as const, verified: true };
      }
      if (attempt.status !== "order_created") throw new TransactionStateError("payment_in_progress", "Payment is already processing or requires reconciliation");
      const approved = await deps.provider.getOrder(attempt.providerOrderId);
      if (!approved.ok) throw providerFailure(approved.error);
      if (approved.value.status !== "APPROVED" || !sameAmount(attempt, approved.value.amount)) throw new TransactionStateError("approval_invalid", "PayPal buyer approval or amount could not be verified");
      attempt = await deps.transactions.transitionCheckout({ id: attempt.id, from: ["order_created"], to: "buyer_approved", now: now() });
      attempt = await deps.transactions.transitionCheckout({ id: attempt.id, from: ["buyer_approved"], to: "capture_pending", now: now() });
      const captured = await deps.provider.captureOrder({ orderId: attempt.providerOrderId!, idempotencyKey: attempt.id });
      if (!captured.ok) {
        await deps.transactions.transitionCheckout({ id: attempt.id, from: ["capture_pending"], to: captured.error.retryable ? "reconciliation_required" : "failed", failureCode: captured.error.code, reconciliationStatus: captured.error.retryable ? "pending" : "not_required", now: now() });
        throw providerFailure(captured.error);
      }
      if (captured.value.status !== "COMPLETED" || !sameAmount(attempt, captured.value.amount)) {
        await deps.transactions.transitionCheckout({ id: attempt.id, from: ["capture_pending"], to: "reconciliation_required", providerTransactionId: captured.value.transactionId, failureCode: "capture_mismatch", reconciliationStatus: "mismatch", now: now() });
        throw new TransactionStateError("capture_mismatch", "Captured payment requires reconciliation");
      }
      const verification = await deps.provider.verifyPayment({ orderId: attempt.providerOrderId!, transactionId: captured.value.transactionId, expectedAmount: attempt.expectedAmount });
      if (!verification.ok || !verification.value.verified) {
        await deps.transactions.transitionCheckout({ id: attempt.id, from: ["capture_pending"], to: "reconciliation_required", providerTransactionId: captured.value.transactionId, failureCode: "verification_failed", reconciliationStatus: "mismatch", now: now() });
        throw new TransactionStateError("verification_failed", "Captured payment requires reconciliation");
      }
      attempt = await deps.transactions.transitionCheckout({ id: attempt.id, from: ["capture_pending"], to: "captured", providerTransactionId: captured.value.transactionId, reconciliationStatus: "matched", now: now() });
      try { await deps.offers.consumeOffer(attempt.offerId, now()); }
      catch {
        await deps.transactions.transitionCheckout({ id: attempt.id, from: ["captured"], to: "reconciliation_required", failureCode: "offer_consumption_failed", reconciliationStatus: "pending", now: now() });
        throw new TransactionStateError("reconciliation_required", "Payment completed but local reconciliation is required");
      }
      return { checkoutAttemptId: attempt.id, status: "captured" as const, verified: true };
    },
  };
}
