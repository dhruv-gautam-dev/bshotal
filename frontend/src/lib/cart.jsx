import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const CartContext = createContext(null);
const KEY = 'bsh_cart_v1';

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
  });
  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(items)); }, [items]);

  const add = (item) => setItems((prev) => {
    const found = prev.find((i) => i.id === item.id);
    if (found) return prev.map((i) => (i.id === item.id ? { ...i, qty: i.qty + 1 } : i));
    return [...prev, { id: item.id, name: item.name, price: item.price, qty: 1, note: '' }];
  });
  const setQty = (id, qty) => setItems((prev) => (qty <= 0 ? prev.filter((i) => i.id !== id) : prev.map((i) => (i.id === id ? { ...i, qty } : i))));
  const setNote = (id, note) => setItems((prev) => prev.map((i) => (i.id === id ? { ...i, note } : i)));
  const clear = () => setItems([]);

  const value = useMemo(() => ({
    items, add, setQty, setNote, clear,
    count: items.reduce((s, i) => s + i.qty, 0),
    subtotal: items.reduce((s, i) => s + i.qty * i.price, 0),
    qtyOf: (id) => items.find((i) => i.id === id)?.qty || 0,
  }), [items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);