import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { getProduct } from "../catalog";
import { defaultPolicy } from "../demo-data";
import { createApprovedCheckoutExecutor } from "../payments/approved-checkout";
import { PostgresTransactionRepository } from "../payments/postgres-transaction-repository";
import { FixturePriceProvider } from "../price-intelligence/fixture-provider";
import { PriceIntelligenceService, productVariantKey } from "../price-intelligence/service";
import { PostgresPriceIntelligenceRepository } from "./postgres-repository";

const databaseUrl = process.env.TEST_DATABASE_URL;
const suite = describe.skipIf(!databaseUrl);

suite("PostgreSQL transactions", () => {
  const pool = new Pool({ connectionString: databaseUrl, max: 6 });
  const repo = new PostgresPriceIntelligenceRepository(pool);

  beforeEach(async () => {
    await pool.query(
      "truncate transaction_audit_events, checkout_attempts, offer_acceptances, authorized_offers, competitor_evidence, comparison_requests, merchant_pricing_policies cascade",
    );
  });
  afterAll(() => pool.end());

  async function issued() {
    const product = getProduct("nord-sound-2")!;
    const session = crypto.randomUUID();
    const cart = [{ productId: product.id, variantKey: productVariantKey(product), quantity: 1 }];
    const service = new PriceIntelligenceService(new FixturePriceProvider(), repo);
    const offer = (await service.compare({ sessionId: session, productId: product.id, cart })).offer!;
    return { service, offer, session, cart };
  }

  async function waitForAdvisoryWaiters(count: number) {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const result = await pool.query<{ count: string }>(
        "select count(*)::text as count from pg_locks where locktype='advisory' and not granted",
      );
      if (Number(result.rows[0]?.count) >= count) return;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error(`Timed out waiting for ${count} advisory lock waiter(s)`);
  }

  it("rolls back failed ownership checks without an audit event", async () => {
    const value = await issued();
    await expect(
      value.service.accept({ offerId: value.offer.id, sessionId: crypto.randomUUID(), cart: value.cart }),
    ).rejects.toMatchObject({ code: "unauthorized" });
    expect((await repo.getOffer(value.offer.id))?.status).toBe("issued");
    expect(await new PostgresTransactionRepository(pool).listAuditEvents(value.offer.id)).toEqual([]);
  });

  it("serializes concurrent acceptance with row locking", async () => {
    const value = await issued();
    const results = await Promise.allSettled([
      value.service.accept({ offerId: value.offer.id, sessionId: value.session, cart: value.cart }),
      value.service.accept({ offerId: value.offer.id, sessionId: value.session, cart: value.cart }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect((await repo.getOffer(value.offer.id))?.status).toBe("accepted");
  });

  it("atomically creates one checkout attempt and audit event across different idempotency keys", async () => {
    const value = await issued();
    const accepted = (await value.service.accept({ offerId: value.offer.id, sessionId: value.session, cart: value.cart })).offer;
    const transactions = new PostgresTransactionRepository(pool);
    const execute = createApprovedCheckoutExecutor({ offers: repo, transactions });
    const run = () => execute(accepted.id, {
      sessionId: value.session,
      cart: value.cart,
      idempotencyKey: crypto.randomUUID(),
    });
    const results = await Promise.all([run(), run()]);
    expect(new Set(results.map((result) => result.checkoutAttemptId)).size).toBe(1);
    expect((await transactions.listAuditEvents(accepted.id)).filter((event) => event.eventType === "checkout.prepared")).toHaveLength(1);
  });

  it("serializes a concurrent merchant-policy update before checkout preparation", async () => {
    const value = await issued();
    const accepted = (await value.service.accept({ offerId: value.offer.id, sessionId: value.session, cart: value.cart })).offer;
    const transactions = new PostgresTransactionRepository(pool);
    const execute = createApprovedCheckoutExecutor({ offers: repo, transactions });
    const blocker = await pool.connect();
    let blockerOpen = true;

    try {
      await blocker.query("begin");
      await blocker.query("select pg_advisory_xact_lock(hashtextextended($1,0))", [accepted.merchantId]);

      const policyUpdate = repo.savePolicy({
        ...defaultPolicy,
        id: "policy-north-01-v2",
        version: 2,
        createdAt: new Date().toISOString(),
      });
      await waitForAdvisoryWaiters(1);

      const preparation = execute(accepted.id, {
        sessionId: value.session,
        cart: value.cart,
        idempotencyKey: crypto.randomUUID(),
      }).then(
        () => ({ status: "fulfilled" as const }),
        (error: unknown) => ({ status: "rejected" as const, error }),
      );
      await waitForAdvisoryWaiters(2);

      await blocker.query("commit");
      blockerOpen = false;
      await policyUpdate;

      await expect(preparation).resolves.toMatchObject({
        status: "rejected",
        error: { code: "policy_changed" },
      });
      const attempts = await pool.query("select id from checkout_attempts where offer_id=$1", [accepted.id]);
      expect(attempts.rowCount).toBe(0);
      expect((await transactions.listAuditEvents(accepted.id)).filter((event) => event.eventType === "checkout.prepared")).toHaveLength(0);
    } finally {
      if (blockerOpen) await blocker.query("rollback");
      blocker.release();
    }
  });
});
