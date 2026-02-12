import { create } from 'zustand'

const createInitialSession = () => ({
  messages: [],
  inputValue: '',
  conversationId: null,
  assistantMessageId: null,
  isStreaming: false,
  isInputBlocked: false,
  sendError: null,
})

export const useChatbotStore = create((set, get) => ({
  sessions: {},
  initSession: (problemId, initialMessages = []) => {
    if (!problemId) {
      return
    }
    const key = String(problemId)
    const { sessions } = get()
    if (sessions[key]) {
      return
    }
    set({
      sessions: {
        ...sessions,
        [key]: { ...createInitialSession(), messages: initialMessages },
      },
    })
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
  clearSessions: () => set({ sessions: {} }),
}))
