import { localAccountDB } from '../db-manage/db_localAccount'
import { LoginFormData } from '@shared/types'
import { ipcMain } from 'electron'

export const registerLocalAccountApiIpcHandlers = (): void => {
  ipcMain.handle('db-localAccount-getAll', async () => {
    const result = await localAccountDB.getAll()
    console.log(`[Database]: 查询数据库，获取数据：${JSON.stringify(result)}`)
    return result
  })

  ipcMain.handle('db-localAccount-addOrUpdata', async (_event, data: LoginFormData) => {
    console.log(`[Database]: 添改账号记录：${JSON.stringify(data)}`)
    return localAccountDB.addOrUpdata(data)
  })

  ipcMain.handle('db-localAccount-delete', async (_event, account: string) => {
    console.log(`[Database]: 删除账号记录：${JSON.stringify(account)}`)
    return localAccountDB.delete(account)
  })
}
