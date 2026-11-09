import { createHash, randomUUID } from "node:crypto";
import { Channel3, type Channel3Api } from "@channel3/sdk";
import type { Pool } from "pg";
import type { Product } from "../types";
import { getPersistence } from "../server/persistence";
import { PostgresPriceIntelligenceRepository } from "../persistence/postgres-repository";

export type Channel3MarketOffer={id:string;provider:"channel3";searchBatchId:string;retrievedAt:string;merchantName:string|null;title:string;productUrl:string|null;channel3ProductId:string|null;priceMinor:number|null;currency:"USD"|null;brand:string|null;model:string|null;size:string|null;color:string|null;condition:string|null;availability:"in_stock"|"out_of_stock"|"preorder"|"backorder"|"unknown";shippingDescription?:string|null;shippingMinor:number|null;mandatoryFeesMinor:number|null;matchStatus:"exact_variant"|"same_model"|"variant_mismatch"|"insufficient_evidence";matchConfidence:"high"|"medium"|"low";evidenceStatus:"observed_product_offer"};
export type Channel3SearchResult={batchId:string;retrievedAt:string;productId:string;variantKey:string;offers:Channel3MarketOffer[];status:"success"|"empty"};
export type Channel3SearchInput={product:Product;variantKey:string;size:number;sessionId:string};
export interface MarketSearch{search(input:Channel3SearchInput):Promise<Channel3SearchResult>}
export class Channel3SearchError extends Error{constructor(readonly category:"disabled"|"budget"|"duplicate"|"timeout"|"rate_limit"|"provider"|"malformed"|"configuration"){super(category);}}
const normalized=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const label=(value:unknown)=>typeof value==="string"&&value.trim()?value.trim():null;
const availability=(value:unknown):Channel3MarketOffer["availability"]=>{const v=normalized(String(value??""));return v==="instock"||v==="in stock"?"in_stock":v==="outofstock"||v==="out of stock"?"out_of_stock":v==="preorder"||v==="pre order"?"preorder":v==="backorder"||v==="back order"?"backorder":"unknown";};
const cents=(price:unknown)=>typeof price==="number"&&Number.isFinite(price)&&price>0&&Number.isSafeInteger(Math.round(price*100))&&Math.abs(price*100-Math.round(price*100))<0.000001?Math.round(price*100):null;
const secureUrl=(value:unknown)=>{try{const url=new URL(String(value));return url.protocol==="https:"?url.toString():null;}catch{return null;}};
const option=(product:Channel3Api.Product,name:string)=>product.variants?.selected?.find(item=>item.name.toLowerCase()===name)?.label??null;
const euSize=(value:string)=>{const match=value.match(/^\s*(?:EU\s*)?(\d{2})\s*$/i);return match?Number(match[1]):null;};
export const eligibleChannel3Offer=(offer:Channel3MarketOffer)=>offer.priceMinor!==null&&offer.priceMinor>0&&offer.currency==="USD"&&offer.availability!=="out_of_stock"&&(offer.matchStatus==="exact_variant"||offer.matchStatus==="same_model")&&(!offer.condition||offer.condition.toLowerCase()==="new");
export const compareChannel3Offers=(a:Channel3MarketOffer,b:Channel3MarketOffer)=>(a.priceMinor??Infinity)-(b.priceMinor??Infinity)||(a.merchantName??"").localeCompare(b.merchantName??"")||(a.productUrl??"").localeCompare(b.productUrl??"")||a.id.localeCompare(b.id);
export function normalizeChannel3Offers(response:Channel3Api.Product,input:Channel3SearchInput,batchId:string,retrievedAt:string):Channel3MarketOffer[]{
  const expectedId=input.product.channel3FamilyId;
  if(!expectedId||response.id!==expectedId)throw new Channel3SearchError("malformed");
  const title=label(response.title);if(!title||!normalized(title).includes(normalized(input.product.model))||!response.brands?.some(brand=>normalized(brand.name)===normalized(input.product.brand)))throw new Channel3SearchError("malformed");
  const selectedSize=option(response,"size"),selectedColor=option(response,"color");
  if(selectedSize&&euSize(selectedSize)!==input.size)return [];
  if(selectedColor&&input.product.variant.color!=="Not verified"&&normalized(selectedColor)!==normalized(input.product.variant.color))return [];
  const output:Channel3MarketOffer[]=[],seen=new Set<string>();
  for(const raw of response.offers??[]){const url=secureUrl(raw.url),priceMinor=raw.price?.currency==="USD"?cents(raw.price.price):null;if(!url||priceMinor===null)continue;const status=availability(raw.availability);if(status==="out_of_stock"||raw.condition==="used")continue;
    const merchant=label(raw.domain)??new URL(url).hostname;const identity=`${normalized(merchant)}|${url}|${priceMinor}`;if(seen.has(identity))continue;seen.add(identity);
    output.push({id:createHash("sha256").update(`${batchId}|${identity}`).digest("hex").slice(0,32),provider:"channel3",searchBatchId:batchId,retrievedAt,merchantName:merchant,title,productUrl:url,channel3ProductId:response.id,priceMinor,currency:"USD",brand:input.product.brand,model:input.product.model,size:selectedSize,color:selectedColor,condition:raw.condition??null,availability:status,shippingMinor:null,mandatoryFeesMinor:null,matchStatus:selectedSize?"exact_variant":"same_model",matchConfidence:selectedSize?"high":"medium",evidenceStatus:"observed_product_offer"});
  }
  return output.filter(eligibleChannel3Offer).sort(compareChannel3Offers).slice(0,20);
}
function searchPool():Pool{const persistence=getPersistence();if(process.env.APP_ENV!=="production"||persistence.backend!=="postgres"||!(persistence.offers instanceof PostgresPriceIntelligenceRepository))throw new Channel3SearchError("configuration");return persistence.offers.pool;}
export async function reserveChannel3Lookup(pool:Pool,batchId:string,input:Channel3SearchInput){
  const limit=Number(process.env.CHANNEL3_EXACT_MAX_REQUESTS_PER_DAY??10);if(!Number.isSafeInteger(limit)||limit<1||limit>1000)throw new Channel3SearchError("configuration");
  const client=await pool.connect();try{await client.query("begin");await client.query("select pg_advisory_xact_lock(hashtextextended($1,0))",[`channel3:${input.sessionId}:${input.product.id}:${input.variantKey}`]);
    const recent=await client.query("select id from channel3_live_lookup_batches where session_id=$1 and product_id=$2 and variant_key=$3 and requested_at>now()-interval '5 seconds' limit 1",[input.sessionId,input.product.id,input.variantKey]);if(recent.rowCount)throw new Channel3SearchError("duplicate");
    const budget=await client.query("insert into channel3_live_daily_budget(day,request_count) select current_date,1 where $1::integer>=1 on conflict(day) do update set request_count=channel3_live_daily_budget.request_count+1 where channel3_live_daily_budget.request_count<$1 returning request_count",[limit]);if(!budget.rowCount)throw new Channel3SearchError("budget");
    await client.query("insert into channel3_live_lookup_batches(id,session_id,product_id,variant_key,requested_at,status) values($1,$2,$3,$4,now(),'reserved')",[batchId,input.sessionId,input.product.id,input.variantKey]);await client.query("commit");
  }catch(error){await client.query("rollback");throw error;}finally{client.release();}
}
export class Channel3ExactMarketSearch implements MarketSearch{
  constructor(private readonly deps:{retrieve?:(request:Channel3Api.RetrieveProductsRequest,options:{timeoutInSeconds:number;maxRetries:number})=>Promise<Channel3Api.Product>;reserve?:(batchId:string,input:Channel3SearchInput)=>Promise<void>;record?:(batchId:string,status:string,count:number,latencyMs:number)=>Promise<void>}={}){}
  async search(input:Channel3SearchInput):Promise<Channel3SearchResult>{
    if(process.env.CHANNEL3_EXACT_LOOKUP_ENABLED!=="1")throw new Channel3SearchError("disabled");const key=process.env.CHANNEL3_API_KEY;if(!key)throw new Channel3SearchError("configuration");const productId=input.product.channel3FamilyId;if(!productId)throw new Channel3SearchError("configuration");
    const batchId=randomUUID(),started=Date.now(),pool=this.deps.reserve?null:searchPool();await (this.deps.reserve??((id,entry)=>reserveChannel3Lookup(pool!,id,entry)))(batchId,input);
    let status="provider",count=0;try{const timeout=Number(process.env.CHANNEL3_EXACT_TIMEOUT_SECONDS??8);if(!Number.isSafeInteger(timeout)||timeout<1||timeout>20)throw new Channel3SearchError("configuration");
      const selected_options:Record<string,string>={Size:`EU${input.size}`};if(input.product.variant.color!=="Not verified")selected_options.Color=input.product.variant.color;
      const response=await (this.deps.retrieve??((request,options)=>new Channel3({apiKey:key}).products.retrieve(request,options)))({product_id:productId,country:"US",currency:"USD",selected_options},{timeoutInSeconds:timeout,maxRetries:0});
      const retrievedAt=new Date().toISOString(),offers=normalizeChannel3Offers(response,input,batchId,retrievedAt);status=offers.length?"success":"empty";count=offers.length;return{batchId,retrievedAt,productId:input.product.id,variantKey:input.variantKey,offers,status:status as "success"|"empty"};
    }catch(error){if(error instanceof Channel3SearchError){status=error.category;throw error;}const name=error instanceof Error?error.name:"";status=name==="TimeoutError"||name==="AbortError"?"timeout":"provider";throw new Channel3SearchError(status as "timeout"|"provider");}
    finally{const elapsed=Date.now()-started;try{await (this.deps.record??((id,s,c,ms)=>pool!.query("update channel3_live_lookup_batches set completed_at=now(),status=$2,result_count=$3,latency_ms=$4 where id=$1",[id,s,c,ms]).then(()=>{})))(batchId,status,count,elapsed);}catch{console.warn(JSON.stringify({event:"channel3_lookup_record_failure",category:"database"}));}console.info(JSON.stringify({event:"channel3_exact_lookup",status,resultCount:count,elapsedMs:elapsed}));}
  }
}
