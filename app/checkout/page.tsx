"use client";
import { useState } from "react";
import Link from "next/link";
import { PriceCheck } from "@/components/price-check";
import { PayPalCheckout } from "@/components/paypal-checkout";
import { useCart } from "@/components/cart-provider";
import { products } from "@/lib/catalog";
import { formatMoney } from "@/lib/format";

export default function CheckoutPage() {
  const [acceptedOfferId, setAcceptedOfferId] = useState<string>();
  const { items, count } = useCart();
  const lines = products.filter((product) => items[product.id]);
  if (!count) return <div className="empty-state"><p className="eyebrow">Checkout</p><h1>Your bag is empty.</h1><p>A price check is only available for a product you choose.</p><Link className="button primary" href="/">Browse products</Link></div>;
  const subtotal = lines.reduce((sum, product) => sum + product.price.amountMinor * items[product.id], 0);
  const shipping = subtotal >= 7500 ? 0 : 590; const tax = 0; const total = subtotal + shipping + tax;
  const cart=lines.map((product) => ({ productId: product.id, variantKey: [product.sku, product.variant.color, product.variant.size ?? "", product.variant.condition].join(":"), quantity: items[product.id] }));
  return <div className="page-shell"><div className="breadcrumb">Bag / Checkout</div><h1 className="page-title">Checkout</h1><div className="checkout-layout"><section className="checkout-main"><PriceCheck productId={lines[0].id} cart={cart} onAccepted={setAcceptedOfferId} /><div className="trust-note"><strong>Prefer the original price?</strong><br />Comparison is optional. You can continue without checking or accepting an offer.</div><PayPalCheckout offerId={acceptedOfferId} cart={cart} /></section><aside className="summary"><h2>Order summary</h2>{lines.map((product) => <div className="summary-row" key={product.id}><span>{items[product.id]} × {product.name}</span><span>{formatMoney({ amountMinor: product.price.amountMinor * items[product.id], currency: "USD" })}</span></div>)}<div className="summary-row"><span>Shipping</span><span>{shipping ? formatMoney({ amountMinor: shipping, currency: "USD" }) : "Free"}</span></div><div className="summary-row"><span>Tax</span><span>{formatMoney({ amountMinor: tax, currency: "USD" })}</span></div><div className="summary-row total"><strong>Original total</strong><strong>{formatMoney({ amountMinor: total, currency: "USD" })}</strong></div><p className="subhead">All amounts are USD. Fixture comparison data is demo-only; any payment action is restricted to PayPal Sandbox.</p></aside></div></div>;
}
