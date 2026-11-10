import { describe,expect,it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
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
    expect(modal).toContain('role="dialog"');expect(modal).toContain("simulated availability");expect(modal).toContain("lucide-plus");expect(modal).toContain(" EU 37");expect(modal).not.toContain("Add to Bag");expect(modal).toContain(`/product/${products[0].id}`);
  });
  it("does not claim payment is ready before server authorization, but supports original price",()=>{
    const loading=renderToStaticMarkup(<PayPalCheckout cart={[]} authorizationLoading/>);
    expect(loading).toContain("Preparing secure original-price checkout");expect(loading).toContain("disabled");
    const original=renderToStaticMarkup(<PayPalCheckout offerId="server-original" cart={[]} priceMode="original"/>);
    expect(original).toContain("Pay with PayPal");expect(original).not.toContain("No price check is required");expect(original).not.toContain('button type="button" class="button primary large" disabled');
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
  it("retains the requested SOLE visual and checkout copy contracts",()=>{
    const read=(path:string)=>readFileSync(join(process.cwd(),path),"utf8");
    const css=read("app/globals.css");
    const ux=read("app/storefront-ux.css");
    const checkout=read("app/checkout/page.tsx");
    const priceCheck=read("components/cart-price-check.tsx");
    const offerCss=read("app/checkout/checkout.css");
    expect(css).toContain(".demo-hero{display:grid;grid-template-columns:1fr 1fr;min-height:540px;background:#ff3c00");
    expect(css).toContain(".demo-hero .eyebrow,.demo-hero-copy>p:not(.eyebrow){color:#fff}");
    expect(css).toContain(".demo-final-note{display:flex;align-items:center;gap:28px;padding:65px 7vw;background:#ff3c00");
    expect(ux).toContain(".demo-hero h1 span{display:block;white-space:nowrap}");
    expect(ux).toContain(".offer-card .offer-countdown{margin-bottom:10px}");
    expect(ux).toContain("@media(max-width:520px){.deal-progress-stages{grid-template-columns:1fr}}");
    expect(ux).toContain(".bag-drawer .quantity button{border:0");
    expect(ux).toContain(".checkout-section h2{font-size:clamp(21px,calc(3vw - 4px),32px);letter-spacing:-.015em");
    expect(checkout).not.toContain('<h1 className="page-title">Checkout</h1>');
    expect(checkout).toContain("01/ Review your order");
    expect(checkout).toContain("02/ Price Matching check");
    expect(checkout).toContain("03/ PayPal Payment (Sandbox only)");
    expect(priceCheck).toContain("Deal Engine’s offer");
    expect(priceCheck).not.toContain("New offer by Deal Engine");
    expect(priceCheck).toContain("Accept the offer");
    expect(priceCheck).not.toContain("Accept Deal Engine offer");
    expect(offerCss).toContain(".checkout-page .offer-card .offer-accept,");
    expect(offerCss).toContain(".checkout-page .offer-card .offer-recheck{display:flex;width:100%");
  });

});
