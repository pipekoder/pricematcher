import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCart } from "@/components/add-to-cart";
import { PriceMatcherBadge } from "@/components/badge";
import { PriceCheck } from "@/components/price-check";
import { getProduct, products } from "@/lib/catalog";
import { formatMoney } from "@/lib/format";

export function generateStaticParams() { return products.map(({ id }) => ({ id })); }

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const product = getProduct((await params).id); if (!product) notFound();
  return <div className="page-shell"><div className="breadcrumb"><Link href="/">Shop</Link> / {product.category} / {product.name}</div><div className="product-detail"><div className="detail-image"><Image src={product.image} alt={product.name} width={800} height={800} priority /></div><div className="detail-info"><p className="eyebrow">{product.brand} / {product.category}</p><h1>{product.name}</h1><PriceMatcherBadge /><p className="detail-price">{formatMoney(product.price)}</p><p className="detail-description">{product.description}</p><ul className="detail-list">{product.features.map((feature) => <li key={feature}><span>{feature}</span><span>✓</span></li>)}<li><span>Colour</span><strong>{product.variant.color}</strong></li><li><span>Demo SKU / identifier</span><strong>{product.sku} · {product.gtin}</strong></li></ul><p className="stock">● {product.stock}</p><p className="subhead">{product.delivery}</p><div className="detail-actions"><AddToCart id={product.id} large /></div><PriceCheck productId={product.id} cart={[{ productId: product.id, variantKey: [product.sku, product.variant.color, product.variant.size ?? "", product.variant.condition].join(":"), quantity: 1 }]} /><div className="trust-note"><strong>Shop with price confidence.</strong><br />At checkout, PriceMatcher shows Channel3 market evidence and clearly labeled demo pricing assumptions.</div></div></div></div>;
}
