"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { useCart } from "./cart-provider";

export function Header() {
  const { count } = useCart();
  return <header className="site-header"><Link className="wordmark" href="/">PriceMatcher</Link><nav aria-label="Main navigation"><Link href="/#collection">Shop shoes</Link><Link href="/#how-it-works">How it works</Link><Link href="/checkout">Checkout</Link></nav><div className="header-actions"><Link className="bag" href="/cart" aria-label={`Shopping bag with ${count} items`}><ShoppingBag size={19} /><span>{count}</span></Link></div></header>;
}
