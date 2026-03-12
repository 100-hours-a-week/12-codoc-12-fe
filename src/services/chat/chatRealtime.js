import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client/dist/sockjs'

import { getAccessToken, getAccessTokenPayload, refreshAccessToken } from '@/lib/auth'

const WS_ENDPOINT_PATH = '/ws-chat'
const TOKEN_EXPIRY_SKEW_MS = 3000

const resolveWsEndpoint = () => {
  const baseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')
  return `${baseUrl}${WS_ENDPOINT_PATH}`
}

const isAccessTokenExpired = (token) => {
  if (!token) {
    return true
  }

  const payload = getAccessTokenPayload(token)
  const expMs = Number(payload?.exp) * 1000

  if (!Number.isFinite(expMs) || expMs <= 0) {
    return false
  }

  return Date.now() >= expMs - TOKEN_EXPIRY_SKEW_MS
}

const resolveConnectToken = async () => {
  let token = getAccessToken()

  if (!token || isAccessTokenExpired(token)) {
    try {
      token = await refreshAccessToken()
    } catch {
      token = getAccessToken()
    }
  }

  return token
}

const safeParseJson = (value = '') => {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

export const toChatRoomTopic = (roomId) => `/sub/chat/rooms/${roomId}`

export const toUserChatRoomsTopic = (userId) => `/sub/users/${userId}/chat-rooms`

export const toChatMessageSendDestination = (roomId) => `/pub/chat/messages/${roomId}`

export const toChatMessageReadAckDestination = (roomId) => `/pub/chat/messages/${roomId}/read-ack`

export const createChatStompConnection = (options = {}) => {
  const {
    reconnectDelay = 2000,
    onConnecting,
    onConnect,
    onDisconnect,
    onWebSocketClose,
    onWebSocketError,
    onStompError,
  } = options

  const client = new Client({
    webSocketFactory: () => new SockJS(resolveWsEndpoint()),
    reconnectDelay,
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,
    debug: () => {},
  })

  client.beforeConnect = async () => {
    onConnecting?.()
    const token = await resolveConnectToken()
    client.connectHeaders = token ? { Authorization: `Bearer ${token}` } : {}
  }

  client.onConnect = (frame) => {
    onConnect?.(frame)
  }

  client.onDisconnect = (frame) => {
    onDisconnect?.(frame)
  }

  client.onWebSocketClose = (event) => {
    onWebSocketClose?.(event)
  }

  client.onWebSocketError = (event) => {
    onWebSocketError?.(event)
  }

  client.onStompError = (frame) => {
    onStompError?.(frame)
  }

  return {
    activate: () => client.activate(),
    deactivate: () => client.deactivate(),
    isConnected: () => client.connected,
    isActive: () => client.active,
    subscribe: (destination, handler, headers = {}) =>
      client.subscribe(
        destination,
        (message) => {
          handler(safeParseJson(message.body), message)
        },
        headers,
      ),
    publishJson: (destination, payload = {}, headers = {}) => {
      if (!client.connected) {
        throw new Error('STOMP_NOT_CONNECTED')
      }

      client.publish({
        destination,
        body: JSON.stringify(payload),
        headers,
      })
    },
  }
}
