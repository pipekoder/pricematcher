"use client";

import { Check, Plus } from "lucide-react";
import { useState } from "react";
import { useCart } from "./cart-provider";

export function AddToCart({ id, large = false, label, disabled=false,onAdded }: { id: string; large?: boolean; label?:string; disabled?:boolean;onAdded?:()=>void }) {
  const { add } = useCart(); const [added, setAdded] = useState(false);
  return <button type="button" disabled={disabled} className={`button primary ${large ? "large" : ""}`} onClick={() => { add(id);onAdded?.();setAdded(true);setTimeout(() => setAdded(false), 1400); }}>{added ? <><Check size={17} /> Added</> : disabled?<>EU size sold out</>:<><Plus size={17} /> {label??"Add to Bag"}</>}</button>;
}
