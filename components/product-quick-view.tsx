"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect,useRef } from "react";
import { X } from "lucide-react";
import type { Product } from "@/lib/types";
import { virtualSkus,skuKey } from "@/lib/footwear/operations";
import { formatMoney } from "@/lib/format";
import { AddToCart } from "./add-to-cart";

export function ProductQuickView({product,onClose}:{product:Product;onClose:()=>void}){
  const panel=useRef<HTMLElement>(null);
  const sizes=virtualSkus.filter(sku=>sku.productId===product.id);
  useEffect(()=>{
    const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const oldOverflow=document.body.style.overflow;document.body.style.overflow="hidden";panel.current?.focus();
    const onKey=(event:KeyboardEvent)=>{
      if(event.key==="Escape"){event.preventDefault();onClose();}
      if(event.key!=="Tab"||!panel.current)return;
      const controls=[...panel.current.querySelectorAll<HTMLElement>('button:not(:disabled),a[href]')];
      if(!controls.length)return;
      const first=controls[0],last=controls.at(-1)!;
      if(document.activeElement===panel.current||!panel.current.contains(document.activeElement)){event.preventDefault();(event.shiftKey?last:first).focus();}
      else if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    };
    document.addEventListener("keydown",onKey);
    return()=>{document.removeEventListener("keydown",onKey);document.body.style.overflow=oldOverflow;previous?.focus();};
  },[onClose]);
  return <div className="quick-view-layer"><button type="button" className="quick-view-backdrop" aria-label="Close product quick view" onClick={onClose}/><section className="quick-view" role="dialog" aria-modal="true" aria-labelledby={`quick-${product.id}`} tabIndex={-1} ref={panel}><button type="button" className="icon-close" aria-label="Close product quick view" onClick={onClose}><X size={22}/></button><div className="quick-view-image"><Image src={product.image} alt={`${product.brand} ${product.name}`} width={800} height={800}/></div><div className="quick-view-content"><p className="eyebrow">SOLE / {product.brand}</p><h2 id={`quick-${product.id}`}>{product.name}</h2><strong className="quick-view-price">{formatMoney(product.price)}</strong><p className="subhead">Simulated SOLE selling price. Product identity and image come from saved Channel3 data.</p><p>{product.description}</p><p><strong>Color:</strong> {product.variant.color}</p><fieldset className="quick-view-sizes"><legend>Choose an EU size · simulated availability</legend><div>{sizes.map(size=><AddToCart key={size.sku} id={skuKey(product.id,size.size)} label={`EU ${size.size} · Add to Bag · ${size.stock} left`} disabled={size.stock===0} onAdded={onClose}/>)}</div></fieldset><p className="subhead">Add a size to your bag. Deal Engine may offer a merchant-authorized price at checkout; checking is optional.</p><Link href={`/product/${product.id}`} className="quick-view-link" onClick={onClose}>Full product details →</Link></div></section></div>;
}
