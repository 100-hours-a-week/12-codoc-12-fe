export const CUSTOM_PROBLEM_ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const CUSTOM_PROBLEM_MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024
export const CUSTOM_PROBLEM_MAX_IMAGE_SIZE_LABEL = '10MB'

export const validateCustomProblemImageFile = (file) => {
  if (!file) {
    return null
  }

  if (!CUSTOM_PROBLEM_ACCEPTED_TYPES.includes(file.type)) {
    return 'JPG, PNG, WEBP 형식의 이미지만 업로드할 수 있습니다.'
  }

  if (file.size > CUSTOM_PROBLEM_MAX_IMAGE_SIZE_BYTES) {
    return `이미지 용량은 ${CUSTOM_PROBLEM_MAX_IMAGE_SIZE_LABEL} 이하여야 합니다.`
  }

  return null
}
