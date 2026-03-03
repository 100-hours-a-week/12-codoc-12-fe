import { create } from 'zustand'

const STORAGE_KEY = 'codoc_active_problem_session'

const createSessionPayload = (payload = {}) => ({
  sessionId: payload.sessionId ?? null,
  problemId: payload.problemId ?? null,
  expiresAt: payload.expiresAt ?? null,
  chatbotCompletedAt: payload.chatbotCompletedAt ?? null,
  summaryCards: Array.isArray(payload.summaryCards) ? payload.summaryCards : [],
  quizzes: Array.isArray(payload.quizzes) ? payload.quizzes : [],
})

const loadStoredSession = () => {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return null
    }
    const parsed = JSON.parse(raw)
    if (!parsed?.problemId || !parsed?.sessionId) {
      return null
    }
    return createSessionPayload(parsed)
  } catch {
    return null
  }
}

const persistSession = (payload) => {
  if (typeof window === 'undefined') {
    return
  }
  if (!payload?.problemId || !payload?.sessionId) {
    window.sessionStorage.removeItem(STORAGE_KEY)
    return
  }
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
}

const storedSession = loadStoredSession()
const initialSessions = storedSession?.problemId
  ? { [String(storedSession.problemId)]: storedSession }
  : {}

export const useProblemSessionStore = create((set, get) => ({
  sessions: initialSessions,
  setSession: (problemId, payload) => {
    if (!problemId) {
      return
    }
    const key = String(problemId)
    const next = createSessionPayload(payload)
    const { sessions } = get()
    set({ sessions: { ...sessions, [key]: next } })
    persistSession(next)
  },
  clearSession: (problemId) => {
    if (!problemId) {
      return
    }
    const key = String(problemId)
    const { sessions } = get()
    if (!sessions[key]) {
      return
    }
    const next = { ...sessions }
    delete next[key]
    set({ sessions: next })
    const stored = loadStoredSession()
    if (stored?.problemId && String(stored.problemId) === String(problemId)) {
      persistSession(null)
    }
  },
  clearAllSessions: () => {
    set({ sessions: {} })
    persistSession(null)
  },
}))
