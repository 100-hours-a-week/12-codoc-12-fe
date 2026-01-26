import axios from 'axios'

import { clearAccessToken, getAccessToken, refreshAccessToken } from './auth'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '',
  timeout: 10000,
  withCredentials: true,
})

api.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error ?? {}

    if (!response || response.status !== 401 || config?._retry) {
      return Promise.reject(error)
    }

    config._retry = true

    try {
      const token = await refreshAccessToken()
      config.headers.Authorization = `Bearer ${token}`
      return api(config)
    } catch (refreshError) {
      clearAccessToken()
      return Promise.reject(refreshError)
    }
  },
)
