import { afterAll,describe,expect,it } from "vitest";
import { Pool } from "pg";
import { getProduct } from "../catalog";
import { FixturePriceProvider } from "../price-intelligence/fixture-provider";
import { PriceIntelligenceService,productVariantKey } from "../price-intelligence/service";
import { PostgresPriceIntelligenceRepository } from "./postgres-repository";
import { PostgresTransactionRepository } from "../payments/postgres-transaction-repository";
import { createApprovedCheckoutExecutor } from "../payments/approved-checkout";

const databaseUrl=process.env.TEST_DATABASE_URL;const suite=describe.skipIf(!databaseUrl);
suite("PostgreSQL transactions",()=>{
  const pool=new Pool({connectionString:databaseUrl,max:4});const repo=new PostgresPriceIntelligenceRepository(pool);afterAll(()=>pool.end());
  async function issued(){const product=getProduct("nord-sound-2")!;const session=crypto.randomUUID();const cart=[{productId:product.id,variantKey:productVariantKey(product),quantity:1}];const service=new PriceIntelligenceService(new FixturePriceProvider(),repo);const offer=(await service.compare({sessionId:session,productId:product.id,cart})).offer!;return{service,offer,session,cart};}
  it("rolls back failed ownership checks without an audit event",async()=>{const value=await issued();await expect(value.service.accept({offerId:value.offer.id,sessionId:crypto.randomUUID(),cart:value.cart})).rejects.toMatchObject({code:"unauthorized"});expect((await repo.getOffer(value.offer.id))?.status).toBe("issued");expect(await new PostgresTransactionRepository(pool).listAuditEvents(value.offer.id)).toEqual([]);});
  it("serializes concurrent acceptance with row locking",async()=>{const value=await issued();const results=await Promise.allSettled([value.service.accept({offerId:value.offer.id,sessionId:value.session,cart:value.cart}),value.service.accept({offerId:value.offer.id,sessionId:value.session,cart:value.cart})]);expect(results.filter((result)=>result.status==="fulfilled")).toHaveLength(1);expect((await repo.getOffer(value.offer.id))?.status).toBe("accepted");});
  it("atomically creates one checkout attempt and audit event across different idempotency keys",async()=>{const value=await issued();const accepted=(await value.service.accept({offerId:value.offer.id,sessionId:value.session,cart:value.cart})).offer;const transactions=new PostgresTransactionRepository(pool);const execute=createApprovedCheckoutExecutor({offers:repo,transactions});const run=()=>execute(accepted.id,{sessionId:value.session,cart:value.cart,idempotencyKey:crypto.randomUUID()});const results=await Promise.all([run(),run()]);expect(new Set(results.map((result)=>result.checkoutAttemptId)).size).toBe(1);expect((await transactions.listAuditEvents(accepted.id)).filter((event)=>event.eventType==="checkout.prepared")).toHaveLength(1);});
});
