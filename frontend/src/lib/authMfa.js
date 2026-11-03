import { apiClient } from '@/api/apiClient'

export async function loginWithMfa(email, password) {
  const result = await apiClient.auth.login(email, password)
  return result
}

export async function continueMfa(result, returnTo) {
  return result
}

export async function loginWithSocial(provider, returnTo) {
  return apiClient.auth.login('admin@bshotel.com', 'admin')
}

export function loginWithGoogle(returnTo) {
  return loginWithSocial('google', returnTo)
}

export default {
  loginWithMfa,
  continueMfa,
  loginWithSocial,
  loginWithGoogle,
}
