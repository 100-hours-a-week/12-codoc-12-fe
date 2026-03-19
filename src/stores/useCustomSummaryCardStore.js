import { create } from 'zustand'

const createInitialSession = () => ({
  selectedChoices: {},
  gradingResults: [],
})

export const useCustomSummaryCardStore = create((set, get) => ({
  sessions: {},
  updateSession: (customProblemId, patch) => {
    if (!customProblemId) {
      return
    }
    const key = String(customProblemId)
    const { sessions } = get()
    const prev = sessions[key] ?? createInitialSession()
    set({ sessions: { ...sessions, [key]: { ...prev, ...patch } } })
  },
  resetSession: (customProblemId) => {
    if (!customProblemId) {
      return
    }
    const key = String(customProblemId)
    const { sessions } = get()
    set({ sessions: { ...sessions, [key]: createInitialSession() } })
  },
  clearSessions: () => set({ sessions: {} }),
}))
