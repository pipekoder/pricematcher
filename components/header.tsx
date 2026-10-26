"use client";

import Link from "next/link";
import { Menu, Search, ShoppingBag } from "lucide-react";
import { useCart } from "./cart-provider";

export function Header() {
  const { count } = useCart();
  return <header className="site-header"><Link className="wordmark" href="/">NORTH/01</Link><nav aria-label="Main navigation"><Link href="/">Shop</Link><Link href="/about">Why PriceMatcher</Link><Link href="/channel3-demo">Channel3 demo</Link><Link href="/merchant">Merchant demo</Link></nav><div className="header-actions"><button aria-label="Search"><Search size={19} /></button><Link className="bag" href="/cart" aria-label={`Cart with ${count} items`}><ShoppingBag size={19} /><span>{count}</span></Link><button className="menu" aria-label="Open menu"><Menu size={20} /></button></div></header>;
}
