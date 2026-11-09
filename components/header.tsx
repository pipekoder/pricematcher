"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { useCart } from "./cart-provider";

export function Header() {
  const { count,openDrawer } = useCart();
  return <header className="site-header"><Link className="store-identity" href="/"><span className="wordmark">SOLE</span><small>Demo site for PayPal AI Hackathon</small></Link><nav aria-label="Main navigation"><Link href="/#collection">Shop</Link><Link href="/#how-it-works">How it works</Link><Link href="/checkout">Checkout</Link></nav><div className="header-actions"><button className="bag" type="button" onClick={openDrawer} aria-label={`Open shopping bag with ${count} items`}><ShoppingBag size={19} /><span>{count}</span></button></div></header>;
}
