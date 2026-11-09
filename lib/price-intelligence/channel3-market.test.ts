import { describe,expect,it,vi } from "vitest";
import type { Channel3Api } from "@channel3/sdk";
import { products } from "../catalog";
import { Channel3ExactMarketSearch, normalizeChannel3Offers, type Channel3SearchInput } from "./channel3-market";

const product=products[0];
const input:Channel3SearchInput={product,variantKey:`${product.sku}:${product.variant.color}:EU38:new`,size:38,sessionId:"11c22712-8890-47ed-92f7-aed7bcfc9532"};
const offer=(domain:string,price:number,availability:string="InStock")=>({domain,url:`https://${domain}/shoe`,price:{price,currency:"USD"},availability,condition:"new"});
const response=(offers:unknown[],selected:Array<{name:string;label:string}>=[]):Channel3Api.Product=>({id:product.channel3FamilyId!,title:product.model,brands:[{name:product.brand}],offers,variants:{selected}} as Channel3Api.Product);

describe("exact Channel3 product offer lookup",()=>{
  it("requests the saved ID, size and color exactly once with zero retries",async()=>{
    const retrieve=vi.fn(async()=>response([offer("shop.example",80)]));
    const prior=process.env.CHANNEL3_EXACT_LOOKUP_ENABLED,key=process.env.CHANNEL3_API_KEY;
    process.env.CHANNEL3_EXACT_LOOKUP_ENABLED="1";process.env.CHANNEL3_API_KEY="mock-only";
    try{const search=new Channel3ExactMarketSearch({retrieve,reserve:async()=>{},record:async()=>{}});const result=await search.search(input);expect(result.offers).toHaveLength(1);expect(retrieve).toHaveBeenCalledOnce();expect(retrieve).toHaveBeenCalledWith({product_id:product.channel3FamilyId,country:"US",currency:"USD",selected_options:{Size:"EU38",Color:product.variant.color}},{timeoutInSeconds:8,maxRetries:0});}finally{if(prior===undefined)delete process.env.CHANNEL3_EXACT_LOOKUP_ENABLED;else process.env.CHANNEL3_EXACT_LOOKUP_ENABLED=prior;if(key===undefined)delete process.env.CHANNEL3_API_KEY;else process.env.CHANNEL3_API_KEY=key;}
  });
  it("sorts lowest first, deduplicates, excludes bad prices and explicit out of stock, caps at 20",()=>{
    const rows=[offer("known.example",100),offer("unknown.example",80,"Unknown"),offer("pre.example",90,"Preorder"),offer("back.example",85,"Backorder"),offer("oos.example",1,"OutOfStock"),offer("unknown.example",80,"Unknown"),offer("foreign.example",5)];
    (rows.at(-1)!.price as {currency:string}).currency="EUR";
    for(let i=0;i<25;i++)rows.push(offer(`shop${i}.example`,120+i));
    const result=normalizeChannel3Offers(response(rows),input,"batch","2026-11-09T00:00:00Z");
    expect(result).toHaveLength(20);expect(result.slice(0,4).map(item=>[item.priceMinor,item.availability])).toEqual([[8000,"unknown"],[8500,"backorder"],[9000,"preorder"],[10000,"in_stock"]]);
  });
  it("rejects an incorrect product or explicitly conflicting selected size and color",()=>{
    expect(()=>normalizeChannel3Offers({...response([]),id:"wrong"},input,"batch","2026-11-09T00:00:00Z")).toThrow("malformed");
    expect(normalizeChannel3Offers(response([offer("shop.example",80)],[{name:"Size",label:"EU 38"}]),input,"batch","2026-11-09T00:00:00Z")[0].matchStatus).toBe("exact_variant");
    expect(normalizeChannel3Offers(response([offer("shop.example",80)],[{name:"Size",label:"EU40"}]),input,"batch","2026-11-09T00:00:00Z")).toEqual([]);
    expect(normalizeChannel3Offers(response([offer("shop.example",80)],[{name:"Color",label:"Different"}]),input,"batch","2026-11-09T00:00:00Z")).toEqual([]);
  });
});
