import { requestProblemList } from './problemsApi'
import { toProblemListResponse } from './problemsDto'
import { toProblemListParams } from './problemsRequestDto'

export const getProblemList = async (params = {}) => {
  const response = await requestProblemList(toProblemListParams(params))
  return toProblemListResponse(response)
}
