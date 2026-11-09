import { describe,expect,it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { products } from "@/lib/catalog";
import { CartProvider } from "./cart-provider";
import { ProductCard } from "./product-card";
import { ProductQuickView } from "./product-quick-view";
import { PayPalCheckout } from "./paypal-checkout";

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
  });
});
