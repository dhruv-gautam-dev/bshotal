import React from 'react'

export default function Image({ src, alt = '', className = '', ...props }) {
  return (
    <img
      src={src || '/placeholder.svg'}
      alt={alt}
      className={className}
      loading="lazy"
      {...props}
    />
  )
}

