export type ApprovalContext = { sessionId: string; buyerApprovalToken: string };
export type ApprovedCheckoutExecutor = (offerId: string, approvalContext: ApprovalContext) => Promise<{ transactionId: string; status: "verified" }>;

// Implemented by a future payment adapter. Amounts are intentionally absent: the adapter must load
// the accepted offer by opaque ID and use its server-validated finalTotal.
export async function executeApprovedCheckout(offerId: string, approvalContext: ApprovalContext): Promise<never> {
  void offerId; void approvalContext;
  throw new Error("Payment execution is not implemented in this PR");
}
