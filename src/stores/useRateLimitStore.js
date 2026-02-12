import { create } from 'zustand'

export const useRateLimitStore = create((set) => ({
  isRateLimited: false,
  retryAt: null,
  setRateLimit: (retryAt) =>
    set({
      isRateLimited: true,
      retryAt: Number.isFinite(retryAt) ? retryAt : (retryAt ?? null),
    }),
  clearRateLimit: () => set({ isRateLimited: false, retryAt: null }),
}))
