import type { CheckoutAttempt, CheckoutAttemptStatus, PaymentInstruction, TransactionAuditEvent } from "../types";

export type PrepareCheckoutInput = { offerId: string; merchantId: string; sessionId: string; cartFingerprint: string; expectedAmount: CheckoutAttempt["expectedAmount"]; idempotencyKey: string; expectedPolicyId: string; expectedPolicyVersion: number; instruction: PaymentInstruction; now: Date };
export interface TransactionRepository {
  prepareCheckout(input: PrepareCheckoutInput): Promise<{ attempt: CheckoutAttempt; instruction: PaymentInstruction; created: boolean }>;
  getCheckoutAttempt(id: string): Promise<CheckoutAttempt | undefined>;
  recordProviderCapture(input: { id: string; providerOrderId: string; providerTransactionId: string; now: Date }): Promise<CheckoutAttempt>;
  transitionCheckout(input: { id: string; from: CheckoutAttemptStatus[]; to: CheckoutAttemptStatus; providerOrderId?: string; providerTransactionId?: string; failureCode?: string; reconciliationStatus?: CheckoutAttempt["reconciliationStatus"]; now: Date }): Promise<CheckoutAttempt>;
  listAuditEvents(offerId: string): Promise<TransactionAuditEvent[]>;
}
export class TransactionStateError extends Error { constructor(public readonly code: string, message: string) { super(message); } }
const transitions: Record<CheckoutAttemptStatus, CheckoutAttemptStatus[]> = {
  prepared: ["order_pending", "failed"], order_pending: ["order_created", "failed", "reconciliation_required"], order_created: ["buyer_approved", "failed"], buyer_approved: ["capture_pending", "failed"],
  capture_pending: ["captured", "failed", "reconciliation_required"], captured: ["reconciliation_required", "reconciled"],
  failed: ["prepared"], reconciliation_required: ["capture_pending", "reconciled"], reconciled: [],
};
export const isCheckoutTransitionAllowed = (from: CheckoutAttemptStatus, to: CheckoutAttemptStatus) => transitions[from].includes(to);
