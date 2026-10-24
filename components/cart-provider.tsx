"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type CartState = { items: Record<string, number>; add: (id: string) => void; remove: (id: string) => void; setQuantity: (id: string, quantity: number) => void; count: number };
const CartContext = createContext<CartState | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Record<string, number>>({});
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem("pm-cart");
    const timer = window.setTimeout(() => {
      try { setItems(JSON.parse(saved || "{}")); } catch { setItems({}); }
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => { if (ready) localStorage.setItem("pm-cart", JSON.stringify(items)); }, [items, ready]);
  const setQuantity = (id: string, quantity: number) => setItems((current) => { const next = { ...current }; if (quantity <= 0) delete next[id]; else next[id] = Math.min(quantity, 9); return next; });
  return <CartContext.Provider value={{ items, add: (id) => setQuantity(id, (items[id] || 0) + 1), remove: (id) => setQuantity(id, 0), setQuantity, count: Object.values(items).reduce((a, b) => a + b, 0) }}>{children}</CartContext.Provider>;
}

export function useCart() { const value = useContext(CartContext); if (!value) throw new Error("useCart must be used within CartProvider"); return value; }
