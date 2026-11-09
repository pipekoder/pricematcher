import { getProduct } from "../catalog";
import { productOperations, simulatedInventoryMovements, simulatedPriceHistory, simulatedTransactions, virtualSkus } from "../footwear/operations";
import { demoPolicy, marketSnapshot, type DemoDecision } from "../price-intelligence/demo-offers";
import { OfferValidationError } from "../persistence/repository";
import type { CartSnapshot } from "../types";
import { compareChannel3Offers, eligibleChannel3Offer, type Channel3SearchResult } from "../price-intelligence/channel3-market";

export type InventoryClass = "overstock_no_sales" | "low_stock_active" | "normal";
export type AgentFacts = ReturnType<typeof factsForCart>[number];
export type InventoryPolicy = { version: number; overstockMarkupBps: 500 | 1000; activeSalesDays: number; maximumDiscountBps: number };
const inventoryPolicyKeys = ["version", "overstockMarkupBps", "activeSalesDays", "maximumDiscountBps"] as const;
export function sameInventoryPolicy(current: InventoryPolicy, saved: unknown): boolean {
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) return false;
  const record = saved as Record<string, unknown>;
  return Object.keys(record).length === inventoryPolicyKeys.length
    && inventoryPolicyKeys.every((key) => Object.hasOwn(record, key) && record[key] === current[key]);
}
export function inventoryPolicy(env: Record<string,string|undefined> = process.env): InventoryPolicy {
  const markup = Number(env.AI_OVERSTOCK_MARKUP_BPS ?? 500);
  const activeDays = Number(env.AI_ACTIVE_SALES_DAYS ?? 3);
  if ((markup !== 500 && markup !== 1000) || !Number.isSafeInteger(activeDays) || activeDays < 1 || activeDays > 30) throw new Error("Invalid merchant inventory policy configuration");
  return { version: 1, overstockMarkupBps: markup, activeSalesDays: activeDays, maximumDiscountBps: demoPolicy.maximumDiscountBps };
}
const selling = (productId: string, days: number) => simulatedTransactions.filter(item => item.productId === productId && item.kind === "sale" && item.day <= days);
export function factsForCart(snapshot: CartSnapshot, policy = inventoryPolicy(), channel3?:Channel3SearchResult) {
  return snapshot.lines.map(line => {
    const product = getProduct(line.productId);
    const sku = virtualSkus.find(item => item.productId === line.productId && line.variantKey.includes(`:EU${item.size}:`));
    if (!product?.id.startsWith("footwear-") || !sku || sku.stock < line.quantity) throw new OfferValidationError("invalid_cart", "Footwear SKU unavailable");
    const operations = productOperations(product.id);
    const recent = selling(product.id,30);
    const sales = { last7: selling(product.id,7).length, last30: recent.length, last60: selling(product.id,60).length, distinctDays30: new Set(recent.map(item=>item.day)).size };
    const classification: InventoryClass = operations.stock > 50 && sales.last30 === 0 ? "overstock_no_sales" : operations.stock < 10 && sales.distinctDays30 >= policy.activeSalesDays ? "low_stock_active" : "normal";
    const history = simulatedPriceHistory.filter(item=>item.productId===product.id).sort((a,b)=>a.dayAgo-b.dayAgo);
    const market = marketSnapshot(product.id);
    const candidate=channel3?.productId===product.id&&channel3.variantKey===line.variantKey?channel3.offers.filter(eligibleChannel3Offer).sort(compareChannel3Offers)[0]:undefined;
    return { key: `${line.productId}|${line.variantKey}`, productId: product.id, sku: sku.sku, size: sku.size, quantity: line.quantity, brand: product.brand, originalUnitMinor: product.price.amountMinor, currency: "USD" as const, costMinor: sku.unitCostMinor, skuStock: sku.stock, productStock: operations.stock, sales, daysSinceLastSale: operations.daysSinceLastSale, turnover: operations.turnover, returns60: simulatedTransactions.filter(item=>item.productId===product.id&&item.kind==="return").length, priceTrend: history.map(item=>({dayAgo:item.dayAgo,priceMinor:item.priceMinor})), inventoryMovement90: simulatedInventoryMovements.filter(item=>item.sku===sku.sku).reduce((sum,item)=>sum+item.units,0), inventoryTrend:{net7:simulatedInventoryMovements.filter(item=>item.sku===sku.sku&&item.dayAgo<=7).reduce((sum,item)=>sum+item.units,0),net30:simulatedInventoryMovements.filter(item=>item.sku===sku.sku&&item.dayAgo<=30).reduce((sum,item)=>sum+item.units,0),current:sku.stock}, classification, market: channel3?{lowestNewMinor:candidate?.priceMinor??null,reference:candidate?.id??null,retrievedAt:channel3.retrievedAt,shippingKnown:false,feesKnown:false,variantVerified:candidate?.matchStatus==="exact_variant",source:"channel3_live" as const}:{lowestNewMinor:market?.lowestNew??null, reference:market?.lowestNewOffer?.productId??null, retrievedAt:market?.retrievedAt??null, shippingKnown:false, feesKnown:false, variantVerified:false, source:"saved_channel3_snapshot" as const}, policy: {overstockMarkupBps:policy.overstockMarkupBps,activeSalesDays:policy.activeSalesDays,maximumDiscountBps:policy.maximumDiscountBps} };
  });
}
export function policyFloor(fact:AgentFacts,policy=inventoryPolicy()) {
  const normal=Math.max(fact.costMinor,Math.ceil(fact.originalUnitMinor*(10000-policy.maximumDiscountBps)/10000),demoPolicy.minimumPriceByProduct[fact.productId]??0);
  if(fact.classification==="overstock_no_sales")return Math.max(fact.costMinor,Math.ceil(fact.costMinor*(10000+policy.overstockMarkupBps)/10000));
  if(fact.classification==="low_stock_active")return Math.max(fact.costMinor,Math.ceil(fact.originalUnitMinor*.85));
  return normal;
}
export type AiDecision = {key:string;productId:string;sku:string;decision:DemoDecision;proposedUnitMinor:number;reference:string|null;reason:string;limitations:string};
export function validateAiDecision(fact:AgentFacts, decision:AiDecision, policy=inventoryPolicy()) {
  if(decision.key!==fact.key||decision.productId!==fact.productId||decision.sku!==fact.sku||!Number.isSafeInteger(decision.proposedUnitMinor)||decision.proposedUnitMinor<policyFloor(fact,policy)||decision.proposedUnitMinor>fact.originalUnitMinor)return "merchant_price_floor";
  if(!Number.isSafeInteger(fact.quantity)||fact.quantity<1||fact.quantity>fact.skuStock||fact.currency!=="USD")return "sku_unavailable";
  if(decision.decision==="KEEP_ORIGINAL")return decision.proposedUnitMinor===fact.originalUnitMinor&&decision.reference===null?null:"invalid_original_choice";
  if(!fact.market.reference||fact.market.lowestNewMinor===null||decision.reference!==fact.market.reference)return "market_reference_mismatch";
  if(decision.decision==="MATCH_LOWEST")return decision.proposedUnitMinor===Math.min(fact.originalUnitMinor,fact.market.lowestNewMinor)?null:"invalid_match_price";
  if(decision.decision==="PARTIAL_MATCH")return fact.market.lowestNewMinor<decision.proposedUnitMinor&&decision.proposedUnitMinor<fact.originalUnitMinor?null:"invalid_partial_price";
  return "invalid_decision";
}
