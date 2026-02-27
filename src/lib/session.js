const SESSION_REQUIRED_CODES = new Set(['SESSION_REQUIRED', 'SESSION_NOT_FOUND'])

export const isSessionRequiredCode = (code) => {
  if (!code) {
    return false
  }
  return SESSION_REQUIRED_CODES.has(String(code).trim().toUpperCase())
}

export const isSessionRequiredError = (error) => {
  const status = error?.response?.status
  const code =
    error?.response?.data?.code ??
    error?.response?.data?.errorCode ??
    error?.response?.data?.error?.code ??
    error?.response?.data?.data?.code

  return (status === 400 || status === 404) && isSessionRequiredCode(code)
}

export const isSessionExpired = (expiresAt) => {
  if (!expiresAt) {
    return false
  }
  const timestamp = Date.parse(expiresAt)
  if (Number.isNaN(timestamp)) {
    return false
  }
  return timestamp <= Date.now()
}
