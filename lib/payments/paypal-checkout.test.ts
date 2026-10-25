import { describe, expect, it } from "vitest";
import { defaultPolicy } from "../demo-data";
import { MemoryTransactionRepository } from "./memory-transaction-repository";
import { MemoryPriceIntelligenceRepository } from "../persistence/memory-repository";
import { FixturePriceProvider } from "../price-intelligence/fixture-provider";
import { PriceIntelligenceService, productVariantKey } from "../price-intelligence/service";
import { getProduct } from "../catalog";
import { createApprovedCheckoutExecutor } from "./approved-checkout";
import { createPayPalCheckoutService } from "./paypal-checkout";
import type { PaymentProvider, ProviderResult } from "./provider";
import type { Money } from "../types";

class MockPayPal implements PaymentProvider {
  readonly provider = "paypal_sandbox" as const; captures = 0; status = "APPROVED"; captureFailure = false;
  constructor(readonly amount: Money) {}
  async createOrder() { return { ok: true, value: { orderId: "5O190127TN364715T", status: "CREATED" } } as const; }
  async getOrder() { return { ok: true, value: { orderId: "5O190127TN364715T", status: this.status, amount: this.amount } } as const; }
  async captureOrder(): Promise<ProviderResult<{ transactionId: string; status: string; amount: Money }>> { this.captures += 1; return this.captureFailure ? { ok: false, error: { code: "unavailable", retryable: true, message: "timeout" } } : { ok: true, value: { transactionId: "8MC585209K746392H", status: "COMPLETED", amount: this.amount } }; }
  async verifyPayment() { return { ok: true, value: { verified: true, status: "COMPLETED" } } as const; }
}

async function setup() {
  const offers = new MemoryPriceIntelligenceRepository(); await offers.savePolicy(defaultPolicy);
  const product = getProduct("nord-sound-2")!; const sessionId = crypto.randomUUID();
  const cart = [{ productId: product.id, variantKey: productVariantKey(product), quantity: 1 }];
  const intelligence = new PriceIntelligenceService(new FixturePriceProvider(), offers);
  const offer = (await intelligence.compare({ sessionId, productId: product.id, cart })).offer!;
  await intelligence.accept({ offerId: offer.id, sessionId, cart });
  const transactions = new MemoryTransactionRepository(offers);
  const prepared = await createApprovedCheckoutExecutor({ offers, transactions })(offer.id, { sessionId, cart, idempotencyKey: crypto.randomUUID() });
  const provider = new MockPayPal(offer.finalTotal); const service = createPayPalCheckoutService({ offers, transactions, provider });
  return { offers, transactions, provider, service, prepared, sessionId, offer };
}

describe("PayPal authorized checkout", () => {
  it("creates, verifies buyer approval, captures, independently verifies and consumes the offer", async () => {
    const value = await setup(); const created = await value.service.createOrder(value.prepared.checkoutAttemptId, value.sessionId);
    expect(created).toMatchObject({ orderId: "5O190127TN364715T", created: true });
    await expect(value.service.captureApprovedOrder(value.prepared.checkoutAttemptId, value.sessionId)).resolves.toMatchObject({ status: "captured", verified: true });
    expect(value.provider.captures).toBe(1); expect((await value.offers.getOffer(value.offer.id))?.status).toBe("consumed");
    expect((await value.transactions.listAuditEvents(value.offer.id)).map((event) => event.eventType)).toEqual(expect.arrayContaining(["checkout.order_pending", "checkout.order_created", "checkout.buyer_approved", "checkout.capture_pending", "checkout.captured"]));
  });

  it("does not capture an order without verified PayPal buyer approval", async () => {
    const value = await setup(); await value.service.createOrder(value.prepared.checkoutAttemptId, value.sessionId); value.provider.status = "CREATED";
    await expect(value.service.captureApprovedOrder(value.prepared.checkoutAttemptId, value.sessionId)).rejects.toMatchObject({ code: "approval_invalid" });
    expect(value.provider.captures).toBe(0);
  });

  it("prevents duplicate capture and makes a completed retry verification-only", async () => {
    const value = await setup(); await value.service.createOrder(value.prepared.checkoutAttemptId, value.sessionId);
    await value.service.captureApprovedOrder(value.prepared.checkoutAttemptId, value.sessionId);
    await expect(value.service.captureApprovedOrder(value.prepared.checkoutAttemptId, value.sessionId)).resolves.toMatchObject({ verified: true });
    expect(value.provider.captures).toBe(1);
  });

  it("allows only one concurrent request to claim capture", async () => {
    const value = await setup(); await value.service.createOrder(value.prepared.checkoutAttemptId, value.sessionId);
    const results = await Promise.allSettled([
      value.service.captureApprovedOrder(value.prepared.checkoutAttemptId, value.sessionId),
      value.service.captureApprovedOrder(value.prepared.checkoutAttemptId, value.sessionId),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(value.provider.captures).toBe(1);
  });

  it("moves ambiguous capture failures to reconciliation_required", async () => {
    const value = await setup(); await value.service.createOrder(value.prepared.checkoutAttemptId, value.sessionId); value.provider.captureFailure = true;
    await expect(value.service.captureApprovedOrder(value.prepared.checkoutAttemptId, value.sessionId)).rejects.toMatchObject({ code: "unavailable" });
    await expect(value.transactions.getCheckoutAttempt(value.prepared.checkoutAttemptId)).resolves.toMatchObject({ status: "reconciliation_required", reconciliationStatus: "pending" });
  });

  it("rejects session ownership violations before provider operations", async () => {
    const value = await setup();
    await expect(value.service.createOrder(value.prepared.checkoutAttemptId, crypto.randomUUID())).rejects.toMatchObject({ code: "unauthorized" });
    expect(value.provider.captures).toBe(0);
  });
});
