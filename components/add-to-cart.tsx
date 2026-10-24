"use client";

import { Check, Plus } from "lucide-react";
import { useState } from "react";
import { useCart } from "./cart-provider";

export function AddToCart({ id, large = false }: { id: string; large?: boolean }) {
  const { add } = useCart(); const [added, setAdded] = useState(false);
  return <button className={`button primary ${large ? "large" : ""}`} onClick={() => { add(id); setAdded(true); setTimeout(() => setAdded(false), 1400); }}>{added ? <><Check size={17} /> Added</> : <><Plus size={17} /> Add to cart</>}</button>;
}
