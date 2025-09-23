import { ApiResult, ChatMessage, ChatSession, ChatGroup, GroupMember } from '@shared/types'
import { axiosClient } from './axiosClient'
import { CreateGroupDTO } from '@shared/DTO.types'

export async function getChatSessionSingleSync(
  latestAt: number | null
): Promise<ApiResult<ChatSession[]>> {
  const result = await axiosClient.get<ApiResult<ChatSession[]>>('/api/chat/session/sync/single', {
    params: latestAt ? { latestAt } : undefined
  })
  const apiResult = result.data
  return apiResult
}

export async function getChatSessionGroupSync(
  latestAt: number | null
): Promise<ApiResult<ChatSession[]>> {
  const result = await axiosClient.get<ApiResult<ChatSession[]>>('/api/chat/session/sync/group', {
    params: latestAt ? { latestAt } : undefined
  })
  const apiResult = result.data
  return apiResult
}

export async function getChatSessionSync(
  latestAt: number | null
): Promise<ApiResult<ChatSession[]>> {
  const result = await axiosClient.get<ApiResult<ChatSession[]>>('/api/chat/session/sync', {
    params: latestAt ? { latestAt } : undefined
  })
  const apiResult = result.data
  return apiResult
}

export async function postGroupAdd(createGroupDTO: CreateGroupDTO): Promise<ApiResult<ChatGroup>> {
  const result = await axiosClient.post<ApiResult<ChatGroup>>('/api/group/add', createGroupDTO)
  const apiResult = result.data
  return apiResult
}

export async function deleteGroup(groupId: string): Promise<ApiResult<void>> {
  const result = await axiosClient.delete<ApiResult<void>>('/api/group/delete', {
    params: { groupId }
  })
  const apiResult = result.data
  return apiResult
}

export async function postGroupUpdate(groupInfo: ChatGroup): Promise<ApiResult<ChatGroup>> {
  const result = await axiosClient.post<ApiResult<ChatGroup>>('/api/group/update', groupInfo)
  const apiResult = result.data
  return apiResult
}

export async function getGroupInfo(groupId: string): Promise<ApiResult<ChatGroup>> {
  const result = await axiosClient.get<ApiResult<ChatGroup>>('/api/group/info', {
    params: { groupId }
  })
  const apiResult = result.data
  return apiResult
}

export async function getGroupSync(lastUpdateAt: number): Promise<ApiResult<ChatGroup[]>> {
  const result = await axiosClient.get<ApiResult<ChatGroup[]>>('/api/group/sync', {
    params: { lastUpdateAt }
  })
  const apiResult = result.data
  return apiResult
}

export async function getGroupMemberAdd(
  groupId: string,
  userId: string
): Promise<ApiResult<GroupMember>> {
  const result = await axiosClient.get<ApiResult<GroupMember>>('/api/group/member/add', {
    params: { groupId, userId }
  })
  const apiResult = result.data
  return apiResult
}

export async function DeleteGroupMember(
  groupId: string,
  userId: string
): Promise<ApiResult<GroupMember>> {
  const result = await axiosClient.delete<ApiResult<GroupMember>>('/api/group/member/add', {
    params: { groupId, userId }
  })
  const apiResult = result.data
  return apiResult
}

export async function postGroupMemberUpdate(
  groupMember: GroupMember
): Promise<ApiResult<GroupMember>> {
  const result = await axiosClient.post<ApiResult<GroupMember>>(
    '/api/group/member/update',
    groupMember
  )
  const apiResult = result.data
  return apiResult
}

export async function getGroupMemberSync(lastUpdateAt: number): Promise<ApiResult<GroupMember[]>> {
  const result = await axiosClient.get<ApiResult<GroupMember[]>>('/api/group/member/sync', {
    params: { lastUpdateAt }
  })
  const apiResult = result.data
  return apiResult
}

export interface ChatMessageSyncItem {
  sessionId: string
  lastMessageId: string | null
}

export async function getChatMessageSyncBatch(
  data: ChatMessageSyncItem[]
): Promise<ApiResult<ChatMessage[]>> {
  const result = await axiosClient.post<ApiResult<ChatMessage[]>>(
    '/api/chat/message/syncBatch',
    data
  )
  const apiResult = result.data
  return apiResult
}
