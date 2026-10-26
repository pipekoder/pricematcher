import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/types";
import { formatMoney } from "@/lib/format";
import { PriceMatcherBadge } from "./badge";

export function ProductCard({ product }: { product: Product }) {
  return <article className="product-card"><Link className="product-image" href={`/product/${product.id}`}><Image src={product.image} alt={product.name} width={800} height={800} /></Link><div className="product-meta"><div><p>{product.brand}</p><Link href={`/product/${product.id}`}><h3>{product.name}</h3></Link></div><PriceMatcherBadge compact /></div><div className="product-buy"><strong>{formatMoney(product.price)}</strong>{product.compareAt && <s>{formatMoney(product.compareAt)}</s>}<Link className="button primary" href={`/product/${product.id}`}>Choose size</Link></div>{product.demoMerchant&&<p className="demo-merchant-label">Fictional demo merchant price · Channel3 product family</p>}</article>;
}
