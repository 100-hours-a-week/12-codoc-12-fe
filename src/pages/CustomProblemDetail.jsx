import { Sparkles } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkBreaks from 'remark-breaks'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'

import CustomProblemTabs from '@/components/customProblems/CustomProblemTabs'
import StatusMessage from '@/components/StatusMessage'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { getCustomProblemDetail } from '@/services/customProblems/customProblemsService'
import { useCustomProblemDetailStore } from '@/stores/useCustomProblemDetailStore'

const ACTIVE_TAB_ID = 'problem'

const splitWithLineBreaks = (children, keyPrefix = 'br') => {
  const list = Array.isArray(children) ? children : [children]
  return list.flatMap((child, index) => {
    if (typeof child !== 'string') {
      return child
    }
    const parts = child.split(/<br\s*\/?>/gi)
    return parts.flatMap((part, partIndex) => {
      if (partIndex === 0) {
        return part
      }
      return [<br key={`${keyPrefix}-${index}-${partIndex}`} />, part]
    })
  })
}

export default function CustomProblemDetail() {
  const { customProblemId } = useParams()
  const navigate = useNavigate()
  const [problem, setProblem] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const { fetchProblem: fetchCustomProblemDetail, clearProblem } = useCustomProblemDetailStore()

  const fetchDetail = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    try {
      const result = await fetchCustomProblemDetail(customProblemId, getCustomProblemDetail)
      setProblem(result)
    } catch {
      setLoadError('문제 상세 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.')
      setProblem(null)
    } finally {
      setIsLoading(false)
    }
  }, [customProblemId, fetchCustomProblemDetail])

  useEffect(() => {
    fetchDetail()
  }, [fetchDetail])

  const handleRetry = () => {
    clearProblem(customProblemId)
    fetchDetail()
  }

  return (
    <div className="space-y-5">
      <div className="sticky top-[52px] z-20 -mx-4 bg-background/95 px-4 pb-3 pt-3 backdrop-blur">
        <CustomProblemTabs
          activeTab={ACTIVE_TAB_ID}
          className="bg-muted/100 shadow-sm"
          customProblemId={customProblemId}
        />
      </div>

      {isLoading ? (
        <Card className="border-dashed border-muted-foreground/40 bg-muted/40 p-6 text-center">
          <StatusMessage>문제 상세 정보를 불러오는 중입니다.</StatusMessage>
        </Card>
      ) : loadError ? (
        <Card className="border-dashed border-muted-foreground/40 bg-muted/40 p-6 text-center">
          <StatusMessage tone="error">{loadError}</StatusMessage>
          <Button className="mt-4" onClick={handleRetry} type="button" variant="secondary">
            다시 시도
          </Button>
        </Card>
      ) : problem ? (
        <div className="space-y-5">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-foreground">{problem.title}</h2>
            </div>
            <div className="h-px bg-border" />
          </div>

          <Button
            className="w-full gap-2 rounded-xl py-6"
            disabled={(problem.summaryCards ?? []).length === 0}
            onClick={() => navigate(`/custom-problems/${customProblemId}/summary`)}
            type="button"
            variant="secondary"
          >
            <Sparkles className="h-5 w-5" />
            문제 요약 카드 만들기
          </Button>

          <section className="space-y-3">
            {problem.content ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkBreaks, remarkMath]}
                rehypePlugins={[rehypeKatex]}
                components={{
                  h1: ({ node: _node, ...props }) => (
                    <h2 className="mb-2 mt-6 text-lg font-bold text-foreground" {...props} />
                  ),
                  h2: ({ node: _node, ...props }) => (
                    <h2 className="mb-2 mt-6 text-lg font-bold text-foreground" {...props} />
                  ),
                  h3: ({ node: _node, ...props }) => (
                    <h3 className="mb-2 mt-4 text-base font-semibold text-foreground" {...props} />
                  ),
                  h4: ({ node: _node, ...props }) => (
                    <h4 className="mb-1 mt-3 text-sm font-semibold text-foreground" {...props} />
                  ),
                  p: ({ node: _node, ...props }) => (
                    <p className="mb-3 text-[15px] leading-[1.7] text-foreground/90" {...props} />
                  ),
                  hr: () => (
                    <div>
                      <br />
                      <hr className="border-foreground/10" />
                      <br />
                    </div>
                  ),
                  ul: ({ node: _node, ...props }) => (
                    <ul
                      className="mb-3 list-disc space-y-2 pl-5 text-[15px] text-foreground/90"
                      {...props}
                    />
                  ),
                  ol: ({ node: _node, ...props }) => (
                    <ol
                      className="mb-3 list-decimal space-y-2 pl-5 text-[15px] text-foreground/90"
                      {...props}
                    />
                  ),
                  li: ({ node: _node, ...props }) => <li className="leading-relaxed" {...props} />,
                  blockquote: ({ node: _node, ...props }) => (
                    <blockquote
                      className="rounded-xl bg-muted/40 px-4 py-3 text-[15px] leading-[1.6] text-foreground/90"
                      {...props}
                    />
                  ),
                  table: ({ node: _node, ...props }) => (
                    <div className="my-3 overflow-x-auto">
                      <table className="min-w-full text-[13px] leading-relaxed" {...props} />
                    </div>
                  ),
                  thead: ({ node: _node, ...props }) => (
                    <thead className="bg-muted/60" {...props} />
                  ),
                  tbody: ({ node: _node, ...props }) => <tbody {...props} />,
                  tr: ({ node: _node, ...props }) => (
                    <tr className="border-b border-border" {...props} />
                  ),
                  th: ({ node: _node, children, ...props }) => (
                    <th
                      className="px-3 py-2 text-left text-xs font-semibold text-foreground/80"
                      {...props}
                    >
                      {splitWithLineBreaks(children, 'th')}
                    </th>
                  ),
                  td: ({ node: _node, children, ...props }) => (
                    <td className="px-3 py-2 align-top text-xs text-foreground/90" {...props}>
                      {splitWithLineBreaks(children, 'td')}
                    </td>
                  ),
                  pre: ({ node: _node, ...props }) => (
                    <pre
                      className="my-3 overflow-x-auto rounded-xl bg-muted px-4 py-3 text-sm leading-relaxed"
                      {...props}
                    />
                  ),
                  code: ({ node: _node, inline, className, children, ...props }) => {
                    if (inline) {
                      return (
                        <code
                          className="rounded bg-muted/60 px-1.5 py-0.5 text-[0.85em] text-foreground/90"
                          {...props}
                        >
                          {children}
                        </code>
                      )
                    }

                    return (
                      <code className={className} {...props}>
                        {children}
                      </code>
                    )
                  },
                }}
              >
                {problem.content}
              </ReactMarkdown>
            ) : (
              <StatusMessage>문제 설명이 없습니다.</StatusMessage>
            )}
          </section>
        </div>
      ) : null}
    </div>
  )
}
