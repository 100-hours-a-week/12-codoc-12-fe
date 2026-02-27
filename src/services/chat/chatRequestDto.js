const normalizeCursor = (value) => {
  const candidate = String(value ?? '').trim()
  return candidate || undefined
}

const normalizeLimit = (value) => {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return undefined
  }
  return parsed
}

const normalizeKeyword = (value) => {
  const candidate = String(value ?? '').trim()
  return candidate || undefined
}

export const toChatRoomListParams = (params = {}) => {
  const nextParams = {}

  const cursor = normalizeCursor(params.cursor)
  const limit = normalizeLimit(params.limit)

  if (cursor !== undefined) {
    nextParams.cursor = cursor
  }
  if (limit !== undefined) {
    nextParams.limit = limit
  }

  return nextParams
}

export const toChatRoomSearchParams = (params = {}) => {
  const nextParams = toChatRoomListParams(params)
  const keyword = normalizeKeyword(params.keyword)

  if (keyword !== undefined) {
    nextParams.keyword = keyword
  }

  return nextParams
}
