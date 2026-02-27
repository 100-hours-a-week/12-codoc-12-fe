import { create } from 'zustand'

const createSessionPayload = (payload = {}) => ({
  sessionId: payload.sessionId ?? null,
  problemId: payload.problemId ?? null,
  expiresAt: payload.expiresAt ?? null,
  summaryCards: Array.isArray(payload.summaryCards) ? payload.summaryCards : [],
  quizzes: Array.isArray(payload.quizzes) ? payload.quizzes : [],
})

export const useProblemSessionStore = create((set, get) => ({
  sessions: {},
  setSession: (problemId, payload) => {
    if (!problemId) {
      return
    }
    const key = String(problemId)
    const next = createSessionPayload(payload)
    const { sessions } = get()
    set({ sessions: { ...sessions, [key]: next } })
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
  },
  clearAllSessions: () => set({ sessions: {} }),
}))
