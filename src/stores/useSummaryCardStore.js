import { create } from 'zustand'

const createInitialSession = () => ({
  selectedChoices: {},
  gradingResults: [],
})

export const useSummaryCardStore = create((set, get) => ({
  sessions: {},
  updateSession: (problemId, patch) => {
    if (!problemId) {
      return
    }
    const key = String(problemId)
    const { sessions } = get()
    const prev = sessions[key] ?? createInitialSession()
    set({ sessions: { ...sessions, [key]: { ...prev, ...patch } } })
  },
  resetSession: (problemId) => {
    if (!problemId) {
      return
    }
    const key = String(problemId)
    const { sessions } = get()
    set({ sessions: { ...sessions, [key]: createInitialSession() } })
  },
  clearSessions: () => set({ sessions: {} }),
}))
