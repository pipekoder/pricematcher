import type { Money } from "../types";

export type ProviderError = { code: "authentication"|"validation"|"declined"|"conflict"|"unavailable"|"unknown"; retryable: boolean; message: string };
export type ProviderResult<T> = { ok: true; value: T } | { ok: false; error: ProviderError };
export interface PaymentProvider {
  readonly provider: "paypal_sandbox";
  createOrder(input: { checkoutAttemptId: string; idempotencyKey: string; amount: Money; intent: "CAPTURE" }): Promise<ProviderResult<{ orderId: string; status: string }>>;
  getOrder(orderId: string): Promise<ProviderResult<{ orderId: string; status: string; amount: Money }>>;
  captureOrder(input: { orderId: string; idempotencyKey: string }): Promise<ProviderResult<{ transactionId: string; status: string; amount: Money }>>;
  verifyPayment(input: { orderId: string; transactionId?: string; expectedAmount: Money }): Promise<ProviderResult<{ verified: boolean; status: string }>>;
}

// PayPal mappings: Agent Toolkit create_order/get_order/pay_order map to the first
// three operations. JS SDK v6 supplies buyer approval; Orders API v2 is the fallback.
// Implementations stay server-only and always receive the persisted instruction amount.
