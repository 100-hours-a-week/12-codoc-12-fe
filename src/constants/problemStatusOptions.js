export const STATUS_OPTIONS = [
  { value: 'not_attempted', label: '미시도' },
  {
    value: 'in_progress',
    label: '시도 중',
    pillClass: 'bg-rose-500/90 text-white',
  },
  {
    value: 'summary_card_passed',
    label: '요약 카드 해결',
    pillClass: 'bg-amber-500/90 text-white',
  },
  { value: 'solved', label: '해결', pillClass: 'bg-blue-500/90 text-white' },
]
