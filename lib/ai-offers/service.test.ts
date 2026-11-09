import { afterEach,beforeEach,describe,expect,it,vi } from "vitest";
import { getProduct,products } from "../catalog";
import { virtualSkus } from "../footwear/operations";
import { MemoryPriceIntelligenceRepository } from "../persistence/memory-repository";
import { MemoryTransactionRepository } from "../payments/memory-transaction-repository";
import { createApprovedCheckoutExecutor } from "../payments/approved-checkout";
import { demoPolicy, marketSnapshot } from "../price-intelligence/demo-offers";
import { buildCartSnapshot, productVariantKey, PriceIntelligenceService } from "../price-intelligence/service";
import { FixturePriceProvider } from "../price-intelligence/fixture-provider";
import { AiOfferService,aiEnabled } from "./service";
import { factsForCart, inventoryPolicy, policyFloor, sameInventoryPolicy, validateAiDecision, type AgentFacts } from "./policy";
import type { AgentKind,AgentModel } from "./model";
import type { CartItemInput } from "../types";
import type { Channel3MarketOffer, Channel3SearchResult, MarketSearch } from "../price-intelligence/channel3-market";

const session="11c22712-8890-47ed-92f7-aed7bcfc9532";
const sku=virtualSkus.find(item=>item.productId===products[0].id&&item.stock>=2)!;
const product=getProduct(sku.productId)!;
const cart:CartItemInput[]=[{productId:product.id,variantKey:productVariantKey(product,sku.size),quantity:1}];
const prior:Record<string,string|undefined>={};
beforeEach(()=>{for(const key of ["AI_OFFER_AGENT_ENABLED","MODEL_API_KEY","OPENAI_API_KEY","PRICEMATCHER_DEMO_ASSUMPTIONS","PAYPAL_ENVIRONMENT"]){prior[key]=process.env[key];}process.env.AI_OFFER_AGENT_ENABLED="1";process.env.PRICEMATCHER_DEMO_ASSUMPTIONS="1";process.env.PAYPAL_ENVIRONMENT="SANDBOX";});
afterEach(()=>{for(const [key,value] of Object.entries(prior)){if(value===undefined)delete process.env[key];else process.env[key]=value;}});

class MockAgents implements AgentModel{
  calls:AgentKind[]=[];
  constructor(private choice:"MATCH_LOWEST"|"PARTIAL_MATCH"|"KEEP_ORIGINAL",private invalid=false){}
  async run(kind:AgentKind,input:unknown){this.calls.push(kind);const data=input as {items:Array<AgentFacts|{fact:AgentFacts}>};const facts=data.items.map(item=>"fact" in item?item.fact:item);if(kind==="inventory-sales")return{items:facts.map(fact=>({key:fact.key,classification:"healthy",demandTrend:"steady",aggressiveness:"moderate",minSuggestedMinor:fact.costMinor,maxSuggestedMinor:fact.originalUnitMinor,reasons:"Healthy inventory",riskFlags:[]}))};const items=facts.map(fact=>{const market=fact.market.lowestNewMinor??fact.originalUnitMinor;const normal=this.choice==="KEEP_ORIGINAL"?fact.originalUnitMinor:this.choice==="MATCH_LOWEST"?Math.min(fact.originalUnitMinor,market):Math.floor((fact.originalUnitMinor+market)/2);return{key:fact.key,productId:fact.productId,sku:fact.sku,decision:this.choice,proposedUnitMinor:this.invalid?1:normal,reference:this.choice==="KEEP_ORIGINAL"?null:fact.market.reference,reason:"Customer-safe offer",limitations:"Unknown delivery costs"};});return{items,consolidatedSubtotalMinor:items.reduce((sum,item,index)=>sum+item.proposedUnitMinor*facts[index].quantity,0)};}
}
describe("two-agent SKU offer orchestration",()=>{
  it("logs only safe boolean gate checks when AI is disabled",()=>{const warn=vi.spyOn(console,"warn").mockImplementation(()=>{});try{process.env.AI_OFFER_AGENT_ENABLED="0";process.env.MODEL_API_KEY="sensitive-test-key";process.env.PRICEMATCHER_DEMO_ASSUMPTIONS="1";process.env.PAYPAL_ENVIRONMENT="SANDBOX";expect(aiEnabled()).toBe(false);expect(warn).toHaveBeenCalledOnce();const message=String(warn.mock.calls[0][0]);expect(JSON.parse(message)).toEqual({event:"ai_offer_gate_disabled",checks:{agentEnabled:false,modelKeyConfigured:true,demoAssumptionsEnabled:true,paypalSandbox:true}});expect(message).not.toContain("sensitive-test-key");}finally{warn.mockRestore();}});
  it("classifies malformed Agent A output using safe structural metadata only",async()=>{const warn=vi.spyOn(console,"warn").mockImplementation(()=>{});try{const result=await new AiOfferService(new MemoryPriceIntelligenceRepository(),{run:async()=>({items:"sensitive-model-content"})}).compare({sessionId:`${session}-invalid-schema`,cart});expect(result.agentMode).toBe("fallback");const event=warn.mock.calls.map(call=>JSON.parse(String(call[0]))).find(item=>item.stage==="schema");expect(event).toMatchObject({event:"ai_offer_validation_failure",agent:"inventory-sales",stage:"schema",category:"schema_invalid",issueCount:1,issues:[{code:"invalid_type",path:"items",expected:"array"}]});expect(JSON.stringify(warn.mock.calls)).not.toContain("sensitive-model-content");}finally{warn.mockRestore();}});
  it.each([
    ["invalid enum",(item:Record<string,unknown>)=>{item.classification="overstock_no_sales";},"items.*.classification","invalid_value"],
    ["missing field",(item:Record<string,unknown>)=>{delete item.reasons;},"items.*.reasons","invalid_type"],
    ["extra field",(item:Record<string,unknown>)=>{item.secretField="sensitive-model-content";},"items.*","unrecognized_keys"],
    ["negative price",(item:Record<string,unknown>)=>{item.minSuggestedMinor=-1;},"items.*.minSuggestedMinor","too_small"],
    ["fractional price",(item:Record<string,unknown>)=>{item.maxSuggestedMinor=1.5;},"items.*.maxSuggestedMinor","invalid_type"],
    ["overlong explanation",(item:Record<string,unknown>)=>{item.reasons="sensitive-model-content".repeat(20);},"items.*.reasons","too_big"],
    ["null risk flags",(item:Record<string,unknown>)=>{item.riskFlags=null;},"items.*.riskFlags","invalid_type"],
    ["malformed risk flags",(item:Record<string,unknown>)=>{item.riskFlags=[null];},"items.*.riskFlags.*","invalid_type"],
    ["too many risk flags",(item:Record<string,unknown>)=>{item.riskFlags=Array(6).fill("short");},"items.*.riskFlags","too_big"],
    ["overlong risk flag",(item:Record<string,unknown>)=>{item.riskFlags=["sensitive-model-content".repeat(20)];},"items.*.riskFlags.*","too_big"],
  ] as const)("rejects %s without leaking model values",async(label,mutate,path,code)=>{
    const delegate=new MockAgents("KEEP_ORIGINAL");
    const model:AgentModel={run:async(kind,input)=>{
      if(kind!=="inventory-sales")return delegate.run(kind,input);
      const fact=(input as {items:AgentFacts[]}).items[0];
      const item:Record<string,unknown>={key:fact.key,classification:"healthy",demandTrend:"steady",aggressiveness:"moderate",minSuggestedMinor:fact.costMinor,maxSuggestedMinor:fact.originalUnitMinor,reasons:"short",riskFlags:[]};
      mutate(item);return{items:[item]};
    }};
    const warn=vi.spyOn(console,"warn").mockImplementation(()=>{});
    try{
      const result=await new AiOfferService(new MemoryPriceIntelligenceRepository(),model).compare({sessionId:`${session}-schema-${label}`,cart});
      expect(result.agentMode).toBe("fallback");expect(result.offer).toBeUndefined();
      expect(result.lines[0].authorizedUnitPrice).toEqual(result.lines[0].originalUnitPrice);
      const event=warn.mock.calls.map(call=>JSON.parse(String(call[0]))).find(item=>item.stage==="schema");
      expect(event).toMatchObject({agent:"inventory-sales",category:"schema_invalid",issueCount:1,issues:[{path,code}]});
      expect(JSON.stringify(warn.mock.calls)).not.toMatch(/sensitive-model-content|secretField|SIM-wmJLHiy/);
      expect(delegate.calls).toHaveLength(0);
    }finally{warn.mockRestore();}
  });
  it("classifies a policy-rejected proposal with a fixed reason code",async()=>{const warn=vi.spyOn(console,"warn").mockImplementation(()=>{});try{await new AiOfferService(new MemoryPriceIntelligenceRepository(),new MockAgents("MATCH_LOWEST",true)).compare({sessionId:`${session}-policy-log`,cart});expect(warn.mock.calls.map(call=>JSON.parse(String(call[0])))).toContainEqual({event:"ai_offer_validation_failure",agent:"market-offer",stage:"policy",category:"policy_rejected",reason:"merchant_price_floor"});}finally{warn.mockRestore();}});
  it("keeps the saved storefront variant key stable for runtime requests",()=>{expect(cart[0].variantKey).toBe("SIM-wmJLHiy:PUMA Black-PUMA Silver:EU37:new");});
  for(const choice of ["MATCH_LOWEST","PARTIAL_MATCH","KEEP_ORIGINAL"] as const){it(`uses both model agents and independently authorizes ${choice}`,async()=>{const repo=new MemoryPriceIntelligenceRepository(),mock=new MockAgents(choice),service=new AiOfferService(repo,mock);const testCart=choice==="PARTIAL_MATCH"?(()=>{for(const candidate of products){const size=virtualSkus.find(item=>item.productId===candidate.id&&item.stock>0);if(!size)continue;const selection=[{productId:candidate.id,variantKey:productVariantKey(candidate,size.size),quantity:1}];const fact=factsForCart(buildCartSnapshot(selection))[0],market=fact.market.lowestNewMinor;if(market!==null&&market<fact.originalUnitMinor-2&&Math.floor((fact.originalUnitMinor+market)/2)>=policyFloor(fact))return selection;}throw new Error("No valid partial-match fixture");})():cart;const result=await service.compare({sessionId:`${session}-${choice}`,cart:testCart});expect(result.agentMode).toBe("ai");expect(mock.calls.at(-1)).toBe("market-offer");expect(mock.calls.length).toBeLessThanOrEqual(2);const offer=result.offer!;expect(offer.aiAuthorization?.decisions[0].decision).toBe(choice);expect(offer.finalTotal.amountMinor).toBe(offer.cartSnapshot.total.amountMinor-offer.discountAmount.amountMinor);const accepted=(await service.accept({offerId:offer.id,sessionId:`${session}-${choice}`,cart:testCart})).offer;const prepare=createApprovedCheckoutExecutor({offers:repo,transactions:new MemoryTransactionRepository(repo)});const payment=await prepare(accepted.id,{sessionId:`${session}-${choice}`,cart:testCart,idempotencyKey:crypto.randomUUID()});expect(payment.instruction.amount).toEqual(accepted.finalTotal);});}
  it("revises one rejected below-cost proposal then safely falls back",async()=>{const repo=new MemoryPriceIntelligenceRepository(),mock=new MockAgents("MATCH_LOWEST",true);const result=await new AiOfferService(repo,mock).compare({sessionId:`${session}-bad`,cart});expect(result.agentMode).toBe("fallback");expect(result.offer).toBeUndefined();expect(mock.calls.slice(-2)).toEqual(["market-offer","market-offer"]);});
  it("caches repeated price checks and batches a multi-item cart",async()=>{const repo=new MemoryPriceIntelligenceRepository(),mock=new MockAgents("KEEP_ORIGINAL"),service=new AiOfferService(repo,mock);const other=virtualSkus.find(item=>item.productId===products[2].id&&item.stock>0)!;const p2=getProduct(other.productId)!;const multi=[...cart,{productId:p2.id,variantKey:productVariantKey(p2,other.size),quantity:1}];const first=await service.compare({sessionId:`${session}-multi`,cart:multi});const second=await service.compare({sessionId:`${session}-multi`,cart:multi});expect(first.offer?.id).toBe(second.offer?.id);expect(mock.calls).toHaveLength(2);expect(first.lines).toHaveLength(2);});
  it("rejects SKU substitution, browser amount changes, replay and wrong session",async()=>{const repo=new MemoryPriceIntelligenceRepository(),service=new AiOfferService(repo,new MockAgents("MATCH_LOWEST"));const id=`${session}-secure`;const issued=(await service.compare({sessionId:id,cart})).offer!;await expect(service.accept({offerId:issued.id,sessionId:"other",cart})).rejects.toMatchObject({code:"unauthorized"});const changed=[{...cart[0],variantKey:productVariantKey(product,sku.size+1)}];await expect(service.accept({offerId:issued.id,sessionId:id,cart:changed})).rejects.toMatchObject({code:"cart_changed"});const accepted=(await service.accept({offerId:issued.id,sessionId:id,cart})).offer;await expect(service.accept({offerId:issued.id,sessionId:id,cart})).rejects.toMatchObject({code:"replay"});const checkout=createApprovedCheckoutExecutor({offers:repo,transactions:new MemoryTransactionRepository(repo)});repo.offers.get(accepted.id)!.finalTotal.amountMinor--;await expect(checkout(accepted.id,{sessionId:id,cart,idempotencyKey:crypto.randomUUID()})).rejects.toMatchObject({code:"pricing_changed"});});
  it("keeps original-price checkout independent when only the legacy OpenAI key exists",async()=>{const repo=new MemoryPriceIntelligenceRepository();delete process.env.MODEL_API_KEY;process.env.OPENAI_API_KEY="legacy-test-key";const checked=await new AiOfferService(repo).compare({sessionId:`${session}-off`,cart});expect(checked.agentMode).toBe("fallback");const original=(await new PriceIntelligenceService(new FixturePriceProvider(),repo).authorizeOriginalCart({sessionId:`${session}-off`,cart})).offer;expect(original.discountAmount.amountMinor).toBe(0);});
  for(const failure of ["timeout","rate_limit","malformed_json"] as const){it(`fails closed on ${failure}`,async()=>{const model:AgentModel={run:async()=>{if(failure==="malformed_json")return{items:"not-an-array"};throw new Error(failure);}};const result=await new AiOfferService(new MemoryPriceIntelligenceRepository(),model).compare({sessionId:`${session}-${failure}`,cart});expect(result.agentMode).toBe("fallback");expect(result.offer).toBeUndefined();});}
  it("does not pass raw Channel3 metadata or instructions to either agent",async()=>{const seen:string[]=[];const mock=new MockAgents("KEEP_ORIGINAL");const model:AgentModel={run:async(kind,input)=>{seen.push(JSON.stringify(input));return mock.run(kind,input);}};await new AiOfferService(new MemoryPriceIntelligenceRepository(),model).compare({sessionId:`${session}-injection`,cart});expect(seen.join(" ")).not.toContain("http");expect(seen.join(" ")).not.toContain("description");expect(seen.join(" ")).not.toContain("ignore previous instructions");});
  it("lets deterministic policy—not conflicting strategist advice—decide the allowed floor",async()=>{const base=new MockAgents("MATCH_LOWEST");const model:AgentModel={run:async(kind,input)=>{const output=await base.run(kind,input) as {items:Array<{minSuggestedMinor?:number}>};if(kind==="inventory-sales")output.items.forEach(item=>item.minSuggestedMinor=999999);return output;}};const result=await new AiOfferService(new MemoryPriceIntelligenceRepository(),model).compare({sessionId:`${session}-conflict`,cart});expect(result.agentMode).toBe("ai");expect(result.offer?.approvedUnitPrice.amountMinor).toBe(Math.min(product.price.amountMinor,marketSnapshot(product.id)!.lowestNew!));});
  it("rejects expiration at acceptance and order preparation",async()=>{const repo=new MemoryPriceIntelligenceRepository();let now=new Date("2026-10-26T12:30:00Z");const service=new AiOfferService(repo,new MockAgents("KEEP_ORIGINAL"),()=>now);const checked=await service.compare({sessionId:`${session}-expiry`,cart});expect(checked.offer).toBeDefined();now=new Date("2026-10-26T12:46:00Z");await expect(service.accept({offerId:checked.offer!.id,sessionId:`${session}-expiry`,cart})).rejects.toMatchObject({code:"expired"});});
  it("rejects a changed merchant inventory configuration before acceptance",async()=>{
    const repo=new MemoryPriceIntelligenceRepository(),service=new AiOfferService(repo,new MockAgents("KEEP_ORIGINAL")),sessionId=`${session}-policy-change`;
    const offer=(await service.compare({sessionId,cart})).offer!;
    const previous=process.env.AI_ACTIVE_SALES_DAYS;
    process.env.AI_ACTIVE_SALES_DAYS=String(inventoryPolicy().activeSalesDays===3?4:3);
    try{await expect(service.accept({offerId:offer.id,sessionId,cart})).rejects.toMatchObject({code:"policy_changed"});}
    finally{if(previous===undefined)delete process.env.AI_ACTIVE_SALES_DAYS;else process.env.AI_ACTIVE_SALES_DAYS=previous;}
  });
  it("rejects tampered AI line prices and unavailable SKU stock",async()=>{
    const repo=new MemoryPriceIntelligenceRepository(),service=new AiOfferService(repo,new MockAgents("KEEP_ORIGINAL"));
    const priceSession=`${session}-price-tamper`,priceOffer=(await service.compare({sessionId:priceSession,cart})).offer!;
    repo.offers.get(priceOffer.id)!.lineAdjustments![0].authorizedUnitPrice.amountMinor++;
    await expect(service.accept({offerId:priceOffer.id,sessionId:priceSession,cart})).rejects.toMatchObject({code:"amount_changed"});
    const stockSession=`${session}-stock-change`,stockOffer=(await service.compare({sessionId:stockSession,cart})).offer!;
    const available=sku.stock;sku.stock=0;
    try{await expect(service.accept({offerId:stockOffer.id,sessionId:stockSession,cart})).rejects.toMatchObject({code:"invalid_cart"});}
    finally{sku.stock=available;}
  });
  it("authorizes a fresh Channel3 observation, then rejects changed evidence and expiry before PayPal preparation",async()=>{
    const now=new Date(),batchId=crypto.randomUUID(),retrievedAt=now.toISOString();
    const observed:Channel3MarketOffer={id:"observed-channel3-offer",provider:"channel3",searchBatchId:batchId,retrievedAt,merchantName:"Example Shoes",title:`${product.brand} ${product.name} EU ${sku.size}`,productUrl:"https://example.com/shoes",channel3ProductId:"channel3-product",priceMinor:product.price.amountMinor-1000,currency:"USD",brand:product.brand,model:product.model,size:`EU${sku.size}`,color:null,condition:null,availability:"unknown",shippingDescription:null,shippingMinor:null,mandatoryFeesMinor:null,matchStatus:"exact_variant",matchConfidence:"high",evidenceStatus:"observed_product_offer"};
    const search:Channel3SearchResult={batchId,retrievedAt,productId:product.id,variantKey:cart[0].variantKey,offers:[observed],status:"success"};
    const provider:MarketSearch={search:async()=>search};
    const repo=new MemoryPriceIntelligenceRepository(),service=new AiOfferService(repo,new MockAgents("MATCH_LOWEST"),()=>now,provider),sessionId=`${session}-channel3`;
    const result=await service.compare({sessionId,cart});expect(result.agentMode).toBe("ai");expect(result.sourceType).toBe("live");expect(result.analysis?.[0]).toMatchObject({productId:product.id,inventorySignal:"healthy",decision:"MATCH_LOWEST"});expect(result.offer?.approvedUnitPrice.amountMinor).toBe(observed.priceMinor);
    const accepted=(await service.accept({offerId:result.offer!.id,sessionId,cart})).offer;
    const checkout=createApprovedCheckoutExecutor({offers:repo,transactions:new MemoryTransactionRepository(repo)});
    const prepared=await checkout(accepted.id,{sessionId,cart,idempotencyKey:crypto.randomUUID()});expect(prepared.instruction.amount).toEqual(accepted.finalTotal);
    repo.offers.get(accepted.id)!.aiAuthorization!.channel3Market!.offers[0].priceMinor=observed.priceMinor!-1;
    await expect(checkout(accepted.id,{sessionId,cart,idempotencyKey:crypto.randomUUID()})).rejects.toMatchObject({code:"pricing_changed"});
    repo.offers.get(accepted.id)!.aiAuthorization!.channel3Market!.offers[0].priceMinor=observed.priceMinor;
    repo.offers.get(accepted.id)!.aiAuthorization!.channel3Market!.retrievedAt=new Date(now.getTime()-301000).toISOString();
    await expect(checkout(accepted.id,{sessionId,cart,idempotencyKey:crypto.randomUUID()})).rejects.toMatchObject({code:"pricing_changed"});
  });
  it("uses the cheaper unknown-stock observation over an exact in-stock listing and passes both to Agent B",async()=>{
    const now=new Date(),batchId=crypto.randomUUID(),retrievedAt=now.toISOString();
    const base:Channel3MarketOffer={id:"cheap",provider:"channel3",searchBatchId:batchId,retrievedAt,merchantName:"Budget seller",title:`${product.brand} ${product.name}`,productUrl:"https://example.com/cheap",channel3ProductId:null,priceMinor:product.price.amountMinor-1200,currency:"USD",brand:product.brand,model:product.model,size:null,color:null,condition:null,availability:"unknown",shippingDescription:null,shippingMinor:null,mandatoryFeesMinor:null,matchStatus:"same_model",matchConfidence:"medium",evidenceStatus:"observed_product_offer"};
    const stock:Channel3MarketOffer={...base,id:"stock",merchantName:"Stock seller",productUrl:"https://example.com/stock",priceMinor:product.price.amountMinor-600,availability:"in_stock",matchStatus:"exact_variant",matchConfidence:"high"};
    const search:Channel3SearchResult={batchId,retrievedAt,productId:product.id,variantKey:cart[0].variantKey,offers:[stock,base],status:"success"};
    let passed:unknown;const mock=new MockAgents("MATCH_LOWEST");const model:AgentModel={run:async(kind,value)=>{if(kind==="market-offer")passed=value;return mock.run(kind,value);}};
    const result=await new AiOfferService(new MemoryPriceIntelligenceRepository(),model,()=>now,{search:async()=>search}).compare({sessionId:`${session}-channel3-price-first`,cart});
    expect(result.agentMode).toBe("ai");expect(result.offer?.approvedUnitPrice.amountMinor).toBe(base.priceMinor);expect(result.offer?.aiAuthorization?.decisions[0].reference).toBe("cheap");
    expect(JSON.stringify(passed)).toContain('"merchantName":"Budget seller"');expect(JSON.stringify(passed)).toContain('"availability":"unknown"');expect(JSON.stringify(passed)).toContain('"matchStatus":"same_model"');
  });
  it("starts Agent A while the bounded Channel3 search is pending",async()=>{
    let release!:()=>void;const pending=new Promise<void>(resolve=>{release=resolve;});let agentStarted=false;
    const model:AgentModel={run:async(kind,value)=>{if(kind==="inventory-sales")agentStarted=true;return new MockAgents("KEEP_ORIGINAL").run(kind,value);}};
    const pendingResult=new AiOfferService(new MemoryPriceIntelligenceRepository(),model,()=>new Date(),{search:async(input)=>{await pending;return{batchId:crypto.randomUUID(),retrievedAt:new Date().toISOString(),productId:input.product.id,variantKey:input.variantKey,offers:[],status:"empty"};}}).compare({sessionId:`${session}-channel3-concurrent`,cart});
    expect(agentStarted).toBe(true);release();expect((await pendingResult).agentMode).toBe("ai");
  });
  it("keeps original price when Channel3 has no usable matching offer",async()=>{
    const now=new Date(),base={batchId:crypto.randomUUID(),retrievedAt:now.toISOString(),productId:product.id,variantKey:cart[0].variantKey,status:"success" as const};
    for(const invalid of [null,"variant_mismatch","out_of_stock"] as const){
      const offer:Channel3MarketOffer={id:"observed",provider:"channel3",searchBatchId:base.batchId,retrievedAt:base.retrievedAt,merchantName:"Example",title:product.name,productUrl:"https://example.com/shoe",channel3ProductId:null,priceMinor:product.price.amountMinor-1000,currency:"USD",brand:product.brand,model:product.model,size:null,color:null,condition:null,availability:invalid==="out_of_stock"?"out_of_stock":"unknown",shippingDescription:null,shippingMinor:null,mandatoryFeesMinor:null,matchStatus:invalid==="variant_mismatch"?"variant_mismatch":"same_model",matchConfidence:"low",evidenceStatus:"observed_product_offer"};
      const provider:MarketSearch={search:async()=>({...base,offers:invalid===null?[]:[offer]})};
      const result=await new AiOfferService(new MemoryPriceIntelligenceRepository(),new MockAgents("MATCH_LOWEST"),()=>now,provider).compare({sessionId:`${session}-channel3-${invalid}`,cart});
      expect(result.agentMode).toBe("fallback");expect(result.offer).toBeUndefined();expect(result.lines[0].authorizedUnitPrice).toEqual(product.price);
    }
  });
  it("searches one selected SKU per multi-item comparison and leaves other sizes at original price",async()=>{
    const other=virtualSkus.find(item=>item.productId===products[2].id&&item.stock>0)!,otherProduct=getProduct(other.productId)!;
    const multi=[...cart,{productId:otherProduct.id,variantKey:productVariantKey(otherProduct,other.size),quantity:1}];
    const now=new Date();const search=vi.fn(async(input:{product:{id:string};variantKey:string})=>({batchId:crypto.randomUUID(),retrievedAt:now.toISOString(),productId:input.product.id,variantKey:input.variantKey,offers:[],status:"empty" as const}));
    const result=await new AiOfferService(new MemoryPriceIntelligenceRepository(),new MockAgents("KEEP_ORIGINAL"),()=>now,{search}).compare({sessionId:`${session}-channel3-multi`,cart:multi});
    expect(search).toHaveBeenCalledOnce();expect(result.agentMode).toBe("ai");expect(result.lines).toHaveLength(2);expect(result.lines.every(item=>item.savings.amountMinor===0)).toBe(true);
  });
});
describe("inventory merchant rules",()=>{
  it("compares every security-relevant policy field independent of JSONB key order",()=>{
    const policy=inventoryPolicy();
    const reordered={maximumDiscountBps:policy.maximumDiscountBps,activeSalesDays:policy.activeSalesDays,overstockMarkupBps:policy.overstockMarkupBps,version:policy.version};
    expect(sameInventoryPolicy(policy,reordered)).toBe(true);
    for(const key of ["version","overstockMarkupBps","activeSalesDays","maximumDiscountBps"] as const){
      expect(sameInventoryPolicy(policy,{...reordered,[key]:policy[key]+1})).toBe(false);
      const missing={...reordered};delete (missing as Partial<typeof reordered>)[key];
      expect(sameInventoryPolicy(policy,missing)).toBe(false);
    }
    expect(sameInventoryPolicy(policy,{...reordered,unreviewedFloor:0})).toBe(false);
  });
  const base:AgentFacts={key:"p|v",productId:"p",sku:"sku",size:40,quantity:1,brand:"Demo",originalUnitMinor:10000,currency:"USD",costMinor:6000,skuStock:5,productStock:60,sales:{last7:0,last30:0,last60:0,distinctDays30:0},daysSinceLastSale:null,turnover:0,returns60:0,priceTrend:[],inventoryMovement90:5,inventoryTrend:{net7:0,net30:0,current:5},classification:"overstock_no_sales",market:{lowestNewMinor:8000,reference:"evidence",retrievedAt:new Date().toISOString(),shippingKnown:false,feesKnown:false,variantVerified:false,source:"saved_channel3_snapshot"},policy:{overstockMarkupBps:500,activeSalesDays:3,maximumDiscountBps:demoPolicy.maximumDiscountBps}};
  it("uses configured 5% or 10% above cost for overstock with no sales",()=>{expect(policyFloor(base,inventoryPolicy({AI_OVERSTOCK_MARKUP_BPS:"500"}))).toBe(6300);expect(policyFloor(base,inventoryPolicy({AI_OVERSTOCK_MARKUP_BPS:"1000"}))).toBe(6600);});
  it("protects scarce active inventory and normal stock",()=>{expect(policyFloor({...base,classification:"low_stock_active",productStock:8},inventoryPolicy())).toBe(8500);expect(policyFloor({...base,classification:"normal"},inventoryPolicy())).toBe(6000);});
  it("rejects below-cost, wrong evidence and unavailable SKU",()=>{const decision={key:base.key,productId:base.productId,sku:base.sku,decision:"MATCH_LOWEST" as const,proposedUnitMinor:8000,reference:"evidence",reason:"",limitations:""};expect(validateAiDecision(base,decision)).toBeNull();expect(validateAiDecision(base,{...decision,proposedUnitMinor:1})).toBe("merchant_price_floor");expect(validateAiDecision(base,{...decision,reference:"forged"})).toBe("market_reference_mismatch");expect(validateAiDecision({...base,skuStock:0},decision)).toBe("sku_unavailable");});
});
