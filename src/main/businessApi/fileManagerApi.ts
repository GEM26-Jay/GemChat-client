import { fileMapDB } from '@main/db-manage/db_fileMap'
import { ApiResult, FileMap } from '@shared/types'
import { ipcMain } from 'electron'

export function registerFileManagerApiIpcHandlers(): void {
  // file-getAll
  ipcMain.handle('file-getAll', async (): Promise<ApiResult<FileMap[]>> => {
    return { isSuccess: true, data: await fileMapDB.getAll() }
  })
  ipcMain.handle('file-getAllSynced', async (): Promise<ApiResult<FileMap[]>> => {
    return { isSuccess: true, data: await fileMapDB.getAllSynced() }
  })
  // file-getByCursor
  ipcMain.handle(
    'file-getByCursor',
    async (_event, startId: number, size: number): Promise<ApiResult<FileMap[]>> => {
      return { isSuccess: true, data: await fileMapDB.getByCursor(startId, size) }
    }
  )
  // file-add
  ipcMain.handle('file-add', async (_event, fileMap: FileMap): Promise<ApiResult<void>> => {
    fileMapDB.addOrUpdateBySessionAndFingerprint(fileMap)
    return { isSuccess: true }
  })
  // file-getInfoBySessionIdAndFingerprint
  ipcMain.handle(
    'file-getInfoBySessionIdAndFingerprint',
    async (_event, sessionId: string, fingerprint: string): Promise<ApiResult<FileMap | null>> => {
      const re = await fileMapDB.getBySessionAndFingerprint(sessionId, fingerprint)
      return { isSuccess: true, data: re }
    }
  )
}
