import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCart } from "@/components/add-to-cart";
import { PriceMatcherBadge } from "@/components/badge";
import { getProduct, products } from "@/lib/catalog";
import { formatMoney } from "@/lib/format";
import { virtualSkus, skuKey } from "@/lib/footwear/operations";

export function generateStaticParams() { return products.map(({ id }) => ({ id })); }

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const product = getProduct((await params).id); if (!product) notFound();const sizes=virtualSkus.filter(sku=>sku.productId===product.id);
  return <div className="page-shell"><div className="breadcrumb"><Link href="/">Shop</Link> / {product.category} / {product.name}</div><div className="product-detail"><div className="detail-image"><Image src={product.image} alt={product.name} width={800} height={800} priority /></div><div className="detail-info"><p className="eyebrow">{product.brand} / {product.category}</p><h1>{product.name}</h1><PriceMatcherBadge /><p className="detail-price">{formatMoney(product.price)}</p><p className="detail-description">{product.description}</p><ul className="detail-list">{product.features.map((feature) => <li key={feature}><span>{feature}</span><span>✓</span></li>)}<li><span>Colour</span><strong>{product.variant.color}</strong></li><li><span>Demo SKU / identifier</span><strong>{product.sku} · {product.gtin}</strong></li></ul><p className="stock">● {product.stock}</p><p className="subhead">{product.delivery}</p><div className="detail-actions"><div className="size-picker"><strong>Choose EU size · Simulated stock</strong><div>{sizes.map(size=><AddToCart key={size.sku} id={skuKey(product.id,size.size)} label={`EU ${size.size} · ${size.stock} left`} disabled={size.stock===0}/>)}</div></div></div><div className="trust-note"><strong>Shop with price confidence.</strong><br />Select a size, then check prices in your bag. Channel3 market evidence and demo pricing assumptions are labeled.</div></div></div></div>;
}
