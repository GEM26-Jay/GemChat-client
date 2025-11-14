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
        updateInfo: (user: User) => Promise<ApiResult<void>>
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
          maxTimestamp: number,
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
        // 给渲染进程的响应
        onReceiveMessage: (callback) => void
        onSendMessage: (callback) => void
        onMessageAckSuccess: (callback) => void
        onMessageAckFailed: (callback) => void
        sendText: (sessionId: string, content: string) => Promise<ApiResult<ChatMessage>>
        sendFile: (sessionId: string, file: UniversalFile) => Promise<ApiResult<ChatMessage>>
        downloadChatFile: (fileName: string) =>  Promise<ApiResult<void>>
      }
      file: {
        getAll: () => Promise<ApiResult<FileMap[]>>
        getByCursor: (startId: number, size: number) => Promise<ApiResult<FileMap[]>>
        add: (fileMap: FileMap) => Promise<ApiResult<void>>
        getInfoBySessionIdAndFingerprint: (
          sessionId: string,
          fingerprint: string
        ) => Promise<ApiResult<FileMap>>
        getAllSynced: () => Promise<ApiResult<FileMap[]>>
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
      get: (key: string) => Promise<unknown>
      set: (key: string, value: unknown) => Promise<boolean>
      onUpdate: (callback: () => void) => void
    }
    fileManager: {
      openFile(remoteName: string): unknown
      openVideoPlayer(remoteName: string): unknown
      getUserFile: (
        fileName: string,
        contentType: null | 'ArrayBuffer' | 'Base64' | 'Text'
      ) => Promise<ApiResult<UniversalFile>>
      getAvatar: (
        fileName: string,
        contentType: null | 'ArrayBuffer' | 'Base64'
      ) => Promise<ApiResult<UniversalFile>>
      uploadUserFile: (
        file: UniversalFile,
        fromType: number,
        fromSession?: string
      ) => Promise<ApiResult<UniversalFile>>
      uploadAvatar: (file: UniversalFile) => Promise<ApiResult<UniversalFile>>
      openFileDialog: (map: MimeContentTypeMap) => Promise<ApiResult<UniversalFile[]>>
      openImageViewer: (fileName: string) => Promise<void>
      otherSaveFile: (fileName: string) => Promise<void>
      openVideoPlayer: (fileName: string) => Promise<void>
      onFileProgress: (callback) => void
      onFileError: (callback) => void
    }
    update: {
      onUpdate: (callback) => void
    }
  }
}
