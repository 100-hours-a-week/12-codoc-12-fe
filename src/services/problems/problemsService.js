import {
  requestProblemBookmark,
  requestProblemBookmarkRemoval,
  requestProblemDetail,
  requestProblemList,
  requestActiveProblemSession,
  requestProblemSessionClose,
  requestProblemSession,
  requestProblemSearch,
} from './problemsApi'
import {
  toProblemBookmarkResponse,
  toProblemDetailResponse,
  toProblemListResponse,
  toProblemSessionResponse,
} from './problemsDto'
import { toProblemListParams } from './problemsRequestDto'

export const getProblemList = async (params = {}) => {
  const normalizedParams = toProblemListParams(params)
  const response = normalizedParams.query
    ? await requestProblemSearch(normalizedParams)
    : await requestProblemList(normalizedParams)
  return toProblemListResponse(response)
}

export const getProblemDetail = async (problemId) => {
  const response = await requestProblemDetail(problemId)
  return toProblemDetailResponse(response)
}

export const startProblemSession = async (problemId) => {
  const response = await requestProblemSession(problemId)
  return toProblemSessionResponse(response)
}

export const getActiveProblemSession = async () => {
  const response = await requestActiveProblemSession()
  return toProblemSessionResponse(response)
}

export const closeProblemSession = async () => {
  await requestProblemSessionClose()
}

export const registerProblemBookmark = async (problemId) => {
  const response = await requestProblemBookmark(problemId)
  return toProblemBookmarkResponse(response, true)
}

export const removeProblemBookmark = async (problemId) => {
  const response = await requestProblemBookmarkRemoval(problemId)
  return toProblemBookmarkResponse(response, false)
}
