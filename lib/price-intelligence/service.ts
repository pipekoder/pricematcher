import { createHash, randomUUID } from "node:crypto";
import { getProduct } from "../catalog";
import { defaultPolicy } from "../demo-data";
import { addMoney, money, multiplyMoney, subtractMoney } from "../money";
import { evaluatePricing, type PricingClock, systemClock } from "../pricing";
import type { AuthorizedLineAdjustment, AuthorizedOffer, CartComparisonResult, CartItemInput, CartSnapshot, ComparisonRequest, CompetitorEvidence, ComparisonResult, MerchantPolicy, PolicyOutcome } from "../types";
import { OfferValidationError, type PriceIntelligenceRepository } from "../persistence/repository";
import { verifyEquivalence, unavailableAiEvaluator, type AiEquivalenceEvaluator } from "./equivalence";
import type { PriceIntelligenceProvider } from "./provider";

export const DEMO_MERCHANT_ID = "north-01";
export const productVariantKey = (product: NonNullable<ReturnType<typeof getProduct>>) => `${product.sku}:${product.variant.color}:${product.variant.size ?? ""}:${product.variant.condition}`;

export function buildCartSnapshot(items: CartItemInput[]): CartSnapshot {
  if (!items.length) throw new OfferValidationError("invalid_cart", "Cart cannot be empty");
  const merged = new Map<string, CartItemInput>();
  for (const item of items) {
    if (!Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 9) throw new OfferValidationError("invalid_cart", "Invalid quantity");
    const product = getProduct(item.productId);
    if (!product || item.variantKey !== productVariantKey(product)) throw new OfferValidationError("invalid_cart", "Unknown product or variant");
    if (merged.has(item.productId)) throw new OfferValidationError("invalid_cart", "Duplicate cart line");
    merged.set(item.productId, item);
  }
  const lines = [...merged.values()].sort((a, b) => a.productId.localeCompare(b.productId)).map((item) => {
    const product = getProduct(item.productId)!;
    return { ...item, unitPrice: { ...product.price }, lineTotal: multiplyMoney(product.price, item.quantity) };
  });
  const subtotal = addMoney(...lines.map((line) => line.lineTotal));
  const shipping = money(subtotal.amountMinor >= 7500 ? 0 : 590, "USD");
  const tax = money(0, "USD"); const fees = money(0, "USD");
  return { lines, currency: "USD", subtotal, shipping, tax, fees, total: addMoney(subtotal, shipping, tax, fees) };
}

export function cartFingerprint(sessionId: string, snapshot: CartSnapshot) {
  const canonical = JSON.stringify({ sessionId, currency: snapshot.currency, lines: snapshot.lines.map(({ productId, variantKey, quantity, unitPrice, lineTotal }) => ({ productId, variantKey, quantity, unitPrice, lineTotal })), shipping: snapshot.shipping, tax: snapshot.tax, fees: snapshot.fees, total: snapshot.total });
  return createHash("sha256").update(canonical).digest("hex");
}

function evidenceIsFresh(evidence: CompetitorEvidence, policy: MerchantPolicy, now: Date) {
  const retrieved = new Date(evidence.retrievedAt).getTime();
  const delivered = evidence.deliveredCostRetrievedAt ? new Date(evidence.deliveredCostRetrievedAt).getTime() : Number.NaN;
  return Number.isFinite(retrieved) && retrieved <= now.getTime() && now.getTime() - retrieved <= policy.evidenceMaxAgeSeconds * 1000 && Number.isFinite(delivered) && delivered <= now.getTime() && now.getTime() - delivered <= policy.evidenceMaxAgeSeconds * 1000;
}

export class PriceIntelligenceService {
  constructor(private provider: PriceIntelligenceProvider, private repo: PriceIntelligenceRepository, private ai: AiEquivalenceEvaluator = unavailableAiEvaluator, private clock: PricingClock = systemClock) {}
  async compare(input: { sessionId: string; productId: string; cart: CartItemInput[] }): Promise<ComparisonResult> {
    const product = getProduct(input.productId); if (!product) throw new Error("Unknown product");
    const snapshot = buildCartSnapshot(input.cart); const target = snapshot.lines.find((line) => line.productId === product.id); if (!target) throw new OfferValidationError("invalid_cart", "Compared product is not in the cart");
    const now = this.clock.now(); const comparison: ComparisonRequest = { id: randomUUID(), merchantId: DEMO_MERCHANT_ID, sessionId: input.sessionId, productId: product.id, quantity: target.quantity, cartFingerprint: cartFingerprint(input.sessionId, snapshot), status: "requested", sourceType: this.provider.sourceType, createdAt: now.toISOString() };
    await this.repo.saveComparison(comparison);
    const discovered = await this.provider.search(product);
    let policy = await this.repo.getPolicy(DEMO_MERCHANT_ID); if (!policy) { policy = defaultPolicy; await this.repo.savePolicy(policy); }
    const evidence: CompetitorEvidence[] = [];
    for (const item of discovered) { const verification = await verifyEquivalence(product, item, this.ai); evidence.push({ id: randomUUID(), comparisonId: comparison.id, ...item, variant: { color: item.color, size: item.size, condition: item.condition }, sellerVerification: policy.approvedCompetitorDomains.includes(item.retailerDomain) ? "approved" : "unverified", productMatch: verification.match, aiAssisted: verification.aiAssisted, verificationReasons: verification.reasons }); }
    await this.repo.saveEvidence(evidence);
    const evaluatedAt = this.clock.now(); const freshEvidence = evidence.filter((item) => evidenceIsFresh(item, policy, evaluatedAt)); const decision = evaluatePricing(product, freshEvidence, policy);
    let offer: AuthorizedOffer | undefined;
    if (decision.eligible && decision.evidenceId) {
      const selected = freshEvidence.find((item) => item.id === decision.evidenceId)!; const originalSubtotal = multiplyMoney(product.price, target.quantity); const approvedSubtotal = multiplyMoney(decision.approvedUnitPrice, target.quantity); const discountAmount = subtractMoney(originalSubtotal, approvedSubtotal); const finalTotal = subtractMoney(snapshot.total, discountAmount);
      offer = { id: randomUUID(), comparisonId: comparison.id, merchantId: DEMO_MERCHANT_ID, sessionId: input.sessionId, productId: product.id, productGtin: product.gtin, variantKey: target.variantKey, quantity: target.quantity, cartFingerprint: comparison.cartFingerprint, originalUnitPrice: { ...product.price }, approvedUnitPrice: { ...decision.approvedUnitPrice }, originalSubtotal, approvedSubtotal, tax: { ...snapshot.tax }, shipping: { ...snapshot.shipping }, fees: { ...snapshot.fees }, finalTotal, currency: "USD", discountAmount, policyId: policy.id, policyVersion: policy.version, evidenceId: selected.id, evidenceSnapshot: structuredClone(selected), cartSnapshot: structuredClone(snapshot), createdAt: evaluatedAt.toISOString(), expiresAt: new Date(evaluatedAt.getTime() + policy.offerTtlSeconds * 1000).toISOString(), status: "issued" };
      await this.repo.saveOffer(offer);
    }
    comparison.status = "completed"; comparison.completedAt = this.clock.now().toISOString(); await this.repo.saveComparison(comparison); return { comparison, decision, evidence, offer };
  }
  async compareCart(input: { sessionId: string; cart: CartItemInput[] }): Promise<CartComparisonResult> {
    const snapshot=buildCartSnapshot(input.cart); const checkedAt=this.clock.now(); const results:ComparisonResult[]=[]; const lines:AuthorizedLineAdjustment[]=[];
    for(const cartLine of snapshot.lines){
      const product=getProduct(cartLine.productId)!;
      try{
        const result=await this.compare({sessionId:input.sessionId,productId:product.id,cart:input.cart}); results.push(result);
        const verified=result.evidence.find((item)=>item.id===result.decision.evidenceId);
        const hasPossible=result.evidence.some((item)=>item.productMatch==="probable"||item.productMatch==="uncertain");
        const missingCommercial=result.evidence.some((item)=>item.productMatch==="exact"&&(item.shipping===null||item.fees===null||item.availability==="unknown"));
        const status=result.decision.eligible?"VERIFIED_MATCH":missingCommercial?"INSUFFICIENT_DATA":hasPossible?"POSSIBLE_MATCH":"NO_VERIFIED_MATCH";
        const authorizedUnit=result.decision.eligible?result.decision.approvedUnitPrice:product.price;
        const originalLineTotal=multiplyMoney(product.price,cartLine.quantity); const finalLineTotal=multiplyMoney(authorizedUnit,cartLine.quantity); const savings=subtractMoney(originalLineTotal,finalLineTotal);
        let policyOutcome:PolicyOutcome="UNVERIFIED"; if(result.decision.eligible)policyOutcome=(await this.repo.getPolicy(DEMO_MERCHANT_ID))?.pricingStrategy.type==="better_by_fixed_amount"?"BETTER_OFFER":"PRICE_MATCH";else if(result.decision.reasonCode==="already_competitive")policyOutcome="KEEP_ORIGINAL";
        lines.push({productId:product.id,productName:product.name,variantKey:cartLine.variantKey,quantity:cartLine.quantity,originalUnitPrice:{...product.price},authorizedUnitPrice:{...authorizedUnit},originalLineTotal,finalLineTotal,savings,comparisonStatus:status,policyOutcome,explanation:result.decision.reason,evidence:verified&&structuredClone(verified)});
      }catch{
        const total=multiplyMoney(product.price,cartLine.quantity); lines.push({productId:product.id,productName:product.name,variantKey:cartLine.variantKey,quantity:cartLine.quantity,originalUnitPrice:{...product.price},authorizedUnitPrice:{...product.price},originalLineTotal:total,finalLineTotal:{...total},savings:money(0,"USD"),comparisonStatus:"SOURCE_UNAVAILABLE",policyOutcome:"UNVERIFIED",explanation:"The comparison service could not provide a reliable result."});
      }
    }
    for(const result of results)if(result.offer)await this.repo.revokeOffer(result.offer.id,checkedAt,"replaced_by_cart_offer");
    const discounted=lines.filter((line)=>line.savings.amountMinor>0&&line.evidence); let offer:AuthorizedOffer|undefined;
    if(discounted.length){
      const policy=await this.repo.getPolicy(DEMO_MERCHANT_ID); if(!policy)throw new OfferValidationError("policy_unavailable","Merchant policy unavailable");
      const first=discounted[0]; const firstResult=results.find((result)=>result.comparison.productId===first.productId)!; const discount=addMoney(...lines.map((line)=>line.savings)); const approvedSubtotal=subtractMoney(snapshot.subtotal,discount); const finalTotal=subtractMoney(snapshot.total,discount); const expiresAt=new Date(checkedAt.getTime()+policy.offerTtlSeconds*1000).toISOString();
      offer={id:randomUUID(),comparisonId:firstResult.comparison.id,merchantId:DEMO_MERCHANT_ID,sessionId:input.sessionId,productId:first.productId,productGtin:getProduct(first.productId)!.gtin,variantKey:first.variantKey,quantity:first.quantity,cartFingerprint:cartFingerprint(input.sessionId,snapshot),originalUnitPrice:{...first.originalUnitPrice},approvedUnitPrice:{...first.authorizedUnitPrice},originalSubtotal:{...snapshot.subtotal},approvedSubtotal,tax:{...snapshot.tax},shipping:{...snapshot.shipping},fees:{...snapshot.fees},finalTotal,currency:"USD",discountAmount:discount,policyId:policy.id,policyVersion:policy.version,evidenceId:first.evidence!.id,evidenceSnapshot:structuredClone(first.evidence!),cartSnapshot:structuredClone(snapshot),createdAt:checkedAt.toISOString(),expiresAt,status:"issued",lineAdjustments:structuredClone(lines)};
      await this.repo.saveOffer(offer);
    }
    return{lines,offer,sourceType:this.provider.sourceType,checkedAt:checkedAt.toISOString()};
  }
  async authorizeOriginalCart(input:{sessionId:string;cart:CartItemInput[]}){
    const now=this.clock.now();const snapshot=buildCartSnapshot(input.cart);let policy=await this.repo.getPolicy(DEMO_MERCHANT_ID);if(!policy){policy=defaultPolicy;await this.repo.savePolicy(policy);}const first=snapshot.lines[0];const product=getProduct(first.productId)!;
    const comparison:ComparisonRequest={id:randomUUID(),merchantId:DEMO_MERCHANT_ID,sessionId:input.sessionId,productId:first.productId,quantity:first.quantity,cartFingerprint:cartFingerprint(input.sessionId,snapshot),status:"completed",sourceType:"cached",createdAt:now.toISOString(),completedAt:now.toISOString()};await this.repo.saveComparison(comparison);
    const lines:AuthorizedLineAdjustment[]=snapshot.lines.map((line)=>{const item=getProduct(line.productId)!;return{productId:item.id,productName:item.name,variantKey:line.variantKey,quantity:line.quantity,originalUnitPrice:{...item.price},authorizedUnitPrice:{...item.price},originalLineTotal:{...line.lineTotal},finalLineTotal:{...line.lineTotal},savings:money(0,"USD"),comparisonStatus:"NO_VERIFIED_MATCH",policyOutcome:"KEEP_ORIGINAL",explanation:"Original-price checkout selected by the customer."};});
    const evidence:CompetitorEvidence={id:randomUUID(),comparisonId:comparison.id,providerProductId:"merchant-catalog",retailer:"PriceMatcher demo merchant",retailerDomain:"localhost",sourceUrl:"https://localhost/",sourceType:"cached",retrievedAt:now.toISOString(),productTitle:product.name,brand:product.brand,model:product.model,gtin:product.gtin,variant:{color:product.variant.color,size:product.variant.size,condition:product.variant.condition},productPrice:{...product.price},shipping:{...snapshot.shipping},fees:{...snapshot.fees},deliveredCostSource:"retailer_api",deliveredCostRetrievedAt:now.toISOString(),availability:"in_stock",sellerVerification:"approved",productMatch:"exact",aiAssisted:false,verificationReasons:["Authoritative merchant catalog snapshot; not competitor evidence"]};
    const offer:AuthorizedOffer={id:randomUUID(),comparisonId:comparison.id,merchantId:DEMO_MERCHANT_ID,sessionId:input.sessionId,productId:product.id,productGtin:product.gtin,variantKey:first.variantKey,quantity:first.quantity,cartFingerprint:comparison.cartFingerprint,originalUnitPrice:{...product.price},approvedUnitPrice:{...product.price},originalSubtotal:{...snapshot.subtotal},approvedSubtotal:{...snapshot.subtotal},tax:{...snapshot.tax},shipping:{...snapshot.shipping},fees:{...snapshot.fees},finalTotal:{...snapshot.total},currency:"USD",discountAmount:money(0,"USD"),policyId:policy.id,policyVersion:policy.version,evidenceId:evidence.id,evidenceSnapshot:evidence,cartSnapshot:structuredClone(snapshot),createdAt:now.toISOString(),expiresAt:new Date(now.getTime()+policy.offerTtlSeconds*1000).toISOString(),status:"issued",lineAdjustments:lines,authorizationKind:"original"};await this.repo.saveOffer(offer);return this.repo.acceptOffer({offerId:offer.id,sessionId:input.sessionId,cartFingerprint:offer.cartFingerprint,expectedPolicyId:policy.id,expectedPolicyVersion:policy.version,now});
  }
  async accept(input: { offerId: string; sessionId: string; cart: CartItemInput[] }) {
    const now = this.clock.now(); const existing = await this.repo.getOffer(input.offerId); if (!existing) throw new OfferValidationError("not_found", "Offer not found");
    if (new Date(existing.expiresAt) <= now) throw new OfferValidationError("expired", "Offer has expired; check the price again");
    const snapshot = buildCartSnapshot(input.cart); const fingerprint = cartFingerprint(input.sessionId, snapshot);
    if (existing.sessionId !== input.sessionId) throw new OfferValidationError("unauthorized", "Offer belongs to another session");
    if (existing.cartFingerprint !== fingerprint) throw new OfferValidationError("cart_changed", "Cart no longer matches the authorized snapshot");
    const product = getProduct(existing.productId); if (!product) throw new OfferValidationError("product_changed", "Product is no longer available");
    const policy = await this.repo.getPolicy(existing.merchantId); if (!policy || policy.id !== existing.policyId || policy.version !== existing.policyVersion) throw new OfferValidationError("policy_changed", "Merchant policy changed; check the price again");
    if(existing.lineAdjustments){
      let totalDiscount=money(0,"USD");
      for(const line of existing.lineAdjustments){
        const product=getProduct(line.productId);const current=snapshot.lines.find((item)=>item.productId===line.productId);
        if(!product||!current||current.variantKey!==line.variantKey||current.quantity!==line.quantity)throw new OfferValidationError("cart_changed","Cart no longer matches the authorized snapshot");
        if(line.savings.amountMinor>0){if(!line.evidence||!evidenceIsFresh(line.evidence,policy,now))throw new OfferValidationError("stale_evidence","Competitor evidence is stale; check the price again");const decision=evaluatePricing(product,[line.evidence],policy);if(!decision.eligible||decision.approvedUnitPrice.amountMinor!==line.authorizedUnitPrice.amountMinor)throw new OfferValidationError("offer_invalid","A cart item no longer satisfies merchant policy");}
        const expectedOriginal=multiplyMoney(product.price,current.quantity);const expectedFinal=multiplyMoney(line.authorizedUnitPrice,current.quantity);if(expectedOriginal.amountMinor!==line.originalLineTotal.amountMinor||expectedFinal.amountMinor!==line.finalLineTotal.amountMinor)throw new OfferValidationError("totals_changed","Authoritative line totals changed; check the price again");totalDiscount=addMoney(totalDiscount,subtractMoney(expectedOriginal,expectedFinal));
      }
      const expectedTotal=subtractMoney(snapshot.total,totalDiscount);if(expectedTotal.amountMinor!==existing.finalTotal.amountMinor||totalDiscount.amountMinor!==existing.discountAmount.amountMinor)throw new OfferValidationError("totals_changed","Authoritative cart total changed; check the price again");
      return this.repo.acceptOffer({offerId:existing.id,sessionId:input.sessionId,cartFingerprint:fingerprint,expectedPolicyId:policy.id,expectedPolicyVersion:policy.version,now});
    }
    if (!evidenceIsFresh(existing.evidenceSnapshot, policy, now)) throw new OfferValidationError("stale_evidence", "Competitor evidence is stale; check the price again");
    const decision = evaluatePricing(product, [existing.evidenceSnapshot], policy);
    const target = snapshot.lines.find((line) => line.productId === product.id);
    if (!target || !decision.eligible || decision.evidenceId !== existing.evidenceId || decision.approvedUnitPrice.amountMinor !== existing.approvedUnitPrice.amountMinor) throw new OfferValidationError("offer_invalid", "Offer no longer satisfies merchant policy");
    const originalSubtotal = multiplyMoney(product.price, target.quantity); const approvedSubtotal = multiplyMoney(decision.approvedUnitPrice, target.quantity); const discount = subtractMoney(originalSubtotal, approvedSubtotal); const total = subtractMoney(snapshot.total, discount);
    if (existing.originalUnitPrice.amountMinor !== product.price.amountMinor || existing.originalSubtotal.amountMinor !== originalSubtotal.amountMinor || existing.approvedSubtotal.amountMinor !== approvedSubtotal.amountMinor || existing.finalTotal.amountMinor !== total.amountMinor || existing.tax.amountMinor !== snapshot.tax.amountMinor || existing.shipping.amountMinor !== snapshot.shipping.amountMinor || existing.fees.amountMinor !== snapshot.fees.amountMinor) throw new OfferValidationError("totals_changed", "Authoritative totals changed; check the price again");
    return this.repo.acceptOffer({ offerId: existing.id, sessionId: input.sessionId, cartFingerprint: fingerprint, expectedPolicyId: policy.id, expectedPolicyVersion: policy.version, now });
  }
}
