import type { Metadata } from "next";
import { CartProvider } from "@/components/cart-provider";
import { Header } from "@/components/header";
import "./globals.css";

export const metadata: Metadata = { title: "NORTH/01 — PriceMatcher demo", description: "A fictional retail experience demonstrating transparent, verified price matching." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><CartProvider><div className="demo-bar">Fictional store · Demo products and comparison data</div><Header /><main>{children}</main><footer><div><span className="wordmark">NORTH/01</span><p>Considered objects for everyday life.</p></div><div><a href="/about">About PriceMatcher</a><a href="/merchant">Merchant demo</a><a href="/api/health">System health</a></div><small>Hackathon prototype · No real purchases or live market claims</small></footer></CartProvider></body></html>;
}
