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
        <p className="eyebrow">PayPal Sandbox · Running &amp; sneakers</p>
        <h1 id="demo-title">PriceMatcher demo site</h1>
        <p>Find a pair you love. See a saved market-price reference on its product page, choose a size, and check for a merchant-authorized offer at checkout.</p>
        <Link className="button light large" href="#collection">Explore shoes <ArrowRight size={18} /></Link>
      </div>
      <div className="demo-hero-image"><Image src={heroProduct.image} alt={`${heroProduct.brand} ${heroProduct.name}`} width={1000} height={1000} priority /><span>Image supplied with the saved Channel3 product record</span></div>
    </section>
    <section className="demo-steps" id="how-it-works" aria-label="How the demo works">
      <div><span>01</span><strong>Choose a shoe and EU size</strong><p>Size-level availability is simulated for this demo.</p></div>
      <div><span>02</span><strong>See the market reference</strong><p>Saved Channel3 product prices are shown on each product page.</p></div>
      <div><span>03</span><strong>Check your offer at checkout</strong><p>Only the server can authorize a final price. PayPal is Sandbox only.</p></div>
    </section>
    <section className="collection" id="collection">
      <div className="section-heading"><div><p className="eyebrow">The collection</p><h2>Running shoes, sneakers &amp; hiking shoes</h2></div><p>Real product identities and images from saved Channel3 results. Merchant prices and EU-size stock are simulated.</p></div>
      <div className="brand-strip" aria-label="Available brands">{brands.map(brand=><span key={brand}>{brand}</span>)}</div>
      <div className="product-grid">{products.map(product=><ProductCard key={product.id} product={product} />)}</div>
    </section>
    <section className="demo-final-note"><ShieldCheck size={32} /><div><h2>Price difference is not yet an offer.</h2><p>Market prices exclude unknown shipping and mandatory fees, and external size availability is unverified. Add your size to the bag, then use PriceMatcher at checkout to see the server-authorized total—or continue at the original price.</p></div><Link className="button light" href="/cart">View bag <ArrowRight size={17} /></Link></section>
  </>;
}
