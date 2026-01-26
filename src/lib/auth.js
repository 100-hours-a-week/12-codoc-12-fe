import axios from 'axios'

let accessToken = null

export const getAccessToken = () => accessToken

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
  const { data } = await refreshClient.post('/api/auth/refresh')
  const token = data?.data?.accessToken

  if (!token) {
    throw new Error('Missing access token in refresh response')
  }

  setAccessToken(token)
  return token
}
