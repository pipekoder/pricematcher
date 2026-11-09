import { afterEach,beforeEach,describe,expect,it,vi } from "vitest";
import { products } from "../catalog";
import { productVariantKey } from "./service";
import { GoogleSearchError,normalizeGoogleResults,SerpApiGoogleShopping,type GoogleSearchInput } from "./google-shopping";

const product=products[0];
const input:GoogleSearchInput={product,variantKey:productVariantKey(product,38),size:38,sessionId:"11c22712-8890-47ed-92f7-aed7bcfc9532"};
const listing=(overrides:Record<string,unknown>={})=>({title:`${product.brand} ${product.name} EU 38`,source:"Example Shoes",price:"$129.95",extracted_price:129.95,link:"https://example.com/shoes",product_id:"google-1",...overrides});
const original:Record<string,string|undefined>={};
beforeEach(()=>{for(const key of ["GOOGLE_SHOPPING_ENABLED","SERPAPI_API_KEY","GOOGLE_SHOPPING_REQUEST_TIMEOUT_MS"])original[key]=process.env[key];process.env.GOOGLE_SHOPPING_ENABLED="1";process.env.SERPAPI_API_KEY="test-key";});
afterEach(()=>{for(const [key,value] of Object.entries(original)){if(value===undefined)delete process.env[key];else process.env[key]=value;}});

describe("SerpApi Google Shopping observations",()=>{
  it("normalizes shopping and explicitly tracked sponsored results without inventing stock or shipping",()=>{
    const offers=normalizeGoogleResults({shopping_results:[listing()],inline_shopping_results:[listing({source:"Sponsor",link:"https://sponsor.example/shoes",tracking_link:"https://www.google.com/aclk?ad=1"})]},input,"batch","2026-11-08T12:00:00Z");
    expect(offers).toHaveLength(2);
    expect(offers.map(item=>item.listingType)).toEqual(["shopping","sponsored_shopping"]);
    expect(offers[0]).toMatchObject({priceMinor:12995,currency:"USD",availability:"unknown",shippingMinor:null,mandatoryFeesMinor:null,matchStatus:"exact_variant",evidenceStatus:"observed_search_result"});
    expect(offers[1].merchantName).toBe("Sponsor");
  });
  it("keeps absent, misleading, or ambiguous prices unknown",()=>{
    const cases=[listing({price:"$0 now",extracted_price:0}),listing({price:"€129.95"}),listing({price:"$129.95",extracted_price:129.94}),listing({price:"$-1",extracted_price:-1}),listing({price:"$129.95",extracted_price:null})];
    expect(normalizeGoogleResults({shopping_results:cases},input,"batch","2026-11-08T12:00:00Z")).toEqual([]);
  });
  it("rejects contradictory sizes, preserves explicit out-of-stock, and de-duplicates identical listings",()=>{
    const offers=normalizeGoogleResults({shopping_results:[listing({title:`${product.brand} ${product.name} EU 39`,availability:"Out of stock"}),listing(),listing()]},input,"batch","2026-11-08T12:00:00Z");
    expect(offers).toHaveLength(1);
    expect(offers[0]).toMatchObject({matchStatus:"exact_variant",availability:"unknown"});
  });
  it("orders unknown, preorder and backorder below pricier in-stock listings without status preference",()=>{
    const offers=normalizeGoogleResults({shopping_results:[
      listing({source:"In stock",link:"https://example.com/stock",product_id:"stock",price:"$120.00",extracted_price:120,availability:"In stock"}),
      listing({source:"Unknown",link:"https://example.com/unknown",product_id:"unknown",price:"$90.00",extracted_price:90}),
      listing({source:"Preorder",link:"https://example.com/pre",product_id:"pre",price:"$80.00",extracted_price:80,availability:"Preorder"}),
      listing({source:"Backorder",link:"https://example.com/back",product_id:"back",price:"$70.00",extracted_price:70,availability:"Backorder"}),
    ]},input,"batch","2026-11-08T12:00:00Z");
    expect(offers.map(item=>[item.priceMinor,item.availability])).toEqual([[7000,"backorder"],[8000,"preorder"],[9000,"unknown"],[12000,"in_stock"]]);
  });
  it("excludes out of stock, mismatched products and sizes before ranking",()=>{
    const offers=normalizeGoogleResults({shopping_results:[
      listing({source:"Sold out",price:"$20.00",extracted_price:20,availability:"out_of_stock"}),
      listing({source:"Wrong model",title:`${product.brand} Different Shoe EU 38`,price:"$30.00",extracted_price:30}),
      listing({source:"Wrong size",title:`${product.brand} ${product.name} EU 39`,price:"$40.00",extracted_price:40}),
      listing({source:"Wrong size field",size:"EU 39",price:"$45.00",extracted_price:45}),
      listing({source:"Wrong color",color:"Conflicting color",price:"$46.00",extracted_price:46}),
      listing({source:"Valid",price:"$50.00",extracted_price:50}),
    ]},input,"batch","2026-11-08T12:00:00Z");
    expect(offers.map(item=>item.priceMinor)).toEqual([5000]);
  });
  it("deduplicates organic and sponsored observations and retains the cheapest twenty of a bounded response",()=>{
    const rows=Array.from({length:25},(_,index)=>listing({source:`Seller ${index}`,link:`https://example.com/${index}`,product_id:`id-${index}`,price:`$${(100+index).toFixed(2)}`,extracted_price:100+index}));
    const offers=normalizeGoogleResults({shopping_results:[...rows,rows[0]],inline_shopping_results:[{...rows[0],tracking_link:"https://www.google.com/aclk?ad=1"}]},input,"batch","2026-11-08T12:00:00Z");
    expect(offers).toHaveLength(20);expect(offers.map(item=>item.priceMinor)).toEqual(Array.from({length:20},(_,index)=>(100+index)*100));
    expect(offers.filter(item=>item.priceMinor===10000)).toHaveLength(1);
  });
  it("does not label an inline listing sponsored without an explicit Google ad tracking link",()=>{
    const [offer]=normalizeGoogleResults({inline_shopping_results:[listing()]},input,"batch","2026-11-08T12:00:00Z");
    expect(offer.listingType).toBe("shopping");
  });
  it("uses one bounded, uncached US English request with a reserved budget and no retries",async()=>{
    const reserve=vi.fn(async()=>{}),record=vi.fn(async()=>{}),fetchMock=vi.fn(async(url:URL)=>{expect(url.searchParams.get("engine")).toBe("google_shopping");expect(url.searchParams.get("gl")).toBe("us");expect(url.searchParams.get("hl")).toBe("en");expect(url.searchParams.get("no_cache")).toBe("true");expect(url.searchParams.get("q")).toContain("EU 38");return new Response(JSON.stringify({shopping_results:[listing()]}),{status:200});});
    const result=await new SerpApiGoogleShopping({reserve,record,fetch:fetchMock as unknown as typeof fetch}).search(input);
    expect(result.status).toBe("success");expect(fetchMock).toHaveBeenCalledTimes(1);expect(reserve).toHaveBeenCalledOnce();expect(record).toHaveBeenCalledWith(result.batchId,"success",1,0,expect.any(Number));
  });
  it("fails closed on rate limit, malformed payload, timeout and exhausted budget",async()=>{
    const record=vi.fn(async()=>{});const reserve=vi.fn(async()=>{});
    await expect(new SerpApiGoogleShopping({reserve,record,fetch:async()=>new Response("",{status:429})}).search(input)).rejects.toMatchObject({category:"rate_limit"});
    await expect(new SerpApiGoogleShopping({reserve,record,fetch:async()=>new Response(JSON.stringify({shopping_results:{}}),{status:200})}).search(input)).rejects.toMatchObject({category:"malformed"});
    await expect(new SerpApiGoogleShopping({reserve,record,fetch:async()=>{throw new DOMException("timeout","TimeoutError");}}).search(input)).rejects.toMatchObject({category:"timeout"});
    const blocked=vi.fn(async()=>{throw new GoogleSearchError("budget");}),never=vi.fn();await expect(new SerpApiGoogleShopping({reserve:blocked,fetch:never}).search(input)).rejects.toMatchObject({category:"budget"});expect(never).not.toHaveBeenCalled();
  });
});
