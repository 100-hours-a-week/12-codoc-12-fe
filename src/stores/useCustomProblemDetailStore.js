import { create } from 'zustand'

const toKey = (customProblemId) => (customProblemId ? String(customProblemId) : null)

export const useCustomProblemDetailStore = create((set, get) => ({
  problems: {},
  inflight: {},
  setProblem: (customProblemId, payload) => {
    const key = toKey(customProblemId)
    if (!key) {
      return
    }
    const { problems } = get()
    set({ problems: { ...problems, [key]: payload } })
  },
  clearProblem: (customProblemId) => {
    const key = toKey(customProblemId)
    if (!key) {
      return
    }
    const { problems } = get()
    if (!problems[key]) {
      return
    }
    const next = { ...problems }
    delete next[key]
    set({ problems: next })
  },
  clearProblems: () => set({ problems: {}, inflight: {} }),
  fetchProblem: async (customProblemId, fetcher) => {
    const key = toKey(customProblemId)
    if (!key) {
      return null
    }
    const { problems, inflight } = get()
    if (problems[key]) {
      return problems[key]
    }
    if (inflight[key]) {
      return inflight[key]
    }

    const promise = (async () => {
      try {
        const data = await fetcher(customProblemId)
        set((state) => ({
          problems: { ...state.problems, [key]: data },
        }))
        return data
      } finally {
        set((state) => {
          if (!state.inflight[key]) {
            return state
          }
          const nextInflight = { ...state.inflight }
          delete nextInflight[key]
          return { inflight: nextInflight }
        })
      }
    })()

    set((state) => ({
      inflight: { ...state.inflight, [key]: promise },
    }))

    return promise
  },
}))
