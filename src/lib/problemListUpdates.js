const STORAGE_KEY = 'problems:listUpdates'

const safeParse = (raw) => {
  if (!raw) {
    return null
  }
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export const queueProblemListUpdate = (update = {}) => {
  if (typeof window === 'undefined') {
    return
  }
  const id = update?.id ?? update?.problemId
  if (!id) {
    return
  }

  const raw = window.sessionStorage.getItem(STORAGE_KEY)
  const stored = safeParse(raw) ?? {}
  const key = String(id)
  stored[key] = { ...(stored[key] ?? {}), ...update, id }
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
}

export const consumeProblemListUpdates = () => {
  if (typeof window === 'undefined') {
    return null
  }
  const raw = window.sessionStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return null
  }
  window.sessionStorage.removeItem(STORAGE_KEY)
  return safeParse(raw)
}
