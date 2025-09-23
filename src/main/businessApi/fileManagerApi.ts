import { fileMapDB } from '@main/db-manage/db_fileMap'
import { ApiResult, FileMap } from '@shared/types'
import { ipcMain } from 'electron'

export function registerFileManagerApiIpcHandlers(): void {
  // file-getAll
  ipcMain.handle('file-getAll', async (): Promise<ApiResult<FileMap[]>> => {
    return { isSuccess: true, data: await fileMapDB.getAll() }
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
    fileMapDB.add(fileMap)
    return { isSuccess: true }
  })
}
