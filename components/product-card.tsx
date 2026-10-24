import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/types";
import { formatSek } from "@/lib/format";
import { AddToCart } from "./add-to-cart";
import { PriceMatcherBadge } from "./badge";

export function ProductCard({ product }: { product: Product }) {
  return <article className="product-card"><Link className="product-image" href={`/product/${product.id}`}><Image src={product.image} alt={product.name} width={800} height={800} /></Link><div className="product-meta"><div><p>{product.brand}</p><Link href={`/product/${product.id}`}><h3>{product.name}</h3></Link></div><PriceMatcherBadge compact /></div><div className="product-buy"><strong>{formatSek(product.price)}</strong>{product.compareAt && <s>{formatSek(product.compareAt)}</s>}<AddToCart id={product.id} /></div></article>;
}
