"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, Check, ExternalLink, LoaderCircle, ShieldCheck } from "lucide-react";
import { useCart } from "@/components/cart-provider";
import { PriceMatcherBadge } from "@/components/badge";
import { getProduct, products } from "@/lib/catalog";
import { defaultPolicy, demoOffers } from "@/lib/demo-data";
import { formatDateTime, formatSek } from "@/lib/format";
import { evaluatePrice, findMatchingOffer } from "@/lib/pricing";

type Stage = "initial" | "loading" | "result" | "payment";

export default function CheckoutPage() {
  const { items, count } = useCart();
  const [stage, setStage] = useState<Stage>("initial");
  const [accepted, setAccepted] = useState(false);
  const lines = products.filter((product) => items[product.id]);
  const fixtureProduct = getProduct("nord-sound-2")!;
  const comparisonProduct = lines[0] ?? fixtureProduct;
  const comparisonQuantity = items[comparisonProduct.id] || 1;
  const matchingOffer = comparisonQuantity === 1
    ? findMatchingOffer(comparisonProduct, demoOffers)
    : undefined;
  const decision = evaluatePrice(comparisonProduct, matchingOffer, defaultPolicy);
  const base = lines.length
    ? lines.reduce((sum, product) => sum + product.price * items[product.id], 0)
    : fixtureProduct.price;
  const adjustment = accepted && decision.eligible ? decision.discount : 0;
  const total = base - adjustment;

  useEffect(() => {
    if (stage !== "loading") return;
    const timer = setTimeout(() => setStage("result"), 1800);
    return () => clearTimeout(timer);
  }, [stage]);

  if (!count && stage === "initial") {
    return <div className="page-shell">
      <p className="demo-label">Guided demo</p>
      <h1 className="page-title">Checkout, with clarity.</h1>
      <p className="subhead">Your cart is empty, so this demo uses one Nord Sound 2 to show the complete comparison journey. No real order will be created.</p>
      <button className="button primary large" style={{ marginTop: 25 }} onClick={() => setStage("loading")}>Start demo comparison</button>
    </div>;
  }

  return <div className="page-shell">
    <div className="breadcrumb">Bag / Checkout / Payment</div>
    <h1 className="page-title">Checkout</h1>
    <div className="stepper" aria-label="Checkout progress">
      <span className="active" />
      <span className={stage !== "initial" ? "active" : ""} />
      <span className={stage === "payment" ? "active" : ""} />
    </div>
    <div className="checkout-layout">
      <section className="checkout-main">
        <div className="compare-panel">
          <div className="compare-head">
            <div><p className="eyebrow">Built into checkout</p><h2>One last price check?</h2></div>
            <PriceMatcherBadge />
          </div>

          {stage === "initial" && <>
            <p>We can look for the exact same product at verified retailers, compare the real delivered cost, and see whether an approved offer is available.</p>
            <div className="compare-actions">
              <button className="button primary large" onClick={() => setStage("loading")}>Compare this price</button>
              <button className="button large" onClick={() => setStage("payment")}>Continue without comparing</button>
            </div>
            <p style={{ fontSize: 11 }}>Usually takes a few seconds. No personal information is shared.</p>
          </>}

          {stage === "loading" && <div className="loading-box">
            <LoaderCircle className="animate-spin" />
            <h3>Checking like for like…</h3>
            <div className="progress"><span /></div>
            <div className="checks">
              <span><Check size={16} /> Confirming exact model and variant</span>
              <span><Check size={16} /> Verifying seller authenticity</span>
              <span><Check size={16} /> Calculating delivery and fees</span>
            </div>
          </div>}

          {stage === "result" && <>
            <div className="demo-label">Demonstration fixture · Not live market data</div>
            {matchingOffer ? <div className="evidence">
              <div className="evidence-row"><span>Retailer</span><strong>{matchingOffer.retailer}</strong></div>
              <div className="evidence-row"><span>Seller status</span><span className="verified"><BadgeCheck size={15} /> Allowlisted demo retailer</span></div>
              <div className="evidence-row"><span>Product match</span><strong>Exact product and GTIN</strong></div>
              <div className="evidence-row"><span>Product price</span><strong>{formatSek(matchingOffer.productPrice)}</strong></div>
              <div className="evidence-row"><span>Shipping & fees</span><strong>{formatSek(matchingOffer.shipping + matchingOffer.fees)}</strong></div>
              <div className="evidence-row"><span>Delivered total</span><strong>{formatSek(decision.competitorTotal || 0)}</strong></div>
              <div className="evidence-row"><span>Source type</span><strong>{matchingOffer.source === "demo" ? "Demo fixture" : matchingOffer.source}</strong></div>
              <div className="evidence-row"><span>Source</span><a href={matchingOffer.sourceUrl} target="_blank" rel="noreferrer">View source <ExternalLink size={13} /></a></div>
              <div className="evidence-row"><span>Retrieved</span><strong>{formatDateTime(matchingOffer.retrievedAt)}</strong></div>
              <div className="evidence-row"><span>Delivery estimate</span><strong>{matchingOffer.delivery}</strong></div>
            </div> : <div className="payment-disabled"><strong>No exact fixture match found.</strong><br />This demo has no eligible competitor offer for {comparisonProduct.name}{comparisonQuantity > 1 ? " at this quantity" : ""}. The headphones fixture is never applied to another product or variant.</div>}

            {decision.eligible ? <>
              <div className="offer-card">
                <p className="eyebrow">Your merchant-approved offer</p>
                <div className="offer-price">{formatSek(decision.proposedPrice)}</div>
                <p>Save {formatSek(decision.savings)} and keep faster local delivery. {decision.reason}</p>
              </div>
              <div className="offer-choice">
                <button className="button primary" onClick={() => { setAccepted(true); setStage("payment"); }}>Accept PriceMatcher offer</button>
                <button className="button secondary" onClick={() => { setAccepted(false); setStage("payment"); }}>Keep original price</button>
              </div>
            </> : <>
              {matchingOffer && <div className="payment-disabled"><strong>No actionable offer is available.</strong><br />{decision.reason}</div>}
              <button className="button primary large" style={{ marginTop: 20 }} onClick={() => { setAccepted(false); setStage("payment"); }}>Continue with original price</button>
            </>}
          </>}

          {stage === "payment" && <>
            <div className="payment-disabled">
              <ShieldCheck size={20} />
              <strong> Demo selection: {formatSek(total)}</strong><br />
              PayPal Sandbox checkout is intentionally disabled in Foundation. This amount is a client-side preview only; PR #3 will add server-side offer validation, order creation and capture.
            </div>
            <button className="button primary large" disabled style={{ width: "100%", marginTop: 15 }}>PayPal Sandbox not configured</button>
            <button className="button" style={{ marginTop: 12 }} onClick={() => setStage("result")}>Back to comparison</button>
          </>}
        </div>
      </section>

      <aside className="summary">
        <h2>Order summary</h2>
        {(lines.length ? lines : [fixtureProduct]).map((product) => <div className="summary-row" key={product.id}>
          <span>{items[product.id] || 1} × {product.name}</span>
          <span>{formatSek(product.price * (items[product.id] || 1))}</span>
        </div>)}
        {adjustment > 0 && <div className="summary-row" style={{ color: "var(--green)" }}><strong>PriceMatcher savings</strong><strong>−{formatSek(adjustment)}</strong></div>}
        <div className="summary-row"><span>Delivery</span><span>Free</span></div>
        <div className="summary-row total"><strong>Demo total</strong><strong>{formatSek(total)}</strong></div>
        <p className="subhead">This Foundation preview does not create an order. Server-side validation and payment authorization are planned for PR #3.</p>
      </aside>
    </div>
  </div>;
}
