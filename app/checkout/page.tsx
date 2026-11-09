"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PayPalCheckout } from "@/components/paypal-checkout";
import { CartPriceCheck } from "@/components/cart-price-check";
import { useCart } from "@/components/cart-provider";
import type { AcceptedOfferSummary } from "@/lib/checkout-summary";
import { footwearCartLines } from "@/lib/footwear/cart-lines";
import { formatMoney } from "@/lib/format";
import "./checkout.css";

export default function CheckoutPage() {
  const [acceptedState, setAcceptedState] = useState<{ offer: AcceptedOfferSummary; cartKey: string; cartRevision:number }>();
  const [offerNotice, setOfferNotice] = useState<"expired" | "invalid">();
  const [comparisonKey, setComparisonKey] = useState(0);
  const [originalLoading,setOriginalLoading]=useState(false);const[originalError,setOriginalError]=useState("");
  const { items, count,revision } = useCart();
  const cartKey = Object.entries(items).sort(([a],[b])=>a.localeCompare(b)).map(([key,quantity])=>`${key}:${quantity}`).join("|");
  const lines = useMemo(() => footwearCartLines(items), [items]);
  const cart = useMemo(() => lines.map(({product,variantKey,quantity}) => ({ productId: product.id, variantKey, quantity })), [lines]);

  const subtotal = lines.reduce((sum, {product,quantity}) => sum + product.price.amountMinor * quantity, 0);
  const shipping = subtotal >= 7500 ? 0 : 590;
  const tax = 0;
  const originalTotal = subtotal + shipping + tax;

  const acceptedOffer = acceptedState?.cartKey === cartKey&&acceptedState.cartRevision===revision ? acceptedState.offer : undefined;
  const visibleNotice = offerNotice ?? (acceptedState && !acceptedOffer ? "invalid" : undefined);
  useEffect(() => {
    if (!acceptedOffer) return;
    const delay = Math.max(0, new Date(acceptedOffer.expiresAt).getTime() - Date.now());
    const timer = window.setTimeout(() => { setAcceptedState(undefined); setOfferNotice("expired"); setComparisonKey((key) => key + 1); }, delay);
    return () => window.clearTimeout(timer);
  }, [acceptedOffer]);
  function acceptOffer(offer?: AcceptedOfferSummary) { setAcceptedState(offer ? { offer, cartKey,cartRevision:revision } : undefined); setOfferNotice(undefined); }
  function invalidateOffer(reason: "expired" | "invalid") { setAcceptedState(undefined); setOfferNotice(reason); setComparisonKey((key) => key + 1); }
  async function continueOriginal(){setOriginalLoading(true);setOriginalError("");setAcceptedState(undefined);try{const response=await fetch("/api/offers/original",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({cart})});const body=await response.json();if(!response.ok||!body.summary)throw new Error(body.error??"Original-price checkout unavailable");setAcceptedState({offer:body.summary,cartKey,cartRevision:revision});setOfferNotice(undefined);}catch(error){setOriginalError(error instanceof Error?error.message:"Original-price checkout unavailable");}finally{setOriginalLoading(false);}}

  if (!count) return <div className="empty-state"><p className="eyebrow">Checkout</p><h1>Your bag is empty.</h1><p>A price check is only available for a product you choose.</p><Link className="button primary" href="/">Browse products</Link></div>;

  return <div className="page-shell"><div className="breadcrumb">Bag / Checkout</div><h1 className="page-title">Checkout</h1><div className="checkout-pm-banner"><strong>Check for your PriceMatcher offer here.</strong><p>Click “Check prices” to request an eligible merchant-authorized offer for the exact sizes in your bag. A discount is not guaranteed. The product-page market difference is only a reference; you can always keep the original price.</p></div><div className="checkout-layout"><section className="checkout-main">
    {visibleNotice && <div className="offer-expired" role="alert"><strong>{visibleNotice === "expired" ? "Your PriceMatcher offer has expired." : "Your PriceMatcher offer is no longer valid."}</strong><p>{visibleNotice === "expired" ? "A fresh comparison is required before checkout." : "Your cart or authorized offer changed. Check the price again to continue."}</p><button className="button primary" onClick={() => { setAcceptedState(undefined); setOfferNotice(undefined); setComparisonKey((key) => key + 1); }}>Check price again</button></div>}
    <CartPriceCheck key={`${comparisonKey}:${cartKey}`} cart={cart} onAccepted={acceptOffer} />
    <div className="trust-note"><strong>Prefer the original price?</strong><br />Comparison is optional. You can continue without checking or accepting an offer.</div>
    {!acceptedOffer&&<div className="original-checkout"><button className="button secondary large" disabled={originalLoading} onClick={continueOriginal}>{originalLoading?"Authorizing current cart…":"Continue at original price"}</button>{originalError&&<p role="alert">{originalError}</p>}</div>}
    <PayPalCheckout key={`${acceptedOffer?.offerId ?? "none"}:${cartKey}`} offerId={acceptedOffer?.offerId} cart={cart} onOfferInvalidated={invalidateOffer} />
  </section><aside className="summary"><h2>Order summary</h2>
    {lines.map(({key,product,quantity,sku}) => <div className="summary-row" key={key}><span>{quantity} × {product.name} · EU {sku.size}</span><span>{formatMoney({ amountMinor: product.price.amountMinor * quantity, currency: "USD" })}</span></div>)}
    <div className="summary-row"><span>Original subtotal</span><span>{formatMoney(acceptedOffer?.originalSubtotal ?? { amountMinor: subtotal, currency: "USD" })}</span></div>
    <div className="summary-row"><span>Shipping</span><span>{(acceptedOffer?.shipping.amountMinor ?? shipping) ? formatMoney(acceptedOffer?.shipping ?? { amountMinor: shipping, currency: "USD" }) : "Free"}</span></div>
    <div className="summary-row"><span>Tax</span><span>{formatMoney(acceptedOffer?.tax ?? { amountMinor: tax, currency: "USD" })}</span></div>
    {acceptedOffer && <><div className="summary-row original-total"><span>Original total</span><span>{formatMoney(acceptedOffer.originalTotal)}</span></div>{acceptedOffer.savings.amountMinor>0&&<div className="summary-row savings"><strong>PriceMatcher savings</strong><strong>−{formatMoney(acceptedOffer.savings)}</strong></div>}<div className="summary-row total authorized-total"><strong>Total to pay</strong><strong>{formatMoney(acceptedOffer.totalToPay)}</strong></div></>}
    {!acceptedOffer && <div className="summary-row total"><strong>Original total</strong><strong>{formatMoney({ amountMinor: originalTotal, currency: "USD" })}</strong></div>}
    <p className="subhead">All amounts are USD. NORTH/01 store prices and operations are simulated; Channel3 merchant offers are observed product prices, not verified retailer checkout totals. Payment is PayPal Sandbox only.</p>
  </aside></div></div>;
}
