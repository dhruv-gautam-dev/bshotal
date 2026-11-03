import React from 'react'
import Image from './image'

export default function ResponsiveImage({ src, alt = '', className = '', ...props }) {
  return (
    <Image
      src={src}
      alt={alt}
      className={`w-full h-auto object-cover ${className}`}
      {...props}
    />
  )
}

