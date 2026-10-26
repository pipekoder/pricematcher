import type { Metadata } from "next";
import { CartProvider } from "@/components/cart-provider";
import { Header } from "@/components/header";
import "./globals.css";

export const metadata: Metadata = { title: "NORTH/01 — PriceMatcher demo", description: "Real product families, fictional demo merchant prices, and a PayPal Sandbox checkout." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><CartProvider><div className="demo-bar">Real product families · Fictional demo merchant prices · PayPal Sandbox</div><Header /><main>{children}</main><footer><div><span className="wordmark">NORTH/01</span><p>Considered objects for everyday life.</p></div><div><a href="/about">About PriceMatcher</a><a href="/channel3-demo">Channel3 real-product demo</a><a href="/merchant">Merchant demo</a><a href="/api/health">System health</a></div><small>Hackathon prototype · PayPal Sandbox only · No unsupported live market claims</small></footer></CartProvider></body></html>;
}
