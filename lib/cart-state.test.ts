import { describe,expect,it } from "vitest";
import { products } from "./catalog";
import { skuKey, virtualSkus } from "./footwear/operations";
import { cartCount,validateCartItems } from "./cart-state";
describe("versioned cart migration",()=>{it("keeps valid SKU selections and removes incompatible legacy products from bag and badge",()=>{const available=virtualSkus.find(sku=>sku.stock>=2)!;const current=skuKey(available.productId,available.size);const cart=validateCartItems({"nord-sound-2":4,[products[0].id]:1,[current]:2});expect(cart).toEqual({[current]:2});expect(cartCount(cart)).toBe(2);});it("rejects invalid quantities and clamps oversized counts to SKU stock",()=>{const [first,second]=virtualSkus.filter(sku=>sku.stock>0);const firstKey=skuKey(first.productId,first.size),secondKey=skuKey(second.productId,second.size);expect(validateCartItems({version:2,items:{[firstKey]:-1,[secondKey]:99}})).toEqual({[secondKey]:Math.min(second.stock,9)});});});
