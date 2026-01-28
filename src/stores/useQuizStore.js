import { create } from 'zustand'

const createInitialSession = () => ({
  currentIndex: 0,
  selectedChoices: {},
  results: {},
  attemptId: null,
  isResultView: false,
  submissionResult: null,
})

export const useQuizStore = create((set, get) => ({
  sessions: {},
  initSession: (problemId) => {
    if (!problemId) {
      return
    }
    const key = String(problemId)
    const { sessions } = get()
    if (sessions[key]) {
      return
    }
    set({ sessions: { ...sessions, [key]: createInitialSession() } })
  },
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
}))
