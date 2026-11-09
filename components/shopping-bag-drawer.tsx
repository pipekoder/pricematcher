"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { Minus, Plus, Trash2, X } from "lucide-react";
import { footwearCartLines } from "@/lib/footwear/cart-lines";
import { formatMoney } from "@/lib/format";
import { useCart } from "./cart-provider";

export function ShoppingBagDrawer(){
  const {items,count,setQuantity,remove,drawerOpen,closeDrawer}=useCart();
  const panel=useRef<HTMLElement>(null);
  const lines=footwearCartLines(items);
  const subtotal=lines.reduce((sum,line)=>sum+line.product.price.amountMinor*line.quantity,0);
  useEffect(()=>{
    if(!drawerOpen)return;
    const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const oldOverflow=document.body.style.overflow;document.body.style.overflow="hidden";
    panel.current?.focus();
    const onKey=(event:KeyboardEvent)=>{
      if(event.key==="Escape"){event.preventDefault();closeDrawer();}
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
  },[drawerOpen,closeDrawer]);
  if(!drawerOpen)return null;
  return <div className="bag-layer"><button type="button" className="bag-backdrop" aria-label="Close shopping bag" onClick={closeDrawer}/><aside className="bag-drawer" ref={panel} role="dialog" aria-modal="true" aria-labelledby="bag-title" tabIndex={-1}>
    <div className="bag-drawer-head"><div><p className="eyebrow">SOLE / shopping bag</p><h2 id="bag-title">Your bag <span>({count})</span></h2></div><button type="button" className="icon-close" aria-label="Close shopping bag" onClick={closeDrawer}><X size={22}/></button></div>
    <div className="bag-drawer-lines">{lines.length?lines.map(({key,product,sku,quantity})=><article className="bag-drawer-line" key={key}><Image src={product.image} alt="" width={96} height={96}/><div><p className="eyebrow">{product.brand} · EU {sku.size}</p><strong>{product.name}</strong><small>{formatMoney(product.price)} each · {sku.stock} simulated in stock</small><div className="quantity"><button type="button" aria-label={`Decrease ${product.name} EU ${sku.size} quantity`} onClick={()=>setQuantity(key,quantity-1)}><Minus size={14}/></button><span>{quantity}</span><button type="button" aria-label={`Increase ${product.name} EU ${sku.size} quantity`} disabled={quantity>=Math.min(sku.stock,9)} onClick={()=>setQuantity(key,quantity+1)}><Plus size={14}/></button><button type="button" aria-label={`Remove ${product.name} EU ${sku.size}`} onClick={()=>remove(key)}><Trash2 size={14}/></button></div></div><strong>{formatMoney({amountMinor:product.price.amountMinor*quantity,currency:"USD"})}</strong></article>):<p className="subhead">Your bag is empty. Find a pair that moves you.</p>}</div>
    <div className="bag-drawer-foot"><div className="summary-row total"><strong>Subtotal</strong><strong>{formatMoney({amountMinor:subtotal,currency:"USD"})}</strong></div><p>SOLE prices and stock are simulated. Deal Engine offers are optional at checkout.</p>{count?<Link className="button primary large" href="/checkout" onClick={closeDrawer}>Checkout</Link>:<button className="button primary large" type="button" disabled>Checkout</button>}<button type="button" className="button" onClick={closeDrawer}>Continue shopping</button></div>
  </aside></div>;
}
