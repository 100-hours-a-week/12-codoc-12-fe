import {
  requestProblemBookmark,
  requestProblemBookmarkRemoval,
  requestProblemDetail,
  requestProblemList,
  requestProblemSearch,
} from './problemsApi'
import {
  toProblemBookmarkResponse,
  toProblemDetailResponse,
  toProblemListResponse,
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

export const registerProblemBookmark = async (problemId) => {
  const response = await requestProblemBookmark(problemId)
  return toProblemBookmarkResponse(response, true)
}

export const removeProblemBookmark = async (problemId) => {
  const response = await requestProblemBookmarkRemoval(problemId)
  return toProblemBookmarkResponse(response, false)
}
