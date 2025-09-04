import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import {
  ApiResult,
  ChatMessage,
  ChatSession,
  FriendRequest,
  ChatGroup,
  GroupMember,
  LoginFormData,
  RegisterData,
  UniversalFile,
  User,
  UserFriend
} from '../shared/types'
import { CreateGroupDTO } from '@shared/DTO.types'

// 暴露electronAPI
contextBridge.exposeInMainWorld('electron', electronAPI)

// 暴露客户端数据API
contextBridge.exposeInMainWorld('clientData', {
  get: (key: string): unknown => ipcRenderer.invoke('getClientData', key),
  set: (key: string, value: unknown) => ipcRenderer.invoke('setClientData', key, value),
  onUpdate: (callback: () => void) => {
    const listener = (): void => callback()
    ipcRenderer.on('onClientDataUpdate', listener)
    return () => ipcRenderer.removeListener('onClientDataUpdate', listener)
  }
})

// 暴露文件管理器API
contextBridge.exposeInMainWorld('fileManager', {
  getUserFile: async (
    fileName: string,
    contentType: null | 'Buffer' | 'Base64' | 'Text'
  ): Promise<ApiResult<UniversalFile>> => {
    return await ipcRenderer.invoke('getUserFile', fileName, contentType)
  },
  getAvatar: async (
    fileName: string,
    contentType: null | 'Buffer' | 'Base64'
  ): Promise<ApiResult<UniversalFile>> => {
    return await ipcRenderer.invoke('getAvatar', fileName, contentType)
  },
  uploadUserFile: async (file: UniversalFile): Promise<ApiResult<UniversalFile>> => {
    return await ipcRenderer.invoke('uploadUserFile', file)
  },
  uploadAvatar: async (file: UniversalFile): Promise<ApiResult<UniversalFile>> => {
    return await ipcRenderer.invoke('uploadAvatar', file)
  },
  openFileDialog: async (
    contentType: null | 'Buffer' | 'Base64' | 'Text'
  ): Promise<ApiResult<UniversalFile[]>> => {
    return await ipcRenderer.invoke('openFileDialog', contentType)
  }
})

// 暴露业务相关API
contextBridge.exposeInMainWorld('businessApi', {
  // 用户登录注册相关
  doUserLogin: (account: string, password: string): Promise<ApiResult<User>> =>
    ipcRenderer.invoke('doUserLogin', account, password),

  doUserRegister: (data: RegisterData): Promise<ApiResult<void>> =>
    ipcRenderer.invoke('doUserRegister', data),

  // 本地账户相关
  localAccount: {
    getAll: (): Promise<LoginFormData[]> => ipcRenderer.invoke('db-localAccount-getAll'),
    addOrUpdata: (data: LoginFormData) => ipcRenderer.invoke('db-localAccount-addOrUpdata', data),
    delete: (account: string) => ipcRenderer.invoke('db-localAccount-delete', account)
  },

  // 用户相关
  user: {
    selectById: (id: string): Promise<ApiResult<User>> => ipcRenderer.invoke('user-selectById', id),
    selectByIds: (ids: string[]): Promise<ApiResult<User[]>> =>
      ipcRenderer.invoke('db-getUsersByIds', ids),
    searchUserBlur: (text: string): Promise<ApiResult<User[]>> =>
      ipcRenderer.invoke('searchUserBlur', text)
  },

  // 好友相关
  friend: {
    getValidFriends: (): Promise<ApiResult<UserFriend[]>> =>
      ipcRenderer.invoke('friend-getValidFriends'),
    getBlacklist: (): Promise<ApiResult<UserFriend[]>> => ipcRenderer.invoke('friend-getBlacklist'),
    getRequests: (): Promise<ApiResult<FriendRequest[]>> =>
      ipcRenderer.invoke('friend-getRequests'),
    requestAddFriend: (friendRequest: FriendRequest): Promise<void> =>
      ipcRenderer.invoke('friend-addRequest', friendRequest),
    updateRequest: (friendRequest: FriendRequest): Promise<void> =>
      ipcRenderer.invoke('friend-updateRequest', friendRequest),
    updateFriendRemark: (userFriend: UserFriend): Promise<ApiResult<void>> =>
      ipcRenderer.invoke('friend-updateFriendRemark', userFriend),
    updateFriendBlock: (userFriend: UserFriend): Promise<ApiResult<void>> =>
      ipcRenderer.invoke('friend-updateFriendBlock', userFriend),
    updateFriendDelete: (userFriend: UserFriend): Promise<ApiResult<void>> =>
      ipcRenderer.invoke('friend-updateFriendDelete', userFriend),
    getByTargetId: (targetId: string): Promise<ApiResult<UserFriend>> =>
      ipcRenderer.invoke('friend-getByTargetId', targetId)
  },
  chat: {
    getChatSessions: (): Promise<ApiResult<ChatSession[]>> =>
      ipcRenderer.invoke('chat-getSessions'),
    getGroupById: (groupId: string): Promise<ApiResult<ChatGroup>> =>
      ipcRenderer.invoke('chat-getGroupById', groupId),
    getSessionById: (sessionId: string): Promise<ApiResult<ChatSession>> =>
      ipcRenderer.invoke('chat-getSessionById', sessionId),
    getMessagesBySessionId: (
      sessionId: string,
      page: number,
      pageSize: number
    ): Promise<ApiResult<ChatMessage[]>> =>
      ipcRenderer.invoke('chat-getMessagesBySessionId', sessionId, page, pageSize),
    getMessagesBySessionIdUsingCursor: (
      sessionId: string,
      ltMessageId: number,
      size: number
    ): Promise<ApiResult<ChatMessage[]>> =>
      ipcRenderer.invoke('chat-getMessagesBySessionIdUsingCursor', sessionId, ltMessageId, size),
    getGroupMemberByGroupIdAndUserId: (
      groupId: string,
      userId: string
    ): Promise<ApiResult<GroupMember>> =>
      ipcRenderer.invoke('chat-getGroupMemberByGroupIdAndUserId', groupId, userId),
    getSingleSessionByUserIds: (
      firstId: string,
      secondId: string
    ): Promise<ApiResult<ChatSession>> =>
      ipcRenderer.invoke('chat-getSingleSessionByUserIds', firstId, secondId),
    getGroupSessionByGroupId: (
      groupId: string
    ): Promise<ApiResult<ChatSession>> =>
      ipcRenderer.invoke('chat-getGroupSessionByGroupId', groupId),
    createGroup: (dto: CreateGroupDTO): Promise<ApiResult<ChatGroup>> =>
      ipcRenderer.invoke('chat-createGroup', dto)
  }
})

// 窗口操作API
contextBridge.exposeInMainWorld('windowsApi', {
  openMainWindow: () => ipcRenderer.invoke('openMainWindow'),
  openRegisterWindow: () => ipcRenderer.invoke('openRegisterWindow'),
  closeLoginWindow: () => ipcRenderer.invoke('closeLoginWindow'),
  closeRegisterWindow: () => ipcRenderer.invoke('closeRegisterWindow'),
  openAddFriendWindow: () => ipcRenderer.invoke('openAddFriendWindow'),
  openAddSessionWindow: () => ipcRenderer.invoke('openAddSessionWindow'),
  closeAddSessionWindow: () => ipcRenderer.invoke('closeAddSessionWindow'),
  navigateMainWindow: (navPath: string) => ipcRenderer.invoke('navigateMainWindow', navPath),
  onNavigateMainWindow: (callback) => {
    ipcRenderer.on('onNavigateMainWindow', (_event, data) => callback(data))
  }
})

// 工具API
contextBridge.exposeInMainWorld('utilApi', {
  log2main: (msg: string) => ipcRenderer.send('log2main', msg)
})

// 数据更新
contextBridge.exposeInMainWorld('update', {
  onUpdate: (callback) => {
    ipcRenderer.on('update', (_event, data) => callback(data))
  }
})
