export const STATUS_OPTIONS = [
  { value: 'not_attempted', label: '미시도', pillClass: 'bg-gray-200 text-gray-700' },
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

const STATUS_MAP = {
  NOT_ATTEMPTED: 'not_attempted',
  IN_PROGRESS: 'in_progress',
  SUMMARY_CARD_PASSED: 'summary_card_passed',
  SOLVED: 'solved',
  '': 'not_attempted',
  미시도: 'not_attempted',
  '시도 중': 'in_progress',
  '요약 카드 해결': 'summary_card_passed',
  '문제 요약 카드 완료': 'summary_card_passed',
  해결: 'solved',
  성공: 'solved',
}

export const normalizeProblemStatus = (status) =>
  STATUS_MAP[status ?? ''] ?? STATUS_MAP.NOT_ATTEMPTED
