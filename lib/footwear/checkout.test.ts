import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getProduct } from "../catalog";
import { buildCartSnapshot, cartFingerprint, productVariantKey } from "../price-intelligence/service";
import { skuKey, virtualSkus } from "./operations";
import { cartCount, validateCartItems } from "../cart-state";
import { DemoOfferService } from "../price-intelligence/demo-offers";
import { MemoryPriceIntelligenceRepository } from "../persistence/memory-repository";
import { MemoryTransactionRepository } from "../payments/memory-transaction-repository";
import { createApprovedCheckoutExecutor } from "../payments/approved-checkout";
import { PriceIntelligenceService } from "../price-intelligence/service";
import { FixturePriceProvider } from "../price-intelligence/fixture-provider";

const available = virtualSkus.filter((sku) => sku.stock >= 2);
const selected = available[0];
const alternate = available.find((sku) => sku.productId === selected.productId && sku.size !== selected.size)!;
const product = getProduct(selected.productId)!;
const line = (size: number, quantity = 1) => ({ productId: product.id, variantKey: productVariantKey(product, size), quantity });
let previous: string | undefined;
beforeEach(() => { previous = process.env.PRICEMATCHER_DEMO_ASSUMPTIONS; process.env.PRICEMATCHER_DEMO_ASSUMPTIONS = "1"; });
afterEach(() => { if (previous === undefined) delete process.env.PRICEMATCHER_DEMO_ASSUMPTIONS; else process.env.PRICEMATCHER_DEMO_ASSUMPTIONS = previous; });

describe("SKU-bound authoritative cart", () => {
  it("preserves distinct sizes and a matching bag badge", () => {
    const first = skuKey(product.id, selected.size), second = skuKey(product.id, alternate.size);
    const stored = validateCartItems({ version: 2, items: { [first]: 2, [second]: 1, [product.id]: 3 } });
    expect(cartCount(stored)).toBe(3);
    expect(Object.keys(stored)).toEqual([first, second]);
    expect(buildCartSnapshot([line(selected.size, 2), line(alternate.size)]) .lines).toHaveLength(2);
  });
  it("rejects sold-out sizes, SKU substitution, and quantities above stock", () => {
    const soldOut = virtualSkus.find((sku) => sku.productId === product.id && sku.stock === 0)!;
    expect(() => buildCartSnapshot([line(soldOut.size)])).toThrow();
    expect(() => buildCartSnapshot([line(selected.size, selected.stock + 1)])).toThrow();
    expect(() => buildCartSnapshot([{ ...line(selected.size), variantKey: productVariantKey(product, 36) }])).toThrow();
  });
  it("binds size and quantity into the offer fingerprint and uses server prices", () => {
    const session = "same-session";
    const original = buildCartSnapshot([line(selected.size)]);
    expect(original.lines[0].unitPrice).toEqual(product.price);
    expect(cartFingerprint(session, original)).not.toBe(cartFingerprint(session, buildCartSnapshot([line(alternate.size)])));
    expect(cartFingerprint(session, original)).not.toBe(cartFingerprint(session, buildCartSnapshot([line(selected.size, 2)])));
  });
  it("authorizes a two-size demo offer and rejects substitution at checkout", async () => {
    const repo = new MemoryPriceIntelligenceRepository();
    const cart = [line(selected.size, 2), line(alternate.size)];
    const sessionId = "sku-session";
    const service = new DemoOfferService(repo);
    const issued = (await service.compare({ sessionId, cart, scenario: "MATCH_LOWEST" })).offer;
    const accepted = (await service.accept({ offerId: issued.id, sessionId, cart })).offer;
    const checkout = createApprovedCheckoutExecutor({ offers: repo, transactions: new MemoryTransactionRepository(repo) });
    const prepared = await checkout(accepted.id, { sessionId, cart, idempotencyKey: crypto.randomUUID() });
    expect(prepared.instruction.amount).toEqual(accepted.finalTotal);
    await expect(checkout(accepted.id, { sessionId, cart: [line(alternate.size, 2), line(selected.size)], idempotencyKey: crypto.randomUUID() })).rejects.toMatchObject({ code: "cart_changed" });
    await expect(checkout(accepted.id, { sessionId: "other", cart, idempotencyKey: crypto.randomUUID() })).rejects.toMatchObject({ code: "unauthorized" });
  });
  it("keeps original-price authorization separate from demo discounts", async () => {
    const repo = new MemoryPriceIntelligenceRepository();
    const cart = [line(selected.size), line(alternate.size)];
    const sessionId = "original-sku-session";
    const original = (await new PriceIntelligenceService(new FixturePriceProvider(), repo).authorizeOriginalCart({ sessionId, cart })).offer;
    expect(original.discountAmount.amountMinor).toBe(0);
    const checkout = createApprovedCheckoutExecutor({ offers: repo, transactions: new MemoryTransactionRepository(repo) });
    const prepared = await checkout(original.id, { sessionId, cart, idempotencyKey: crypto.randomUUID() });
    expect(prepared.instruction.amount).toEqual(buildCartSnapshot(cart).total);
    repo.offers.get(original.id)!.finalTotal.amountMinor--;
    await expect(checkout(original.id, { sessionId, cart, idempotencyKey: crypto.randomUUID() })).rejects.toMatchObject({ code: "amount_changed" });
  });
});
