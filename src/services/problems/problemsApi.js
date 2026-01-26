import { api } from '@/lib/api'

const serializeParams = (params = {}) => {
  const searchParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return
    }
    if (Array.isArray(value)) {
      value.forEach((entry) => {
        searchParams.append(key, entry)
      })
      return
    }
    searchParams.append(key, value)
  })

  return searchParams.toString()
}

export const requestProblemList = async (params = {}) => {
  const response = await api.get('/api/problems', {
    params,
    paramsSerializer: { serialize: serializeParams },
  })
  return response.data
}
