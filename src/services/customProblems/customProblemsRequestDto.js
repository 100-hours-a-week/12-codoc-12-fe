export const toUploadUrlsRequest = (files) =>
  files.map((file, index) => ({
    order: index + 1,
    fileName: file.name,
    contentType: file.type,
  }))

export const toCreateRequest = (uploadedImages) =>
  uploadedImages.map((image) => ({
    order: image.order,
    fileKey: image.fileKey,
  }))

export const toCustomProblemListParams = (params = {}) => {
  const nextParams = {}
  if (params.cursor) {
    nextParams.cursor = params.cursor
  }
  if (params.limit) {
    nextParams.limit = params.limit
  }
  return nextParams
}
