// Custom hook and helper for measuring element or window dimensions
import React, { useState } from 'react'

export function useSize() {
  const [size, setSize] = useState({ width: 0, height: 0 })
  return size
}

export default function UseSize() {
  return <div>use-size</div>
}

