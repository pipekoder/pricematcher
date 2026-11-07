import type { Metadata } from "next";
import { CartProvider } from "@/components/cart-provider";
import { Header } from "@/components/header";
import "./globals.css";

export const metadata: Metadata = { title: "PriceMatcher demo site — running shoes & sneakers", description: "Real Channel3 shoe records, simulated merchant prices, and a PayPal Sandbox checkout." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><CartProvider><div className="demo-bar">Real product images · Simulated size stock and merchant prices · PayPal Sandbox</div><Header /><main>{children}</main><footer><div><span className="wordmark">PriceMatcher</span><p>A transparent shoe-shopping demo for the PayPal Hackathon.</p></div><div><a href="/about">About PriceMatcher</a><a href="/channel3-demo">Channel3 demo</a><a href="/merchant">Merchant demo</a><a href="/api/health">System health</a></div><small>Hackathon prototype · PayPal Sandbox only · Market-price differences are not authorized offers</small></footer></CartProvider></body></html>;
}
