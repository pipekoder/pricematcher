"use client";

import Image from "next/image";
import { useState } from "react";
import type { Product } from "@/lib/types";
import { formatMoney } from "@/lib/format";
import { PriceMatcherBadge } from "./badge";
import { ProductQuickView } from "./product-quick-view";

export function ProductCard({ product }: { product: Product }) {
  const [open,setOpen]=useState(false);
  return <><article className="product-card"><button type="button" className="product-image product-open" onClick={()=>setOpen(true)} aria-label={`Quick view ${product.brand} ${product.name}`}><Image src={product.image} alt={product.name} width={800} height={800}/></button><div className="product-meta"><div><p>{product.brand}</p><button type="button" className="product-title-button" onClick={()=>setOpen(true)}><h3>{product.name}</h3></button></div><PriceMatcherBadge compact/></div><div className="product-buy"><strong>{formatMoney(product.price)}</strong>{product.compareAt&&<s>{formatMoney(product.compareAt)}</s>}<button type="button" className="button primary" onClick={()=>setOpen(true)}>Choose size</button></div>{product.demoMerchant&&<p className="demo-merchant-label">SOLE simulated price · Channel3 product identity and image</p>}</article>{open&&<ProductQuickView product={product} onClose={()=>setOpen(false)}/>}</>;
}
