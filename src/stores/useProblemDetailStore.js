import { create } from 'zustand'

const toKey = (problemId) => (problemId ? String(problemId) : null)

export const useProblemDetailStore = create((set, get) => ({
  problems: {},
  inflight: {},
  setProblem: (problemId, payload) => {
    const key = toKey(problemId)
    if (!key) {
      return
    }
    const { problems } = get()
    set({ problems: { ...problems, [key]: payload } })
  },
  clearProblem: (problemId) => {
    const key = toKey(problemId)
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
  fetchProblem: async (problemId, fetcher) => {
    const key = toKey(problemId)
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
        const data = await fetcher(problemId)
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
