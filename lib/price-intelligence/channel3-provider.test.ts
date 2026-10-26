import { describe,expect,it,vi } from "vitest";
import { getProduct } from "../catalog";
import { Channel3PriceProvider } from "./channel3-provider";

const candidate={id:"c3-product",title:"Auralis Nord Sound 2 — Midnight",brands:[{id:"brand",name:"Auralis"}],structured_attributes:{color:["Midnight"]},variants:{options:[],selected:[{name:"Color",label:"Midnight"}]},offers:[{url:"https://retailer.example/nord",domain:"retailer.example",price:{price:139,currency:"USD"},availability:"InStock",condition:"new"}]};

describe("Channel3 live adapter",()=>{
  it("uses documented semantic search with bounded refresh, timeout and no retries",async()=>{const search=vi.fn().mockResolvedValue({data:[candidate]});const provider=new Channel3PriceProvider("test-key",()=>new Date("2026-10-25T12:00:00Z"),undefined,{products:{search}},7,5);const results=await provider.search(getProduct("nord-sound-2")!);expect(search).toHaveBeenCalledWith(expect.objectContaining({limit:5,config:expect.objectContaining({mode:"default",offer_refresh_timeout_ms:3000,country:"US",currency:"USD"})}),{timeoutInSeconds:7,maxRetries:0});expect(results[0]).toMatchObject({sourceType:"live",shipping:null,fees:null,deliveredCostSource:"unknown",availability:"in_stock",color:"Midnight"});});
  it("caches identical searches and enforces the local request budget",async()=>{const search=vi.fn().mockResolvedValue({data:[candidate]});const provider=new Channel3PriceProvider("test-key",()=>new Date("2026-10-25T12:00:00Z"),undefined,{products:{search}},8,1);const product=getProduct("nord-sound-2")!;await provider.search(product);await provider.search(product);expect(search).toHaveBeenCalledTimes(1);await expect(provider.search(getProduct("arc-lamp")!)).rejects.toThrow("CHANNEL3_RATE_LIMIT");});
});
