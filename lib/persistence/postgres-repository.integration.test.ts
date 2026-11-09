import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { getProduct } from "../catalog";
import { acceptedOfferSummary } from "../checkout-summary";
import { defaultPolicy } from "../demo-data";
import { createApprovedCheckoutExecutor } from "../payments/approved-checkout";
import { PostgresTransactionRepository } from "../payments/postgres-transaction-repository";
import { FixturePriceProvider } from "../price-intelligence/fixture-provider";
import { PriceIntelligenceService, productVariantKey } from "../price-intelligence/service";
import { PostgresPriceIntelligenceRepository } from "./postgres-repository";
import { AiOfferService } from "../ai-offers/service";
import type { AgentFacts } from "../ai-offers/policy";
import type { AgentModel } from "../ai-offers/model";
import { virtualSkus } from "../footwear/operations";
import { reserveChannel3Lookup, type Channel3MarketOffer, type MarketSearch } from "../price-intelligence/channel3-market";

const databaseUrl = process.env.TEST_DATABASE_URL;
const suite = describe.skipIf(!databaseUrl);

suite("PostgreSQL transactions", () => {
  const pool = new Pool({ connectionString: databaseUrl, max: 6 });
  const repo = new PostgresPriceIntelligenceRepository(pool);

  beforeEach(async () => {
    await pool.query(
      "truncate channel3_live_lookup_batches, channel3_live_daily_budget, transaction_audit_events, checkout_attempts, offer_acceptances, authorized_offers, competitor_evidence, comparison_requests, merchant_pricing_policies cascade",
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

  it("accepts an AI offer after PostgreSQL JSONB persistence and prepares its server-authorized total", async () => {
    const previous = { enabled: process.env.AI_OFFER_AGENT_ENABLED, assumptions: process.env.PRICEMATCHER_DEMO_ASSUMPTIONS, paypal: process.env.PAYPAL_ENVIRONMENT };
    process.env.AI_OFFER_AGENT_ENABLED = "1";
    process.env.PRICEMATCHER_DEMO_ASSUMPTIONS = "1";
    process.env.PAYPAL_ENVIRONMENT = "SANDBOX";
    try {
      const sku = virtualSkus.find((item) => item.stock > 0)!;
      const product = getProduct(sku.productId)!;
      const cart = [{ productId: product.id, variantKey: productVariantKey(product, sku.size), quantity: 1 }];
      const sessionId = crypto.randomUUID();
      const model: AgentModel = { run: async (kind, input) => {
        const items = (input as { items: Array<AgentFacts | { fact: AgentFacts }> }).items.map((item) => "fact" in item ? item.fact : item);
        if (kind === "inventory-sales") return { items: items.map((fact) => ({ key: fact.key, classification: "healthy", demandTrend: "steady", aggressiveness: "conservative", minSuggestedMinor: fact.costMinor, maxSuggestedMinor: fact.originalUnitMinor, reasons: "Mock", riskFlags: [] })) };
        return { items: items.map((fact) => ({ key: fact.key, productId: fact.productId, sku: fact.sku, decision: "KEEP_ORIGINAL", proposedUnitMinor: fact.originalUnitMinor, reference: null, reason: "Mock", limitations: "Mock" })), consolidatedSubtotalMinor: items.reduce((sum, fact) => sum + fact.originalUnitMinor * fact.quantity, 0) };
      } };
      const service = new AiOfferService(repo, model);
      const offer = (await service.compare({ sessionId, cart })).offer!;
      expect(offer).toBeDefined();
      const saved = (await repo.getOffer(offer.id))!;
      expect(saved.aiAuthorization?.policyConfig).toEqual(offer.aiAuthorization?.policyConfig);
      expect(JSON.stringify(saved.aiAuthorization?.policyConfig)).not.toBe(JSON.stringify(offer.aiAuthorization?.policyConfig));
      const accepted = (await service.accept({ offerId: offer.id, sessionId, cart })).offer;
      expect(accepted.status).toBe("accepted");
      expect(acceptedOfferSummary({ offerId: accepted.id, originalSubtotal: accepted.cartSnapshot.subtotal, shipping: accepted.cartSnapshot.shipping, tax: accepted.cartSnapshot.tax, fees: accepted.cartSnapshot.fees, totalToPay: accepted.finalTotal, expiresAt: accepted.expiresAt }).totalToPay).toEqual(accepted.finalTotal);
      const result = await createApprovedCheckoutExecutor({ offers: repo, transactions: new PostgresTransactionRepository(pool) })(offer.id, { sessionId, cart, idempotencyKey: crypto.randomUUID() });
      expect(result.instruction.amount).toEqual(accepted.finalTotal);
    } finally {
      for (const [key, value] of Object.entries({ AI_OFFER_AGENT_ENABLED: previous.enabled, PRICEMATCHER_DEMO_ASSUMPTIONS: previous.assumptions, PAYPAL_ENVIRONMENT: previous.paypal })) {
        if (value === undefined) delete process.env[key]; else process.env[key] = value;
      }
    }
  });

  it("preserves a Channel3 observation through JSONB reload and authorizes its exact server total",async()=>{
    const previous={enabled:process.env.AI_OFFER_AGENT_ENABLED,assumptions:process.env.PRICEMATCHER_DEMO_ASSUMPTIONS,paypal:process.env.PAYPAL_ENVIRONMENT};
    process.env.AI_OFFER_AGENT_ENABLED="1";process.env.PRICEMATCHER_DEMO_ASSUMPTIONS="1";process.env.PAYPAL_ENVIRONMENT="SANDBOX";
    try{
      const sku=virtualSkus.find(item=>item.stock>0)!,product=getProduct(sku.productId)!;
      const cart=[{productId:product.id,variantKey:productVariantKey(product,sku.size),quantity:1}],sessionId=crypto.randomUUID(),batchId=crypto.randomUUID(),retrievedAt=new Date().toISOString();
      const observed:Channel3MarketOffer={id:"channel3-test-offer",provider:"channel3",searchBatchId:batchId,retrievedAt,merchantName:"Example Shoes",title:product.name,productUrl:"https://example.com/shoes",channel3ProductId:"channel3-id",priceMinor:product.price.amountMinor-1000,currency:"USD",brand:product.brand,model:product.model,size:`EU${sku.size}`,color:null,condition:null,availability:"unknown",shippingDescription:null,shippingMinor:null,mandatoryFeesMinor:null,matchStatus:"exact_variant",matchConfidence:"high",evidenceStatus:"observed_product_offer"};
      const market:MarketSearch={search:async()=>({batchId,retrievedAt,productId:product.id,variantKey:cart[0].variantKey,offers:[observed],status:"success"})};
      const model:AgentModel={run:async(kind,input)=>{const facts=(input as {items:Array<AgentFacts|{fact:AgentFacts}>}).items.map(item=>"fact" in item?item.fact:item);if(kind==="inventory-sales")return{items:facts.map(fact=>({key:fact.key,classification:"healthy",demandTrend:"steady",aggressiveness:"moderate",minSuggestedMinor:fact.costMinor,maxSuggestedMinor:fact.originalUnitMinor,reasons:"Mock",riskFlags:[]}))};return{items:facts.map(fact=>({key:fact.key,productId:fact.productId,sku:fact.sku,decision:"MATCH_LOWEST",proposedUnitMinor:observed.priceMinor,reference:observed.id,reason:"Mock",limitations:"Advertised price only"})),consolidatedSubtotalMinor:observed.priceMinor};}};
      const service=new AiOfferService(repo,model,undefined,market);const issued=(await service.compare({sessionId,cart})).offer!;
      expect((await repo.getOffer(issued.id))?.aiAuthorization?.channel3Market?.offers[0].priceMinor).toBe(observed.priceMinor);
      const accepted=(await service.accept({offerId:issued.id,sessionId,cart})).offer;
      const result=await createApprovedCheckoutExecutor({offers:repo,transactions:new PostgresTransactionRepository(pool)})(accepted.id,{sessionId,cart,idempotencyKey:crypto.randomUUID()});
      expect(result.instruction.amount).toEqual(accepted.finalTotal);
    }finally{for(const [key,value] of Object.entries({AI_OFFER_AGENT_ENABLED:previous.enabled,PRICEMATCHER_DEMO_ASSUMPTIONS:previous.assumptions,PAYPAL_ENVIRONMENT:previous.paypal})){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
  });

  it("atomically limits shared Channel3 searches and rejects rapid duplicate session/SKU requests",async()=>{
    const sku=virtualSkus.find(item=>item.stock>0)!,product=getProduct(sku.productId)!,variantKey=productVariantKey(product,sku.size);
    const input={product,variantKey,size:sku.size,sessionId:crypto.randomUUID()};
    const old=process.env.CHANNEL3_EXACT_MAX_REQUESTS_PER_DAY;process.env.CHANNEL3_EXACT_MAX_REQUESTS_PER_DAY="1";
    try{
      const results=await Promise.allSettled([reserveChannel3Lookup(pool,crypto.randomUUID(),input),reserveChannel3Lookup(pool,crypto.randomUUID(),{...input,sessionId:crypto.randomUUID()})]);
      expect(results.filter(result=>result.status==="fulfilled")).toHaveLength(1);
      const budget=await pool.query("select request_count from channel3_live_daily_budget where day=current_date");expect(budget.rows[0].request_count).toBe(1);
      const batches=await pool.query("select session_id from channel3_live_lookup_batches");expect(batches.rowCount).toBe(1);
      const sameSession={...input,sessionId:batches.rows[0].session_id};
      await expect(reserveChannel3Lookup(pool,crypto.randomUUID(),sameSession)).rejects.toMatchObject({category:"duplicate"});
    }finally{if(old===undefined)delete process.env.CHANNEL3_EXACT_MAX_REQUESTS_PER_DAY;else process.env.CHANNEL3_EXACT_MAX_REQUESTS_PER_DAY=old;}
  });

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

  it("durably records only one PayPal capture identity under concurrency", async () => {
    const value = await issued();
    const accepted = (await value.service.accept({ offerId: value.offer.id, sessionId: value.session, cart: value.cart })).offer;
    const transactions = new PostgresTransactionRepository(pool);
    const prepared = await createApprovedCheckoutExecutor({ offers: repo, transactions })(accepted.id, { sessionId: value.session, cart: value.cart, idempotencyKey: crypto.randomUUID() });
    await transactions.transitionCheckout({ id: prepared.checkoutAttemptId, from: ["prepared"], to: "order_pending", now: new Date() });
    await transactions.transitionCheckout({ id: prepared.checkoutAttemptId, from: ["order_pending"], to: "order_created", providerOrderId: "5O190127TN364715T", now: new Date() });
    await transactions.transitionCheckout({ id: prepared.checkoutAttemptId, from: ["order_created"], to: "buyer_approved", now: new Date() });
    await transactions.transitionCheckout({ id: prepared.checkoutAttemptId, from: ["buyer_approved"], to: "capture_pending", now: new Date() });
    const results = await Promise.allSettled([
      transactions.recordProviderCapture({ id: prepared.checkoutAttemptId, providerOrderId: "5O190127TN364715T", providerTransactionId: "8MC585209K746392H", now: new Date() }),
      transactions.recordProviderCapture({ id: prepared.checkoutAttemptId, providerOrderId: "5O190127TN364715T", providerTransactionId: "different-capture", now: new Date() }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(["8MC585209K746392H", "different-capture"]).toContain((await transactions.getCheckoutAttempt(prepared.checkoutAttemptId))?.providerTransactionId);
    expect((await transactions.listAuditEvents(accepted.id)).filter((event) => event.eventType === "checkout.provider_capture_observed")).toHaveLength(1);
  });
});
