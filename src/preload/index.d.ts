import { ElectronAPI } from '@electron-toolkit/preload'
import { ApiResult, ChatSession, FriendRequest } from '@shared/types'

declare global {
  interface Window {
    electron: ElectronAPI
    businessApi: {
      doUserLogin: (account: string, password: string) => Promise<ApiResult<User>>
      doUserRegister: (data: RegisterData) => Promise<ApiResult<void>>
      localAccount: {
        getAll: () => LoginFormData[]
        addOrUpdata: (data: LoginFormData) => void
        delete: (account: string) => void
      }
      user: {
        selectById: (id: string) => Promise<ApiResult<User>>
        selectByIds: (ids: string[]) => Promise<ApiResult<User[]>>
        searchUserBlur: (text: string) => Promise<ApiResult<User[]>>
      }
      friend: {
        getValidFriends: () => Promise<ApiResult<UserFriend[]>>
        getBlacklist: () => Promise<ApiResult<UserFriend[]>>
        getRequests: () => Promise<ApiResult<FriendRequest[]>>
        requestAddFriend: (friendRequest: FriendRequest) => Promise<ApiResult<void>>
        updateRequest: (friendRequest: FriendRequest) => Promise<void>
        updateFriendRemark: (userFriend: UserFriend) => Promise<ApiResult<void>>
        updateFriendBlock: (userFriend: UserFriend) => Promise<ApiResult<void>>
        updateFriendDelete: (userFriend: UserFriend) => Promise<ApiResult<void>>
        getByTargetId: (targetId: string) => Promise<ApiResult<UserFriend>>
      }
      chat: {
        getChatSessions: () => Promise<ApiResult<ChatSession[]>>
        getGroupById: (groupId: string) => Promise<ApiResult<Group>>
        getSessionById: (sessionId: string) => Promise<ApiResult<ChatSession>>
        getMessagesBySessionId: (
          sessionId: string,
          page: number,
          pageSize: number
        ) => Promise<ApiResult<ChatMessage[]>>
        getMessagesBySessionIdUsingCursor: (
          sessionId: string,
          ltMessageId: number,
          size: number
        ) => Promise<ApiResult<ChatMessage[]>>
        getGroupMemberByGroupIdAndUserId: (
          groupId: string,
          userId: string
        ) => Promise<ApiResult<GroupMember>>
        getSingleSessionByUserIds: (
          firstId: string,
          secondId: string
        ) => Promise<ApiResult<ChatSession>>
        getGroupSessionByGroupId: (groupId: string) => Promise<ApiResult<ChatSession>>
        createGroup: (dto: CreateGroupDTO) => Promise<ApiResult<Group>>
      }
    }
    utilApi: {
      log2main: (msg: string) => void
    }
    windowsApi: {
      openMainWindow: () => Promise<void>
      openRegisterWindow: () => Promise<void>
      closeLoginWindow: () => Promise<void>
      closeRegisterWindow: () => Promise<void>
      openAddFriendWindow: () => Promise<void>
      openAddSessionWindow: () => Promise<void>
      closeAddSessionWindow: () => Promise<void>
      navigateMainWindow: (navPath) => Promise<void>
      onNavigateMainWindow: (callback) => void
    }
    clientData: {
      get: (key: string) => unknown
      set: (key: string, value: unknown) => boolean
      onUpdate: (callback: () => void) => void
    }
    fileManager: {
      getUserFile: (
        fileName: string,
        contentType: null | 'Buffer' | 'Base64' | 'Text'
      ) => Promise<ApiResult<UniversalFile>>
      getAvatar: (
        fileName: string,
        contentType: null | 'Buffer' | 'Base64'
      ) => Promise<ApiResult<UniversalFile>>
      uploadUserFile: (file: UniversalFile) => Promise<ApiResult<UniversalFile>>
      uploadAvatar: (file: UniversalFile) => Promise<ApiResult<UniversalFile>>
      openFileDialog: (
        contentType: null | 'Buffer' | 'Base64' | 'Text'
      ) => Promise<ApiResult<UniversalFile[]>>
    }
    update: {
      onUpdate: (callback) => void
    }
  }
}
