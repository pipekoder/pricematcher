import type { Metadata } from "next";
import { CartProvider } from "@/components/cart-provider";
import { Header } from "@/components/header";
import { ShoppingBagDrawer } from "@/components/shopping-bag-drawer";
import "./globals.css";
import "./storefront-ux.css";

export const metadata: Metadata = { title: "SOLE — Deal Engine demo", description: "A curated footwear boutique powered by Deal Engine: AI-powered deal-making at checkout, with PayPal Sandbox." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><CartProvider><div className="demo-bar">SOLE demo boutique · Simulated store prices and stock · PayPal Sandbox</div><Header /><main>{children}</main><footer><div><span className="wordmark">SOLE</span><p>Demo site for PayPal AI Hackathon</p><strong>Deal Engine</strong><p>AI-powered deal-making at checkout.</p></div><div><a href="/about">About Deal Engine</a><a href="/channel3-demo">Channel3 demo</a><a href="/merchant">Merchant demo</a><a href="/api/health">System health</a></div><small>Hackathon prototype · PayPal Sandbox only · Market observations are not authorized offers</small></footer><ShoppingBagDrawer/></CartProvider></body></html>;
}
