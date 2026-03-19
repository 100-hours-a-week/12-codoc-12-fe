import { create } from 'zustand'

const createInitialSession = () => ({
  currentIndex: 0,
  selectedChoices: {},
  results: {},
  explanations: {},
})

export const useCustomQuizStore = create((set, get) => ({
  sessions: {},
  initSession: (customProblemId) => {
    if (!customProblemId) {
      return
    }
    const key = String(customProblemId)
    const { sessions } = get()
    if (sessions[key]) {
      return
    }
    set({ sessions: { ...sessions, [key]: createInitialSession() } })
  },
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
