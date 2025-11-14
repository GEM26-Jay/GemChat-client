import { MIME } from './utils'

export interface CreateGroupDTO {
  groupName: string
  userIds: string[]
}

export interface FileUploadDTO {
  name: string
  size: number
  mimeType: MIME
  fingerprint: string
  path?: string
  fromType?: number
  fromSession?: string
  fromInfo?: string
}
