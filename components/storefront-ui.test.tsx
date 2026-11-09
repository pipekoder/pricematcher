import { describe,expect,it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { products } from "@/lib/catalog";
import { CartProvider } from "./cart-provider";
import { ProductCard } from "./product-card";
import { ProductQuickView } from "./product-quick-view";
import { PayPalCheckout } from "./paypal-checkout";
import { CartPriceCheck } from "./cart-price-check";

describe("SOLE storefront and checkout UI",()=>{
  it("opens products through quick-view controls while retaining direct product URLs",()=>{
    const card=renderToStaticMarkup(<CartProvider><ProductCard product={products[0]}/></CartProvider>);
    expect(card).toContain("Quick view");expect(card).toContain("Choose size");expect(card).not.toContain('href="/product/');
    const modal=renderToStaticMarkup(<CartProvider><ProductQuickView product={products[0]} onClose={()=>{}}/></CartProvider>);
    expect(modal).toContain('role="dialog"');expect(modal).toContain("simulated availability");expect(modal).toContain("Add to Bag");expect(modal).toContain(`/product/${products[0].id}`);
  });
  it("does not claim payment is ready before server authorization, but supports original price",()=>{
    const loading=renderToStaticMarkup(<PayPalCheckout cart={[]} authorizationLoading/>);
    expect(loading).toContain("Preparing secure original-price checkout");expect(loading).toContain("disabled");
    const original=renderToStaticMarkup(<PayPalCheckout offerId="server-original" cart={[]} priceMode="original"/>);
    expect(original).toContain("No price check is required");expect(original).not.toContain('button type="button" class="button primary large" disabled');
    expect(original).not.toContain("<strong>PayPal Sandbox checkout</strong>");
  });
  it("presents Deal Engine as a simple checkout action without changing its authorization gate",()=>{
    const unavailable=renderToStaticMarkup(<CartPriceCheck cart={[]} onAccepted={()=>{}} canCheckPrices={false}/>);
    expect(unavailable).toContain("Start Deal Engine");
    expect(unavailable).toContain("disabled");
    expect(unavailable).not.toContain("Customer-initiated comparison");
    const available=renderToStaticMarkup(<CartPriceCheck cart={[]} onAccepted={()=>{}} canCheckPrices/>);
    expect(available).toContain("Start Deal Engine");
    expect(available).not.toContain('class="button primary large" disabled');
  });
});
