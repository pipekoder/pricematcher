import { createHash, randomUUID } from "node:crypto";
import type { Pool } from "pg";
import type { Product } from "../types";
import { getPersistence } from "../server/persistence";
import { PostgresPriceIntelligenceRepository } from "../persistence/postgres-repository";

export type GoogleMarketOffer={id:string;provider:"serpapi_google";listingType:"shopping"|"sponsored_shopping";searchBatchId:string;retrievedAt:string;merchantName:string|null;title:string;productUrl:string|null;googleProductId:string|null;priceMinor:number|null;currency:"USD"|null;brand:string|null;model:string|null;size:string|null;color:string|null;condition:string|null;availability:"in_stock"|"out_of_stock"|"preorder"|"backorder"|"unknown";shippingDescription:string|null;shippingMinor:number|null;mandatoryFeesMinor:number|null;matchStatus:"exact_variant"|"same_model"|"variant_mismatch"|"insufficient_evidence";matchConfidence:"high"|"medium"|"low";evidenceStatus:"observed_search_result"};
export type GoogleSearchResult={batchId:string;retrievedAt:string;productId:string;variantKey:string;offers:GoogleMarketOffer[];status:"success"|"empty"};
export type GoogleSearchInput={product:Product;variantKey:string;size:number;sessionId:string};
export interface MarketSearch {search(input:GoogleSearchInput):Promise<GoogleSearchResult>}
export class GoogleSearchError extends Error {constructor(readonly category:"disabled"|"budget"|"duplicate"|"timeout"|"rate_limit"|"provider"|"malformed"|"configuration"){super(category);}}
type RawListing=Record<string,unknown>;
const obj=(value:unknown):RawListing|null=>value&&typeof value==="object"&&!Array.isArray(value)?value as RawListing:null;
const string=(value:unknown):string|null=>typeof value==="string"&&value.trim()?value.trim():null;
const secureUrl=(value:unknown):string|null=>{const candidate=string(value);if(!candidate)return null;try{const url=new URL(candidate);return url.protocol==="https:"?url.toString():null;}catch{return null;}};
const normalized=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const cents=(price:unknown,extracted:unknown):number|null=>{const text=string(price);if(!text||!/^\$\s*(?:\d{1,3}(?:,\d{3})*|\d+)(?:\.\d{2})?$/.test(text))return null;const digits=text.replace(/[$,\s]/g,"");const [whole,fraction="00"]=digits.split(".");const minor=Number(whole)*100+Number(fraction);if(!Number.isSafeInteger(minor)||minor<=0||typeof extracted!=="number"||!Number.isFinite(extracted)||Math.abs(extracted*100-minor)>0.000001)return null;return minor;};
function explicitSize(title:string):number|null{const match=title.match(/\bEU\s*(3[7-9]|4[0-5])\b/i);return match?Number(match[1]):null;}
function matchListing(product:Product,size:number,title:string):Pick<GoogleMarketOffer,"matchStatus"|"matchConfidence">{
  const text=normalized(title),brand=normalized(product.brand),model=normalized(product.model);
  if(!text.includes(brand)||!model.split(" ").filter(word=>word.length>2).every(word=>text.includes(word)))return{matchStatus:"insufficient_evidence",matchConfidence:"low"};
  const stated=explicitSize(title);if(stated!==null&&stated!==size)return{matchStatus:"variant_mismatch",matchConfidence:"low"};
  return stated===size?{matchStatus:"exact_variant",matchConfidence:"high"}:{matchStatus:"same_model",matchConfidence:"medium"};
}
export function normalizeGoogleResults(payload:unknown,input:GoogleSearchInput,batchId:string,retrievedAt:string):GoogleMarketOffer[]{
  const root=obj(payload);if(!root)throw new GoogleSearchError("malformed");
  const collections:[unknown,"shopping"|"inline"][]=[[root.shopping_results,"shopping"],[root.inline_shopping_results,"inline"]];
  const output:GoogleMarketOffer[]=[],seen=new Set<string>();
  for(const [collection,kind] of collections){if(collection!==undefined&&!Array.isArray(collection))throw new GoogleSearchError("malformed");for(const raw of (collection??[]) as unknown[]){const row=obj(raw);if(!row)continue;const title=string(row.title);if(!title)continue;const merchantName=string(row.source),productUrl=secureUrl(row.link)??secureUrl(row.product_link);const amount=cents(row.price,row.extracted_price);const googleProductId=string(row.product_id);const tracking=secureUrl(row.tracking_link);const host=tracking?new URL(tracking).hostname:"";const sponsored=kind==="inline"&&(host==="google.com"||host.endsWith(".google.com"))&&new URL(tracking!).pathname==="/aclk";
    const listingType=sponsored?"sponsored_shopping":"shopping";const identity=`${merchantName??""}|${productUrl??""}|${googleProductId??""}|${normalized(title)}|${amount??""}|${listingType}`;if(seen.has(identity))continue;seen.add(identity);
    const stock=string(row.availability)?.toLowerCase();const availability=stock==="in stock"||stock==="in_stock"?"in_stock":stock==="out of stock"||stock==="out_of_stock"?"out_of_stock":stock==="preorder"?"preorder":stock==="backorder"?"backorder":"unknown";
    const condition=string(row.second_hand_condition)??string(row.condition);const description=string(row.delivery)??string(row.shipping);
    output.push({id:createHash("sha256").update(`${batchId}|${identity}`).digest("hex").slice(0,32),provider:"serpapi_google",listingType,searchBatchId:batchId,retrievedAt,merchantName,title,productUrl,googleProductId,priceMinor:amount,currency:amount===null?null:"USD",brand:title.toLowerCase().includes(input.product.brand.toLowerCase())?input.product.brand:null,model:null,size:explicitSize(title)===null?null:`EU${explicitSize(title)}`,color:null,condition,availability,shippingDescription:description,shippingMinor:null,mandatoryFeesMinor:null,...matchListing(input.product,input.size,title),evidenceStatus:"observed_search_result"});
    if(output.length>=20)return output;
  }}return output;
}
function searchPool():Pool{const persistence=getPersistence();if(process.env.APP_ENV!=="production"||persistence.backend!=="postgres"||!(persistence.offers instanceof PostgresPriceIntelligenceRepository))throw new GoogleSearchError("configuration");return persistence.offers.pool;}
export async function reserveGoogleSearch(pool:Pool,batchId:string,input:GoogleSearchInput){
  const limit=Number(process.env.GOOGLE_SHOPPING_MAX_SEARCHES_PER_DAY??10);if(!Number.isSafeInteger(limit)||limit<1||limit>1000)throw new GoogleSearchError("configuration");
  const client=await pool.connect();try{
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(hashtextextended($1,0))",[`google-shopping:${input.sessionId}:${input.product.id}:${input.variantKey}`]);
    const recent=await client.query("select id from google_shopping_search_batches where session_id=$1 and product_id=$2 and variant_key=$3 and requested_at>now()-interval '5 seconds' limit 1",[input.sessionId,input.product.id,input.variantKey]);
    if(recent.rowCount)throw new GoogleSearchError("duplicate");
    const result=await client.query("insert into google_shopping_daily_budget(day,request_count) select current_date,1 where $1::integer>=1 on conflict(day) do update set request_count=google_shopping_daily_budget.request_count+1 where google_shopping_daily_budget.request_count<$1 returning request_count",[limit]);
    if(!result.rowCount)throw new GoogleSearchError("budget");
    await client.query("insert into google_shopping_search_batches(id,session_id,product_id,variant_key,provider,requested_at,status) values($1,$2,$3,$4,'serpapi_google',now(),'reserved')",[batchId,input.sessionId,input.product.id,input.variantKey]);
    await client.query("commit");
  }catch(error){await client.query("rollback");throw error;}finally{client.release();}
}
export class SerpApiGoogleShopping implements MarketSearch {
  constructor(private readonly deps:{fetch?:typeof fetch;reserve?:(batchId:string,input:GoogleSearchInput)=>Promise<void>;record?:(batchId:string,status:string,count:number,sponsored:number,latencyMs:number)=>Promise<void>}={}){}
  async search(input:GoogleSearchInput):Promise<GoogleSearchResult>{
    if(process.env.GOOGLE_SHOPPING_ENABLED!=="1")throw new GoogleSearchError("disabled");const key=process.env.SERPAPI_API_KEY;if(!key)throw new GoogleSearchError("configuration");
    const batchId=randomUUID(),started=Date.now();const pool=this.deps.reserve?null:searchPool();
    await (this.deps.reserve??((id,entry)=>reserveGoogleSearch(pool!,id,entry)))(batchId,input);
    let status="provider",count=0,sponsored=0;
    try{const timeout=Number(process.env.GOOGLE_SHOPPING_REQUEST_TIMEOUT_MS??10000);if(!Number.isSafeInteger(timeout)||timeout<1000||timeout>20000)throw new GoogleSearchError("configuration");
      const query=[input.product.brand,input.product.model,`EU ${input.size}`,input.product.variant.color!=="Not verified"?input.product.variant.color:""].filter(Boolean).join(" ").slice(0,180);
      const url=new URL("https://serpapi.com/search.json");for(const [name,value] of Object.entries({engine:"google_shopping",q:query,gl:"us",hl:"en",no_cache:"true",api_key:key}))url.searchParams.set(name,value);
      const response=await (this.deps.fetch??fetch)(url,{signal:AbortSignal.timeout(timeout),cache:"no-store"});
      if(response.status===429)throw new GoogleSearchError("rate_limit");if(!response.ok)throw new GoogleSearchError("provider");
      const payload:unknown=await response.json();if(!obj(payload)||string(obj(payload)?.error))throw new GoogleSearchError("provider");
      const providerStatus=string(obj(obj(payload)?.search_metadata)?.status);if(providerStatus&&providerStatus!=="Success")throw new GoogleSearchError("provider");
      const observedAt=new Date().toISOString(),offers=normalizeGoogleResults(payload,input,batchId,observedAt);status=offers.length?"success":"empty";count=offers.length;sponsored=offers.filter(item=>item.listingType==="sponsored_shopping").length;
      return{batchId,retrievedAt:observedAt,productId:input.product.id,variantKey:input.variantKey,offers,status:status as "success"|"empty"};
    }catch(error){if(error instanceof GoogleSearchError){status=error.category;throw error;}status=error instanceof Error&&error.name==="TimeoutError"?"timeout":"provider";throw new GoogleSearchError(status as "timeout"|"provider");}
    finally{const elapsed=Date.now()-started;try{await (this.deps.record??((id,s,c,a,ms)=>pool!.query("update google_shopping_search_batches set completed_at=now(),status=$2,result_count=$3,sponsored_count=$4,latency_ms=$5 where id=$1",[id,s,c,a,ms]).then(()=>{})))(batchId,status,count,sponsored,elapsed);}catch{console.warn(JSON.stringify({event:"google_shopping_record_failure",category:"database"}));}console.info(JSON.stringify({event:"google_shopping_search",status,resultCount:count,sponsoredCount:sponsored,elapsedMs:elapsed}));}
  }
}
