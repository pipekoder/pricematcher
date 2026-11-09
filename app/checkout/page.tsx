"use client";

import Link from "next/link";
import { useEffect,useMemo,useState } from "react";
import { PayPalCheckout } from "@/components/paypal-checkout";
import { CartPriceCheck } from "@/components/cart-price-check";
import { useCart } from "@/components/cart-provider";
import type { AcceptedOfferSummary } from "@/lib/checkout-summary";
import { checkoutOfferForCart,type BoundCheckoutSummary } from "@/lib/checkout-ux";
import { footwearCartLines } from "@/lib/footwear/cart-lines";
import { formatMoney } from "@/lib/format";
import "./checkout.css";

function millisecondsUntil(expiresAt:string){return Math.max(0,Date.parse(expiresAt)-Date.now());}

export default function CheckoutPage(){
  const {items,count,revision}=useCart();
  const [acceptedState,setAcceptedState]=useState<BoundCheckoutSummary>();
  const [originalState,setOriginalState]=useState<BoundCheckoutSummary>();
  const [originalError,setOriginalError]=useState("");
  const [originalEpoch,setOriginalEpoch]=useState(0);
  const [offerNotice,setOfferNotice]=useState<"expired"|"invalid">();
  const [comparisonKey,setComparisonKey]=useState(0);
  const cartKey=Object.entries(items).sort(([a],[b])=>a.localeCompare(b)).map(([key,quantity])=>`${key}:${quantity}`).join("|");
  const lines=useMemo(()=>footwearCartLines(items),[items]);
  const cart=useMemo(()=>lines.map(({product,variantKey,quantity})=>({productId:product.id,variantKey,quantity})),[lines]);
  const subtotal=lines.reduce((sum,{product,quantity})=>sum+product.price.amountMinor*quantity,0);
  const shipping=subtotal>=7500?0:590;
  const originalTotal=subtotal+shipping;
  const {acceptedOffer,originalOffer,payableOffer}=checkoutOfferForCart(cartKey,revision,acceptedState,originalState);
  const visibleNotice=offerNotice??(acceptedState&&!acceptedOffer?"invalid":undefined);

  useEffect(()=>{
    if(!cart.length)return;
    const controller=new AbortController();
    // An original-price authorization is independent of market discovery and AI.
    const authorize=async()=>{
      try{
        const response=await fetch("/api/offers/original",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({cart}),signal:controller.signal});
        const body=await response.json();
        if(!response.ok||!body.summary)throw new Error(body.error??"Original-price checkout unavailable");
        if(!controller.signal.aborted){setOriginalState({offer:body.summary,cartKey,revision});setOriginalError("");}
      }catch(error){if(!controller.signal.aborted)setOriginalError(error instanceof Error?error.message:"Original-price checkout unavailable");}
    };
    void authorize();
    return()=>controller.abort();
  },[cart,cartKey,revision,originalEpoch]);
  useEffect(()=>{
    if(!acceptedOffer)return;
    const delay=millisecondsUntil(acceptedOffer.expiresAt);
    const timer=window.setTimeout(()=>{setAcceptedState(undefined);setOfferNotice("expired");setComparisonKey(value=>value+1);},delay);
    return()=>window.clearTimeout(timer);
  },[acceptedOffer]);
  useEffect(()=>{
    if(!originalOffer)return;
    const delay=millisecondsUntil(originalOffer.expiresAt);
    const timer=window.setTimeout(()=>{setOriginalState(undefined);setOriginalEpoch(value=>value+1);},delay);
    return()=>window.clearTimeout(timer);
  },[originalOffer]);
  function acceptOffer(offer?:AcceptedOfferSummary){setAcceptedState(offer?{offer,cartKey,revision}:undefined);setOfferNotice(undefined);}
  function keepOriginal(){setAcceptedState(undefined);setOfferNotice(undefined);}
  function invalidateOffer(reason:"expired"|"invalid"){
    if(acceptedOffer){setAcceptedState(undefined);setOfferNotice(reason);setComparisonKey(value=>value+1);}
    else{setOriginalState(undefined);setOriginalEpoch(value=>value+1);setOriginalError("");}
  }

  if(!count)return <div className="empty-state"><p className="eyebrow">SOLE / checkout</p><h1>Your bag is empty.</h1><p>Add a shoe and size to begin.</p><Link className="button primary" href="/">Shop footwear</Link></div>;
  return <div className="page-shell checkout-page"><div className="breadcrumb">SOLE / Checkout</div><h1 className="page-title">Checkout</h1>
    <div className="checkout-layout"><div className="checkout-main">
      <section className="checkout-section" aria-labelledby="order-review"><p className="eyebrow">01 / Your order</p><h2 id="order-review">Review your shoes</h2>{lines.map(({key,product,quantity,sku})=><div className="checkout-item" key={key}><div><strong>{product.name}</strong><p>{product.brand} · {product.variant.color} · EU {sku.size} · Qty {quantity}</p></div><strong>{formatMoney({amountMinor:product.price.amountMinor*quantity,currency:"USD"})}</strong></div>)}</section>
      <section className="checkout-section" aria-labelledby="deal-review"><h2 id="deal-review">Deal Engine</h2>{visibleNotice&&<div className="offer-expired" role="alert"><strong>{visibleNotice==="expired"?"Accepted offer expired":"Accepted offer is no longer valid"}</strong><p>Your checkout has returned to the original SOLE price. You may check prices again, or pay the original price.</p></div>}<CartPriceCheck key={`${comparisonKey}:${cartKey}`} cart={cart} onAccepted={acceptOffer} canCheckPrices={Boolean(originalOffer)}/>{acceptedOffer&&<button type="button" className="button secondary" onClick={keepOriginal}>Keep original price instead</button>}</section>
      <section className="checkout-section checkout-payment" aria-labelledby="payment-title"><h2 id="payment-title">PayPal Payment (Sandbox only)</h2>{originalError&&!payableOffer&&<div role="alert" className="offer-expired">Original-price checkout is temporarily unavailable: {originalError}<button type="button" className="button" onClick={()=>{setOriginalError("");setOriginalEpoch(value=>value+1);}}>Try again</button></div>}<PayPalCheckout key={`${payableOffer?.offerId??"authorizing"}:${cartKey}:${revision}`} offerId={payableOffer?.offerId} cart={cart} authorizationLoading={!payableOffer&&!originalError} priceMode={acceptedOffer?"accepted":"original"} onOfferInvalidated={invalidateOffer}/></section>
    </div><aside className="summary" aria-label="Final checkout total"><h2>Payable total</h2>{lines.map(({key,product,quantity,sku})=><div className="summary-row" key={key}><span>{quantity} × {product.name} · EU {sku.size}</span><span>{formatMoney({amountMinor:product.price.amountMinor*quantity,currency:"USD"})}</span></div>)}<div className="summary-row"><span>Original subtotal</span><span>{formatMoney({amountMinor:subtotal,currency:"USD"})}</span></div><div className="summary-row"><span>Shipping</span><span>{shipping?formatMoney({amountMinor:shipping,currency:"USD"}):"Free"}</span></div><div className="summary-row"><span>Tax</span><span>{formatMoney({amountMinor:0,currency:"USD"})}</span></div>{acceptedOffer?.savings.amountMinor?<div className="summary-row savings"><strong>Deal Engine savings</strong><strong>−{formatMoney(acceptedOffer.savings)}</strong></div>:null}<div className="summary-row total authorized-total"><strong>{acceptedOffer?"Accepted offer total":"Original price total"}</strong><strong>{formatMoney(payableOffer?.totalToPay??{amountMinor:originalTotal,currency:"USD"})}</strong></div><p className="subhead">Final payment amount comes from a server-authorized record. Channel3 product prices are observations, not verified delivered totals. Sandbox only.</p></aside></div>
  </div>;
}
