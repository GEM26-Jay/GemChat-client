import { ApiResult, FriendRequest, UserFriend } from '@shared/types'
import { axiosClient } from './axiosClient'

export async function postFriendRequestUpdate(
  data: FriendRequest
): Promise<ApiResult<FriendRequest>> {
  const result = await axiosClient.post<ApiResult<FriendRequest>>('/api/friend/request/update', {
    ...data
  })
  const apiResult = result.data

  return apiResult
}

export async function getFriendRequestSync(
  latestAt: number | null
): Promise<ApiResult<FriendRequest[]>> {
  const result = await axiosClient.get<ApiResult<FriendRequest[]>>('/api/friend/request/sync', {
    params: latestAt ? { latestAt } : undefined
  })
  const apiResult = result.data

  return apiResult
}

export async function getUserFriendSync(latestAt: number | null): Promise<ApiResult<UserFriend[]>> {
  const result = await axiosClient.get<ApiResult<UserFriend[]>>('/api/friend/sync', {
    params: latestAt ? { latestAt } : undefined
  })
  const apiResult = result.data

  return apiResult
}

export async function postFriendRequestApply(
  request: FriendRequest
): Promise<ApiResult<FriendRequest>> {
  const result = await axiosClient.post<ApiResult<FriendRequest>>(
    '/api/friend/request/apply',
    request
  )
  const apiResult = result.data

  return apiResult
}

export async function postUserFriendUpdateRemark(
  userFriend: UserFriend
): Promise<ApiResult<UserFriend>> {
  const result = await axiosClient.post<ApiResult<UserFriend>>(
    '/api/friend/updateRemark',
    userFriend
  )
  const apiResult = result.data

  return apiResult
}

export async function postUserFriendUpdateBlock(
  userFriend: UserFriend
): Promise<ApiResult<UserFriend[]>> {
  const result = await axiosClient.post<ApiResult<UserFriend[]>>(
    '/api/friend/updateBlock',
    userFriend
  )
  const apiResult = result.data

  return apiResult
}

export async function postUserFriendUpdateDelete(
  userFriend: UserFriend
): Promise<ApiResult<UserFriend[]>> {
  const result = await axiosClient.post<ApiResult<UserFriend[]>>(
    '/api/friend/updateDelete',
    userFriend
  )
  const apiResult = result.data

  return apiResult
}
