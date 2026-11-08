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
    expect(normalizeGoogleResults({shopping_results:cases},input,"batch","2026-11-08T12:00:00Z").every(item=>item.priceMinor===null&&item.currency===null)).toBe(true);
  });
  it("rejects contradictory sizes, preserves explicit out-of-stock, and de-duplicates identical listings",()=>{
    const offers=normalizeGoogleResults({shopping_results:[listing({title:`${product.brand} ${product.name} EU 39`,availability:"Out of stock"}),listing(),listing()]},input,"batch","2026-11-08T12:00:00Z");
    expect(offers).toHaveLength(2);
    expect(offers[0]).toMatchObject({matchStatus:"variant_mismatch",availability:"out_of_stock"});
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
