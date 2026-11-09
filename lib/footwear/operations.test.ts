import { describe, expect, it } from "vitest";
import { products } from "../catalog";
import { productOperations, simulatedInventoryMovements, simulatedPriceHistory, simulatedTransactions, virtualSkus } from "./operations";
import { footwearSnapshots, selectSavedPrice } from "./snapshot";

describe("reproducible simulated retail ledger", () => {
  it("shows only the seven requested brands with real saved product images and size SKUs", () => {
    expect(new Set(products.map(product => product.brand))).toEqual(new Set(["Puma","New Balance","Reebok","ASICS","The North Face","Nike","adidas"]));
    expect(products).toHaveLength(19);
    expect(footwearSnapshots.every(snapshot => snapshot.image.startsWith("https://") && snapshot.marketOffers.length > 0)).toBe(true);
    expect(products.every(product => !product.image.startsWith("/products/") && virtualSkus.filter(sku => sku.productId === product.id).length === 9)).toBe(true);
    expect(footwearSnapshots.every(snapshot => snapshot.marketMinor === snapshot.marketOffers[Math.floor((snapshot.marketOffers.length-1)/2)].priceMinor)).toBe(true);
    for(const snapshot of footwearSnapshots){
      const product=products.find(item=>item.id===`footwear-${snapshot.id}`)!;
      expect(product.price).toEqual({amountMinor:snapshot.priceReference.priceMinor,currency:"USD"});
      expect(snapshot.priceReference).toMatchObject({productId:snapshot.id,currency:"USD",provider:"channel3_saved",observedMerchant:snapshot.marketDomain,observedUrl:snapshot.sourceUrl,observedAt:snapshot.retrievedAt});
      expect(snapshot.priceReference.priceMinor).toBeGreaterThan(0);
      expect(virtualSkus.filter(sku=>sku.productId===product.id).every(sku=>sku.retailMinor===product.price.amountMinor)).toBe(true);
    }
  });
  it("selects a saved offer deterministically and rejects missing or ambiguous prices",()=>{
    const offers=[
      {domain:"z.example",url:"https://z.example/shoe",price:{price:80,currency:"USD"},availability:"InStock",condition:"new"},
      {domain:"a.example",url:"https://a.example/shoe",price:{price:80,currency:"USD"},availability:"InStock",condition:"new"},
      {domain:"cheap.example",url:"https://cheap.example/shoe",price:{price:1.001,currency:"USD"},availability:"InStock",condition:"new"},
    ];
    expect(selectSavedPrice("shoe","2026-11-08T00:00:00Z",offers).observedMerchant).toBe("a.example");
    expect(selectSavedPrice("shoe","2026-11-08T00:00:00Z",[...offers].reverse()).priceMinor).toBe(8000);
    expect(selectSavedPrice("shoe","2026-11-08T00:00:00Z",[
      {domain:"low.example",url:"https://low.example/shoe",price:{price:50,currency:"USD"},availability:"InStock",condition:"new"},
      ...offers,
      {domain:"high.example",url:"https://high.example/shoe",price:{price:120,currency:"USD"},availability:"InStock",condition:"new"},
    ]).priceMinor).toBe(8000);
    expect(()=>selectSavedPrice("shoe","2026-11-08T00:00:00Z",offers.slice(2))).toThrow("No eligible saved Channel3 USD price");
    expect(()=>selectSavedPrice("shoe","invalid",offers)).toThrow("retrieval time");
  });
  it("reconciles SKU and product inventory after sales and returns", () => {
    for (const sku of virtualSkus) {
      expect(simulatedInventoryMovements.filter(item => item.sku === sku.sku).reduce((sum,item) => sum + item.units,0)).toBe(sku.stock);
    }
    for (const product of products) {
      expect(productOperations(product.id).stock).toBe(virtualSkus.filter(sku => sku.productId === product.id).reduce((sum,sku) => sum + sku.stock,0));
    }
  });
  it("bounds sales and price history to their labeled windows", () => {
    expect(simulatedTransactions.every(item => item.day >= 0 && item.day <= 60)).toBe(true);
    expect(simulatedPriceHistory.every(item => item.dayAgo >= 0 && item.dayAgo <= 90)).toBe(true);
    expect(simulatedTransactions.some(item => item.kind === "return")).toBe(true);
  });
});
