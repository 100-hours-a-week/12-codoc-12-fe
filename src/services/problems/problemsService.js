import { requestProblemDetail, requestProblemList } from './problemsApi'
import { toProblemDetailResponse, toProblemListResponse } from './problemsDto'
import { toProblemListParams } from './problemsRequestDto'

export const getProblemList = async (params = {}) => {
  const response = await requestProblemList(toProblemListParams(params))
  return toProblemListResponse(response)
}

export const getProblemDetail = async (problemId) => {
  const response = await requestProblemDetail(problemId)
  return toProblemDetailResponse(response)
}
