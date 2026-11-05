'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type CartItem = {
  id: string; // local:{listingId} یا nft:{address}
  source: 'local' | 'marketapp';
  localId?: string;
  address?: string;
  kind: 'gifts' | 'usernames' | 'numbers';
  name: string;
  sub?: string;
  image?: string | null;
  priceTon: number;
  currency?: string;
  attrs?: { trait_type: string; value: string | number }[];
};

type CartCtx = {
  items: CartItem[];
  add: (item: CartItem) => void;
  remove: (id: string) => void;
  clear: () => void;
  has: (id: string) => boolean;
  totalTon: number;
  toast: string | null;
};

const Ctx = createContext<CartCtx | null>(null);
const KEY = 'giftify_cart_v1';

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setItems(JSON.parse(raw) as CartItem[]);
    } catch { /* سبد خالی */ }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch { /* حافظه پر */ }
  }, [items, ready]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const add = useCallback((item: CartItem) => {
    setItems((prev) => (prev.some((i) => i.id === item.id) ? prev : [...prev, item]));
    setToast(`«${item.name.replace(/#\d+/, '').trim()}» به سبد اضافه شد ✓`);
  }, []);

  const remove = useCallback((id: string) => setItems((prev) => prev.filter((i) => i.id !== id)), []);
  const clear = useCallback(() => setItems([]), []);
  const has = useCallback((id: string) => items.some((i) => i.id === id), [items]);
  const totalTon = useMemo(() => items.reduce((s, i) => s + (i.priceTon || 0), 0), [items]);

  return (
    <Ctx.Provider value={{ items, add, remove, clear, has, totalTon, toast }}>
      {children}
      {/* توست سبک — ورود/خروج از پایین (مسیر خروج = مسیر ورود) */}
      {toast && (
        <div
          role="status"
          className="fixed inset-x-3 bottom-4 z-[70] mx-auto max-w-sm rounded-xl border border-ok/40 bg-[#0B1A16]/95 px-4 py-3 text-center text-xs font-bold text-ok shadow-xl backdrop-blur sm:inset-x-4"
          style={{ animation: 'toast-in 200ms cubic-bezier(0.23,1,0.32,1) both' }}
        >
          {toast}
        </div>
      )}
      <style>{`@keyframes toast-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
      @media (prefers-reduced-motion: reduce) { .fixed[role='status'] { animation: none !important; } }`}</style>
    </Ctx.Provider>
  );
}

export function useCart(): CartCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useCart outside CartProvider');
  return c;
}
