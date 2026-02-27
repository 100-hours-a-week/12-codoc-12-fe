import { requestSearchChatRooms, requestSearchUserChatRooms, requestUserChatRooms } from './chatApi'
import { toJoinedChatRoomListResponse, toSearchChatRoomListResponse } from './chatDto'
import { toChatRoomListParams, toChatRoomSearchParams } from './chatRequestDto'

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
