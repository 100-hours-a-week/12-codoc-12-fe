import axios from 'axios'

import { api } from '@/lib/api'

export const requestUploadUrls = async (images) => {
  const response = await api.post('/api/custom-problems/upload-urls', { images })
  return response.data
}

export const uploadImageToS3 = async (uploadUrl, file) => {
  await axios.put(uploadUrl, file, {
    headers: { 'Content-Type': file.type },
  })
}

export const requestCreateCustomProblem = async (images) => {
  const response = await api.post('/api/custom-problems', { images })
  return response.data
}

export const requestCustomProblemList = async (params = {}) => {
  const response = await api.get('/api/user/custom-problems', { params })
  return response.data
}

export const requestCustomProblemDetail = async (customProblemId) => {
  const response = await api.get(`/api/custom-problems/${customProblemId}`)
  return response.data
}

export const requestDeleteCustomProblem = async (customProblemId) => {
  await api.delete(`/api/custom-problems/${customProblemId}`)
}
