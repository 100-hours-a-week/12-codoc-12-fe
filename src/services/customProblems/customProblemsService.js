import {
  requestUploadUrls,
  uploadImageToS3,
  requestCreateCustomProblem,
  requestCustomProblemList,
  requestCustomProblemDetail,
  requestDeleteCustomProblem,
} from './customProblemsApi'
import {
  toCustomProblemListResponse,
  toCustomProblemCreateResponse,
  toCustomProblemDetailResponse,
  toUploadUrlsResponse,
} from './customProblemsDto'
import {
  toUploadUrlsRequest,
  toCreateRequest,
  toCustomProblemListParams,
} from './customProblemsRequestDto'

export const getCustomProblemList = async (params = {}) => {
  const normalizedParams = toCustomProblemListParams(params)
  const response = await requestCustomProblemList(normalizedParams)
  return toCustomProblemListResponse(response)
}

export const getCustomProblemDetail = async (customProblemId) => {
  const response = await requestCustomProblemDetail(customProblemId)
  return toCustomProblemDetailResponse(response)
}

export const createCustomProblem = async (files, onProgress) => {
  onProgress?.('upload')

  const uploadUrlsRequestImages = toUploadUrlsRequest(files)
  const response = await requestUploadUrls(uploadUrlsRequestImages)
  const uploadUrls = toUploadUrlsResponse(response)

  await Promise.all(
    uploadUrls.map((urlItem) => {
      const file = files[urlItem.order - 1]
      return uploadImageToS3(urlItem.uploadUrl, file)
    }),
  )

  onProgress?.('create')

  const createRequestImages = toCreateRequest(uploadUrls)
  const createResponse = await requestCreateCustomProblem(createRequestImages)
  return toCustomProblemCreateResponse(createResponse)
}

export const deleteCustomProblem = async (customProblemId) => {
  await requestDeleteCustomProblem(customProblemId)
}
