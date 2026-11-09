"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { CART_VERSION, cartCount, validateCartItems } from "@/lib/cart-state";

type CartState = { items: Record<string, number>; add: (id: string) => void; remove: (id: string) => void; setQuantity: (id: string, quantity: number) => void; count: number; revision: number; drawerOpen:boolean; openDrawer:()=>void; closeDrawer:()=>void };
const CartContext = createContext<CartState | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Record<string, number>>({});
  const [ready, setReady] = useState(false);
  const [revision,setRevision]=useState(0);
  const [drawerOpen,setDrawerOpen]=useState(false);
  const openDrawer=useCallback(()=>setDrawerOpen(true),[]);
  const closeDrawer=useCallback(()=>setDrawerOpen(false),[]);
  useEffect(() => {
    const saved = localStorage.getItem("pm-cart");
    const timer = window.setTimeout(() => {
      try { setItems(validateCartItems(JSON.parse(saved || "{}"))); } catch { setItems({}); }
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => { if (ready) localStorage.setItem("pm-cart", JSON.stringify({version:CART_VERSION,items:validateCartItems(items)})); }, [items, ready]);
  const setQuantity = (id: string, quantity: number) => {setItems((current) => { const next = { ...current }; if (quantity <= 0) delete next[id]; else next[id] = Math.min(quantity, 9); return validateCartItems(next); });setRevision((value)=>value+1);};
  const add=(id:string)=>{setItems(current=>validateCartItems({...current,[id]:(current[id]??0)+1}));setRevision(value=>value+1);setDrawerOpen(true);};
  return <CartContext.Provider value={{ items, add, remove: (id) => setQuantity(id, 0), setQuantity, count: cartCount(items),revision,drawerOpen,openDrawer,closeDrawer }}>{children}</CartContext.Provider>;
}

export function useCart() { const value = useContext(CartContext); if (!value) throw new Error("useCart must be used within CartProvider"); return value; }
