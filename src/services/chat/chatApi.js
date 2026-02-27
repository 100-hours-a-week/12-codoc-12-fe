import { api } from '@/lib/api'

const serializeParams = (params = {}) => {
  const searchParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return
    }
    searchParams.append(key, value)
  })

  return searchParams.toString()
}

export const requestUserChatRooms = async (params = {}) => {
  const response = await api.get('/api/user/chat-rooms', {
    params,
    paramsSerializer: { serialize: serializeParams },
  })
  return response.data
}

export const requestSearchUserChatRooms = async (params = {}) => {
  const response = await api.get('/api/user/chat-rooms/search', {
    params,
    paramsSerializer: { serialize: serializeParams },
  })
  return response.data
}

export const requestSearchChatRooms = async (params = {}) => {
  const response = await api.get('/api/chat-rooms/search', {
    params,
    paramsSerializer: { serialize: serializeParams },
  })
  return response.data
}

export const requestJoinChatRoom = async (roomId, payload) => {
  const response = await api.post(`/api/chat-rooms/${roomId}/join`, payload)
  return response.data
}

export const requestChatMessages = async (roomId, params = {}) => {
  const response = await api.get(`/api/chat-rooms/${roomId}/messages`, {
    params,
    paramsSerializer: { serialize: serializeParams },
  })
  return response.data
}
