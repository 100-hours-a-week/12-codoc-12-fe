import { getAccessToken } from '@/lib/auth'
import {
  CHATBOT_STREAM_RATE_LIMIT_CODE,
  applyRateLimitFromResponse,
  getRetryAfterSeconds,
} from '@/lib/rateLimit'

import { normalizeChatbotStatus, parseChatbotStreamEvent } from './chatbotDto'
import { toChatbotMessageRequest } from './chatbotRequestDto'

export const createChatbotStream = (payload = {}, handlers = {}) => {
  const { onToken, onFinal, onError, onStatus, onRateLimit } = handlers
  const controller = new AbortController()
  const baseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')
  const url = `${baseUrl}/api/chatbot/messages/stream`
  const token = getAccessToken()

  const buildRateLimitMessage = (seconds) => {
    if (!Number.isFinite(seconds)) {
      return '요청 횟수를 초과했습니다. 잠시 후 다시 시도해주세요.'
    }
    const waitSeconds = Math.max(0, Math.ceil(seconds))
    return `요청 횟수를 초과했습니다. ${waitSeconds}초 후 다시 시도해주세요.`
  }

  const getRateLimitSecondsFromPayload = (payload = {}) => {
    const result = payload.result ?? {}
    const candidates = [
      result.retryAfterSeconds,
      result.retry_after_seconds,
      result.retryAfter,
      result.retry_after,
      payload.retryAfterSeconds,
      payload.retry_after_seconds,
      payload.retryAfter,
      payload.retry_after,
    ]
    for (const candidate of candidates) {
      const value = Number(candidate)
      if (Number.isFinite(value)) {
        return value
      }
    }
    return null
  }

  const isRateLimitPayload = (payload = {}) => {
    const result = payload.result ?? {}
    const candidates = [result.status, result.code, payload.status, payload.code]
    return candidates.some(
      (candidate) =>
        typeof candidate === 'string' &&
        candidate.trim().toUpperCase() === CHATBOT_STREAM_RATE_LIMIT_CODE,
    )
  }

  const resolveStatus = (payload = {}) => {
    const result = payload.result ?? {}
    const candidates = [result.status, result.code, payload.status, payload.code]
    for (const candidate of candidates) {
      const normalized = normalizeChatbotStatus(candidate)
      if (normalized) {
        return normalized
      }
    }

    return ''
  }

  const handleParsedEvent = (eventType, data) => {
    const parsed = parseChatbotStreamEvent(data)
    if (!parsed) {
      return
    }

    if (isRateLimitPayload(parsed)) {
      onRateLimit?.({
        code: CHATBOT_STREAM_RATE_LIMIT_CODE,
        message: buildRateLimitMessage(getRateLimitSecondsFromPayload(parsed)),
      })
      return
    }

    const result = parsed.result ?? {}
    const resolvedStatus = resolveStatus(parsed)
    if (resolvedStatus === 'FAILED') {
      onStatus?.(resolvedStatus, parsed)
      return
    }

    if (eventType === 'token') {
      const text = result.text ?? parsed.text ?? ''
      if (text) {
        onToken?.(text, parsed)
      }
      return
    }

    if (eventType === 'status') {
      const status = resolveStatus(parsed)
      if (status) {
        onStatus?.(status, parsed)
      }
      return
    }

    if (eventType === 'error') {
      const status = resolveStatus(parsed)
      if (status) {
        onStatus?.(status, parsed)
        return
      }
      onError?.(new Error('Stream error event'))
      return
    }

    if (eventType === 'final') {
      onFinal?.(parsed, data)
      const status = resolveStatus(parsed)
      if (status) {
        onStatus?.(status, parsed)
      }
    }
  }

  const parseEventBlock = (block) => {
    const lines = block.split(/\r?\n/)
    let eventType = 'message'
    const dataLines = []

    lines.forEach((line) => {
      if (line.startsWith('event:')) {
        eventType = line.replace('event:', '').trim()
        return
      }
      if (line.startsWith('data:')) {
        dataLines.push(line.replace('data:', '').trim())
      }
    })

    const data = dataLines.join('\n')
    if (!data) {
      return
    }
    handleParsedEvent(eventType, data)
  }

  const startStream = async () => {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        credentials: 'include',
        signal: controller.signal,
        body: JSON.stringify(toChatbotMessageRequest(payload)),
      })

      if (!response.ok) {
        if (response.status === 429) {
          const retryAfterSeconds = getRetryAfterSeconds(response)
          onRateLimit?.({
            code: CHATBOT_STREAM_RATE_LIMIT_CODE,
            message: buildRateLimitMessage(retryAfterSeconds),
          })
          return
        }

        if (applyRateLimitFromResponse(response)) {
          return
        }
        onError?.(new Error(`Stream error: ${response.status}`))
        return
      }

      const reader = response.body?.getReader()
      if (!reader) {
        onError?.(new Error('Stream not supported'))
        return
      }

      const decoder = new TextDecoder('utf-8')
      let buffer = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) {
          break
        }
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split(/\r?\n\r?\n/)
        buffer = parts.pop() ?? ''
        parts.forEach((part) => {
          if (part.trim()) {
            parseEventBlock(part)
          }
        })
      }
    } catch (error) {
      if (controller.signal.aborted) {
        return
      }
      onError?.(error)
    }
  }

  startStream()

  return {
    close: () => controller.abort(),
  }
}
