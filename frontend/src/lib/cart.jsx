// Shopping cart context and state management for restaurant orders
import React, { createContext, useContext, useState } from 'react'

export const CartContext = createContext(null)

export function CartProvider({ children }) {
  const [items, setItems] = useState([])

  const addItem = (item) => setItems((prev) => [...prev, item])
  const removeItem = (id) => setItems((prev) => prev.filter((i) => i.id !== id))
  const clearCart = () => setItems([])

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, clearCart }}>
      {children || <div>Cart</div>}
    </CartContext.Provider>
  )
}

export function useCart() {
  const context = useContext(CartContext)
  return context || { items: [], addItem: () => {}, removeItem: () => {}, clearCart: () => {} }
}

export default function Cart() {
  return <div>Cart</div>
}

