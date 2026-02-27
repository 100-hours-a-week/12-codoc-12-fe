import {
  requestChatMessages,
  requestJoinChatRoom,
  requestSearchChatRooms,
  requestSearchUserChatRooms,
  requestUserChatRooms,
} from './chatApi'
import {
  toChatMessageListResponse,
  toJoinedChatRoomListResponse,
  toSearchChatRoomListResponse,
} from './chatDto'
import {
  toChatMessageListParams,
  toChatRoomJoinRequest,
  toChatRoomListParams,
  toChatRoomSearchParams,
} from './chatRequestDto'

const normalizeRoomId = (roomId) => {
  const parsed = Number(roomId)

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error('Invalid roomId')
  }

  return parsed
}

export const getUserChatRooms = async (params = {}) => {
  const normalizedParams = toChatRoomListParams(params)
  const response = await requestUserChatRooms(normalizedParams)
  return toJoinedChatRoomListResponse(response)
}

export const searchUserChatRooms = async (params = {}) => {
  const normalizedParams = toChatRoomSearchParams(params)
  const response = await requestSearchUserChatRooms(normalizedParams)
  return toJoinedChatRoomListResponse(response)
}

export const searchChatRooms = async (params = {}) => {
  const normalizedParams = toChatRoomSearchParams(params)
  const response = await requestSearchChatRooms(normalizedParams)
  return toSearchChatRoomListResponse(response)
}

export const getChatRoomList = async (params = {}) => {
  const scope = params.scope === 'all' ? 'all' : 'joined'
  const keyword = String(params.keyword ?? '').trim()

  if (scope === 'all') {
    if (!keyword) {
      return { items: [], nextCursor: null, hasNextPage: false }
    }

    return searchChatRooms({
      cursor: params.cursor,
      limit: params.limit,
      keyword,
    })
  }

  if (keyword) {
    return searchUserChatRooms({
      cursor: params.cursor,
      limit: params.limit,
      keyword,
    })
  }

  return getUserChatRooms({
    cursor: params.cursor,
    limit: params.limit,
  })
}

export const joinChatRoom = async (params = {}) => {
  const normalizedRoomId = normalizeRoomId(params.roomId)
  const payload = toChatRoomJoinRequest(params.password)

  await requestJoinChatRoom(normalizedRoomId, Object.keys(payload).length > 0 ? payload : undefined)
}

export const getChatRoomMessages = async (params = {}) => {
  const normalizedRoomId = normalizeRoomId(params.roomId)
  const normalizedParams = toChatMessageListParams(params)
  const response = await requestChatMessages(normalizedRoomId, normalizedParams)

  return toChatMessageListResponse(response)
}
