"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useCart } from "@/components/cart-provider";
import { products } from "@/lib/catalog";
import { formatMoney } from "@/lib/format";

export default function CartPage() {
  const { items, setQuantity, remove, count } = useCart(); const lines = products.filter((p) => items[p.id]); const subtotal = lines.reduce((sum, p) => sum + p.price.amountMinor * items[p.id], 0); const delivery = subtotal >= 7500 || subtotal === 0 ? 0 : 590;
  if (!count) return <div className="empty-state"><p className="eyebrow">Your bag</p><h1>Room for something good.</h1><p className="subhead" style={{ margin: "20px auto 30px" }}>Explore considered essentials, with transparent price matching available at checkout.</p><Link className="button primary large" href="/">Continue shopping</Link></div>;
  return <div className="page-shell"><p className="eyebrow">Your bag / {count} {count === 1 ? "item" : "items"}</p><h1 className="page-title">Ready when you are.</h1><div className="cart-layout"><section>{lines.map((p) => <article className="cart-item" key={p.id}><Image src={p.image} alt="" width={200} height={200} /><div><p>{p.brand}</p><h3><Link href={`/product/${p.id}`}>{p.name}</Link></h3><p>{p.variant.color} · {p.stock}</p><div className="quantity"><button aria-label="Decrease quantity" onClick={() => setQuantity(p.id, items[p.id] - 1)}><Minus size={14} /></button><span>{items[p.id]}</span><button aria-label="Increase quantity" onClick={() => setQuantity(p.id, items[p.id] + 1)}><Plus size={14} /></button><button aria-label="Remove item" onClick={() => remove(p.id)}><Trash2 size={14} /></button></div></div><strong>{formatMoney({ amountMinor: p.price.amountMinor * items[p.id], currency: "USD" })}</strong></article>)}</section><aside className="summary"><h2>Order summary</h2><div className="summary-row"><span>Subtotal</span><span>{formatMoney({ amountMinor: subtotal, currency: "USD" })}</span></div><div className="summary-row"><span>Delivery</span><span>{delivery ? formatMoney({ amountMinor: delivery, currency: "USD" }) : "Free"}</span></div><div className="summary-row total"><strong>Total</strong><strong>{formatMoney({ amountMinor: subtotal + delivery, currency: "USD" })}</strong></div><p className="subhead">Tax is $0.00 in this fictional demo.</p><Link className="button primary large" href="/checkout">Continue to checkout</Link><Link className="button" href="/" style={{ width: "100%", marginTop: 10 }}>Keep shopping</Link></aside></div></div>;
}
