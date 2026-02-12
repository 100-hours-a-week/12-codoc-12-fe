import { useRateLimitStore } from '@/stores/useRateLimitStore'

export const CHATBOT_STREAM_RATE_LIMIT_CODE = 'CHATBOT_STREAM_RATE_LIMIT_EXCEEDED'
const DEFAULT_RATE_LIMIT_MESSAGE = '제한 요청 횟수를 초과했습니다.'

const getRetryAfterValue = (headers) => {
  if (!headers) {
    return null
  }
  if (typeof headers.get === 'function') {
    return headers.get('Retry-After')
  }
  return headers['retry-after'] ?? headers['Retry-After'] ?? null
}

const parseRetryAfterSeconds = (value) => {
  if (!value) {
    return null
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.ceil(value))
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    const numericMatch = trimmed.match(/-?\d+(?:\.\d+)?/)
    if (numericMatch) {
      const seconds = Number(numericMatch[0])
      if (Number.isFinite(seconds)) {
        return Math.max(0, Math.ceil(seconds))
      }
    }

    const dateMs = Date.parse(trimmed)
    if (Number.isNaN(dateMs)) {
      return null
    }
    return Math.max(0, Math.ceil((dateMs - Date.now()) / 1000))
  }
  return null
}

const parseRetryAfter = (value) => {
  if (!value) {
    return null
  }
  const seconds = Number(value)
  if (Number.isFinite(seconds)) {
    return Date.now() + seconds * 1000
  }
  const dateMs = Date.parse(value)
  return Number.isNaN(dateMs) ? null : dateMs
}

export const getRetryAfterSeconds = (response) =>
  parseRetryAfterSeconds(getRetryAfterValue(response?.headers))

const getRateLimitPayload = (response, payload) => payload ?? response?.data ?? null

export const getRateLimitCode = (response, payload) => {
  const source = getRateLimitPayload(response, payload)
  return source?.code ?? source?.data?.code ?? source?.errorCode ?? null
}

export const getRateLimitMessage = (response, payload) => {
  const source = getRateLimitPayload(response, payload)
  return source?.message ?? source?.data?.message ?? DEFAULT_RATE_LIMIT_MESSAGE
}

export const isChatbotStreamRateLimit = (response, payload) =>
  response?.status === 429 && getRateLimitCode(response, payload) === CHATBOT_STREAM_RATE_LIMIT_CODE

export const applyRateLimitFromResponse = (response, payload) => {
  if (!response || response.status !== 429) {
    return false
  }
  if (isChatbotStreamRateLimit(response, payload)) {
    return false
  }
  const retryAt = parseRetryAfter(getRetryAfterValue(response.headers))
  useRateLimitStore.getState().setRateLimit(retryAt)
  return true
}
