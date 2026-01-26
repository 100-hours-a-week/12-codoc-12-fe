export const STATUS_OPTIONS = [
  { value: 'not_attempted', label: '미시도' },
  {
    value: 'in_progress',
    label: '시도 중',
    pillClass: 'bg-rose-200/80 text-rose-900',
  },
  {
    value: 'summary_card_passed',
    label: '요약 카드 해결',
    pillClass: 'bg-amber-200/80 text-amber-900',
  },
  { value: 'solved', label: '해결', pillClass: 'bg-emerald-200/80 text-emerald-900' },
]
