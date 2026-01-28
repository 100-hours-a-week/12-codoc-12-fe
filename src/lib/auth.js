import axios from 'axios'

let accessToken = null
let refreshPromise = null

export const getAccessToken = () => accessToken

const decodeBase64Url = (value) => {
  if (!value) {
    return null
  }
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  try {
    return atob(padded)
  } catch {
    return null
  }
}

export const getAccessTokenPayload = (token = accessToken) => {
  const part = token?.split?.('.')?.[1]
  const decoded = decodeBase64Url(part)
  if (!decoded) {
    return null
  }
  try {
    return JSON.parse(decoded)
  } catch {
    return null
  }
}

export const getAccessTokenStatus = (token = accessToken) =>
  getAccessTokenPayload(token)?.status ?? null

export const setAccessToken = (token) => {
  accessToken = token
}

export const clearAccessToken = () => {
  accessToken = null
}

const refreshClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '',
  timeout: 10000,
  withCredentials: true,
})

export const refreshAccessToken = async () => {
  if (refreshPromise) {
    return refreshPromise
  }
  refreshPromise = refreshClient
    .post('/api/auth/refresh')
    .then(({ data }) => {
      const token = data?.data?.accessToken
      if (!token) {
        throw new Error('Missing access token in refresh response')
      }
      setAccessToken(token)
      return token
    })
    .finally(() => {
      refreshPromise = null
    })

  return refreshPromise
}

export const logout = async () => {
  const token = getAccessToken()
  try {
    await refreshClient.post(
      '/api/auth/logout',
      {},
      token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
    )
  } finally {
    clearAccessToken()
  }
}
