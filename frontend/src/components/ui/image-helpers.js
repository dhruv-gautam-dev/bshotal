export const IMAGE_LOAD_MODE = {
  OPTIMIZED: "optimized",
  ORIGINAL: "original",
  FALLBACK: "fallback",
}

export function nextImageLoadMode(mode) {
  if (mode === IMAGE_LOAD_MODE.OPTIMIZED) return IMAGE_LOAD_MODE.ORIGINAL
  return IMAGE_LOAD_MODE.FALLBACK
}

export const DEFAULT_TRANSFORM_WIDTH = 800

export function parseWixMediaUrl(src) {
  if (!src || typeof src !== "string") return null
  if (src.includes("wixstatic.com") || src.includes("media.apiClient.com")) {
    return {
      baseUrl: src,
      originalUrl: src,
    }
  }
  return null
}

export function getOriginalImageUrl(src, parsed) {
  if (parsed?.originalUrl) return parsed.originalUrl
  return src
}

export function getImagePreviewClassName(className, wrapperClassName, fallback) {
  return className || wrapperClassName || fallback || ""
}

export function splitImageProps(props = {}) {
  const wrapperPropKeys = ["className", "style", "id", "data-testid"]
  const wrapperProps = {}
  const imageProps = {}

  for (const [key, val] of Object.entries(props)) {
    if (key.startsWith("data-") || wrapperPropKeys.includes(key)) {
      wrapperProps[key] = val
    } else {
      imageProps[key] = val
    }
  }

  return { wrapperProps, imageProps }
}

export function buildTransformUrl(parsed, options = {}) {
  if (!parsed) return ""
  const url = parsed.baseUrl || parsed.url || ""
  if (!url) return ""

  try {
    const u = new URL(url)
    if (options.width) u.searchParams.set("w", String(Math.round(options.width)))
    if (options.height) u.searchParams.set("h", String(Math.round(options.height)))
    if (options.quality) u.searchParams.set("q", String(options.quality))
    return u.toString()
  } catch {
    return url
  }
}

export function buildSrcSet(parsed, options = {}) {
  if (!parsed) return ""
  const url1x = buildTransformUrl(parsed, options)
  const url2x = buildTransformUrl(parsed, {
    ...options,
    width: options.width ? options.width * 2 : undefined,
    height: options.height ? options.height * 2 : undefined,
  })
  if (!url2x || url1x === url2x) return `${url1x} 1x`
  return `${url1x} 1x, ${url2x} 2x`
}

export const getOptimizedImageUrl = (url, width) => url || "/placeholder.svg"
export const getSrcSet = (url) => (url ? `${url} 1x` : "")

export default {
  IMAGE_LOAD_MODE,
  nextImageLoadMode,
  DEFAULT_TRANSFORM_WIDTH,
  parseWixMediaUrl,
  getOriginalImageUrl,
  getImagePreviewClassName,
  splitImageProps,
  buildTransformUrl,
  buildSrcSet,
  getOptimizedImageUrl,
  getSrcSet,
}
