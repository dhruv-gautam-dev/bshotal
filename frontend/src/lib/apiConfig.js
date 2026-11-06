/**
 * Dynamic resolution of the backend API host and base URL.
 * Supports:
 *   1. VITE_API_URL
 *   2. VITE_API_BASE_URL
 *   3. VITE_BACKEND_URL
 *   4. window.__VITE_API_URL__ (for runtime overrides in browser console or index.html)
 *
 * Normalizes trailing slashes, quotes, and /api/v1 prefixes so any input format works seamlessly:
 *   - "https://bshotel-backend.onrender.com" -> host: "https://bshotel-backend.onrender.com", base: "https://bshotel-backend.onrender.com/api/v1"
 *   - "https://bshotel-backend.onrender.com/" -> host: "https://bshotel-backend.onrender.com", base: "https://bshotel-backend.onrender.com/api/v1"
 *   - "https://bshotel-backend.onrender.com/api/v1" -> host: "https://bshotel-backend.onrender.com", base: "https://bshotel-backend.onrender.com/api/v1"
 */
function resolveApiConfig() {
  const env = import.meta.env || {};
  const raw = (
    env.VITE_API_URL ||
    env.VITE_API_BASE_URL ||
    env.VITE_BACKEND_URL ||
    (typeof window !== 'undefined' ? window.__VITE_API_URL__ : '') ||
    ''
  )
    .toString()
    .trim()
    .replace(/^["']|["']$/g, ''); // strip any accidental wrapping quotes

  if (!raw) {
    return {
      API_HOST: '',
      API_BASE: '/api/v1',
    };
  }

  // Strip trailing /api/v1 or trailing slashes to obtain the clean base host
  const host = raw.replace(/\/api\/v1\/?$/, '').replace(/\/+$/, '');
  return {
    API_HOST: host,
    API_BASE: `${host}/api/v1`,
  };
}

export const { API_HOST, API_BASE } = resolveApiConfig();

if (typeof window !== 'undefined') {
  console.info('[BS Hotel API Config]', {
    API_HOST: API_HOST || '(Relative - same host)',
    API_BASE,
  });
}
