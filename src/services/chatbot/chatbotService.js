import { getAccessToken } from '@/lib/auth'

import { requestChatbotMessage } from './chatbotApi'
import {
  normalizeChatbotStatus,
  parseChatbotStreamEvent,
  toChatbotMessageResponse,
} from './chatbotDto'
import { toChatbotMessageRequest } from './chatbotRequestDto'

export const sendChatbotMessage = async (payload = {}) => {
  const response = await requestChatbotMessage(toChatbotMessageRequest(payload))
  return toChatbotMessageResponse(response)
}

export const createChatbotStream = (conversationId, handlers = {}) => {
  const { onToken, onFinal, onError, onStatus } = handlers
  const controller = new AbortController()
  const baseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')
  const url = `${baseUrl}/api/chatbot/messages/${conversationId}/stream`
  const token = getAccessToken()

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
        method: 'GET',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        credentials: 'include',
        signal: controller.signal,
      })

      if (!response.ok) {
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
