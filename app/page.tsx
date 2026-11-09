import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { ProductCard } from "@/components/product-card";
import { products } from "@/lib/catalog";

const brands = ["New Balance", "Nike", "Puma", "adidas", "Reebok", "ASICS", "The North Face"];

export default function Home() {
  const heroProduct = products.find(product => product.brand === "Nike") ?? products[0];
  return <>
    <section className="demo-hero" aria-labelledby="demo-title">
      <div className="demo-hero-copy">
        <p className="eyebrow">SOLE · Curated running shoes, sneakers &amp; hiking</p>
        <h1 id="demo-title">A better fit.<br/>A better deal.</h1>
        <p>Powered by Deal Engine. Made for the best offer.</p>
        <Link className="button light large" href="#collection">Explore shoes <ArrowRight size={18} /></Link>
      </div>
      <div className="demo-hero-image"><Image src={heroProduct.image} alt={`${heroProduct.brand} ${heroProduct.name}`} width={1000} height={1000} priority /><span>Image supplied with the saved Channel3 product record</span></div>
    </section>
    <section className="demo-steps" id="how-it-works" aria-label="How the demo works">
      <div><span>01</span><strong>Shop</strong><p>Choose shoes and add to cart.</p></div>
      <div><span>02</span><strong>Review</strong><p>Review your order and compare prices with Deal Engine.</p></div>
      <div><span>03</span><strong>Deal and Pay</strong><p>Accept an offer from Deal Engine and pay for your order.</p></div>
    </section>
    <section className="collection" id="collection">
      <div className="section-heading"><div><p className="eyebrow">The collection</p><h2>Running shoes, sneakers &amp; hiking shoes</h2></div><p>Real product identities and images from saved Channel3 results. Merchant prices and EU-size stock are simulated.</p></div>
      <div className="brand-strip" aria-label="Available brands">{brands.map(brand=><span key={brand}>{brand}</span>)}</div>
      <div className="product-grid">{products.map(product=><ProductCard key={product.id} product={product} />)}</div>
    </section>
    <section className="demo-final-note"><ShieldCheck size={32} /><div><p className="eyebrow">Powered by Deal Engine</p><h2>AI-powered deal-making at checkout.</h2><p>Channel3 market observations inform two AI agents; merchant policy alone authorizes any offer. You can always choose the original SOLE price. PayPal Sandbox is available either way.</p></div><Link className="button light" href="/checkout">Go to checkout <ArrowRight size={17} /></Link></section>
  </>;
}
