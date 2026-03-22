export const CHATBOT_QUICK_ACTIONS = [
  {
    id: 'paragraph_hint',
    label: '문단별 힌트',
    toneClassName: 'border-warning/30 bg-warning-soft/50 hover:bg-warning-soft/80',
    messageType: 'ANSWER',
    buildMessage: ({ paragraphType, problemId }) =>
      `현재 ${getParagraphLabel(paragraphType)} 문단 힌트 주세요. 문제: ${problemId}`,
  },
  {
    id: 'concept_help',
    label: '개념 설명',
    toneClassName: 'border-info/20 bg-info-soft/50 hover:bg-info-soft/80',
    messageType: 'QUESTION',
    buildMessage: ({ currentNode, problemId }) =>
      `${problemId} 문제의 ${currentNode} 문단에서 필요한 알고리즘 개념을 설명해주세요.`,
  },
  {
    id: 'solve_pattern',
    label: '내 풀이 패턴 분석',
    toneClassName: 'border-success/25 bg-success-soft/50 hover:bg-success-soft/80',
    messageType: 'QUESTION',
    buildMessage: () => '내 최근 풀이 기록 기반으로 약점 패턴 분석해줘.',
  },
  {
    id: 'pseudocode',
    label: 'pseudo 코드',
    toneClassName: 'border-neutral-300 bg-neutral-50 hover:bg-neutral-150',
    messageType: 'QUESTION',
    buildMessage: ({ problemId }) => `${problemId} 문제를 pseudo코드로 보여줘.`,
  },
]

export const PARAGRAPH_TYPE_LABELS = {
  BACKGROUND: '배경',
  GOAL: '목표',
  RULE: '규칙',
  CONSTRAINT: '제약',
}

const DEFAULT_PARAGRAPH_LABEL = '배경'

export const getParagraphLabel = (paragraphType) =>
  PARAGRAPH_TYPE_LABELS[paragraphType] ?? DEFAULT_PARAGRAPH_LABEL

export const buildQuickActionMessage = (actionId, context = {}) => {
  const builder = CHATBOT_QUICK_ACTIONS.find((action) => action.id === actionId)?.buildMessage

  if (typeof builder !== 'function') {
    return ''
  }

  return builder(context)
}

const QUICK_ACTION_MATCHERS = [
  {
    id: 'paragraph_hint',
    match: (message) =>
      /^현재\s+.+\s+문단\s+힌트\s+주세요\.\s*문제(?:번호)?\s*:\s*.+$/u.test(message),
  },
  {
    id: 'concept_help',
    match: (message) =>
      /^.+\s*(?:번\s*)?문제의\s+.+\s+문단에서\s+필요한\s+알고리즘\s+개념을\s+설명해주세요\.$/u.test(
        message,
      ),
  },
  {
    id: 'solve_pattern',
    match: (message) => message === '내 최근 풀이 기록 기반으로 약점 패턴 분석해줘.',
  },
  {
    id: 'pseudocode',
    match: (message) => /^.+\s*(?:번\s*)?문제를\s+pseudo코드로\s+보여줘\.$/u.test(message),
  },
]

export const resolveQuickActionLabel = (message) => {
  const normalizedMessage = String(message ?? '').trim()

  if (!normalizedMessage) {
    return ''
  }

  const matchedAction = QUICK_ACTION_MATCHERS.find((action) => action.match(normalizedMessage))
  if (!matchedAction) {
    return normalizedMessage
  }

  return (
    CHATBOT_QUICK_ACTIONS.find((action) => action.id === matchedAction.id)?.label ??
    normalizedMessage
  )
}
