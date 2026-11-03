const isNode = typeof window === 'undefined'

const isClearAccessTokenRequested = () =>
  !isNode && new URLSearchParams(window.location.search).get('clear_access_token') === 'true'

const clearStoredAccessToken = () => {
  if (isNode) return
  window.localStorage.removeItem('access_token')
  window.localStorage.removeItem('token')
}

export const getAccessToken = () => {
  if (isNode) return null
  return window.localStorage.getItem('access_token') || window.localStorage.getItem('token') || null
}

export const setAccessToken = (token) => {
  if (isNode) return
  if (token) {
    window.localStorage.setItem('access_token', token)
  } else {
    clearStoredAccessToken()
  }
}

const getAppParams = () => {
  if (isClearAccessTokenRequested()) {
    clearStoredAccessToken()
  }
  return {
    appId: 'bs-hotel-app',
    token: getAccessToken(),
    appBaseUrl: '',
  }
}

export const appParams = {
  ...getAppParams(),
}

export default appParams
