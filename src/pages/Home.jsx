import { Award, CalendarDays, Flame, Sparkles } from 'lucide-react'

const quests = [
  {
    title: '오늘의 요약 카드 1장',
    detail: '빈칸 채우기까지 완료',
    points: '+20XP',
    status: '진행 중',
  },
  { title: '퀴즈 3문항 도전', detail: '30분 집중 모드', points: '+30XP', status: '대기' },
  { title: '알고리즘 문제 1개 풀이', detail: '난이도 중급', points: '+40XP', status: '완료' },
]

const heatmap = Array.from({ length: 35 }, (_, idx) => ({
  id: idx,
  level: idx % 5,
}))

const statCards = [
  { label: '연속 학습', value: '6일', icon: Flame },
  { label: '완료 퀘스트', value: '18개', icon: Award },
  { label: '이번 주 목표', value: '65%', icon: CalendarDays },
]

export default function Home() {
  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[28px] border border-foreground/10 bg-gradient-to-br from-[#fff5df] via-white to-[#e5f4ff] p-6">
        <div className="absolute -right-10 top-6 h-32 w-32 rounded-full bg-[#ffd08a] opacity-60 blur-2xl" />
        <div className="absolute -left-16 bottom-4 h-36 w-36 rounded-full bg-[#b9dcff] opacity-60 blur-2xl" />
        <div className="relative space-y-3">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Today</p>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl font-[var(--font-display)]">
            오늘은 루틴을 만들기 좋은 날
          </h2>
          <p className="text-sm text-muted-foreground">
            코독이 추천한 퀘스트를 완료하면, 새로운 문제 세트가 열립니다.
          </p>
          <div className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background">
            <Sparkles className="h-4 w-4" />
            퀘스트 추천 새로고침
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        {statCards.map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="rounded-2xl border border-foreground/10 bg-white p-4 shadow-sm"
          >
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{label}</span>
              <Icon className="h-4 w-4" />
            </div>
            <p className="mt-3 text-lg font-semibold">{value}</p>
          </div>
        ))}
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between">
          <h3 className="text-lg font-semibold">오늘의 퀘스트</h3>
          <span className="text-xs text-muted-foreground">3개 중 1개 완료</span>
        </div>
        <div className="grid gap-3">
          {quests.map((quest) => (
            <article
              key={quest.title}
              className="rounded-2xl border border-foreground/10 bg-white p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-semibold">{quest.title}</p>
                  <p className="text-xs text-muted-foreground">{quest.detail}</p>
                </div>
                <span className="rounded-full bg-muted px-3 py-1 text-[11px] font-semibold">
                  {quest.status}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>{quest.points}</span>
                <button className="font-semibold text-foreground" type="button">
                  자세히 보기
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between">
          <h3 className="text-lg font-semibold">학습 히트맵</h3>
          <span className="text-xs text-muted-foreground">지난 5주</span>
        </div>
        <div className="rounded-2xl border border-foreground/10 bg-white p-4">
          <div className="grid grid-cols-7 gap-2">
            {heatmap.map((cell) => (
              <div
                key={cell.id}
                className={`h-4 w-4 rounded-[6px] ${
                  cell.level === 0
                    ? 'bg-muted'
                    : cell.level === 1
                      ? 'bg-[#ffd08a]'
                      : cell.level === 2
                        ? 'bg-[#ffb658]'
                        : cell.level === 3
                          ? 'bg-[#ff914d]'
                          : 'bg-[#ff6b4a]'
                }`}
              />
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
            <span>이번 주 4일 연속 달성</span>
            <span>최고 기록 9일</span>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-foreground/10 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">퀘스트 리워드</h3>
            <p className="text-xs text-muted-foreground">오늘 보상을 받을 준비가 되었어요.</p>
          </div>
          <button
            className="rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background"
            type="button"
          >
            보상 수령하기
          </button>
        </div>
      </section>
    </div>
  )
}
