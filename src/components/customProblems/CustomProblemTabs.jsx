import { BookOpen, Clover } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { cn } from '@/lib/utils'

const TAB_ITEMS = [
  { id: 'problem', label: '문제', Icon: BookOpen },
  { id: 'quiz', label: '퀴즈', Icon: Clover },
]

export default function CustomProblemTabs({ activeTab, customProblemId, className }) {
  const navigate = useNavigate()

  return (
    <div className={cn('rounded-2xl bg-muted/70 px-2', className)}>
      <div className="grid grid-cols-2">
        {TAB_ITEMS.map((tab) => {
          const isEnabled = Boolean(customProblemId)

          return (
            <button
              key={tab.id}
              className={`flex flex-col items-center justify-center gap-1 px-3 py-3 text-xs font-semibold transition ${
                tab.id === activeTab
                  ? 'text-info'
                  : isEnabled
                    ? 'text-foreground/80'
                    : 'text-neutral-500'
              } ${!isEnabled ? 'cursor-not-allowed opacity-50' : ''}`}
              disabled={!isEnabled}
              onClick={() => {
                if (!customProblemId || !isEnabled) {
                  return
                }

                if (tab.id === 'problem') {
                  navigate(`/custom-problems/${customProblemId}`)
                  return
                }

                navigate(`/custom-problems/${customProblemId}/quiz`)
              }}
              type="button"
            >
              <tab.Icon className="h-5 w-5" />
              {tab.label}
              <span
                className={`mt-1 h-[2px] w-12 rounded-full ${
                  tab.id === activeTab ? 'bg-info' : 'bg-transparent'
                }`}
              />
            </button>
          )
        })}
      </div>
    </div>
  )
}
