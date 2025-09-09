import { app, shell, BrowserWindow, ipcMain } from 'electron'
import path, { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { registerDataIpcHandlers } from './clientDataStore'
import { registerFileManageIpcHandlers } from './file-manage/fileManage'
import { registerUserApiIpcHandlers } from './businessApi/userApi'
import { registerLocalAccountApiIpcHandlers } from './businessApi/localAccountApi'
import { nettyClient } from './tcp-client/client'
import { registerFriendApiIpcHandlers } from './businessApi/friendApi'
import { registerChatApiIpcHandlers } from './businessApi/chatApi'

// ------------------------------
// 1. IPC 处理器函数（按功能模块化）
// ------------------------------

function registerAllIpcHandlers(): void {
  // 渲染进程日志
  ipcMain.on('log2main', (_event, msg: string) => {
    console.log('[Renderer Log]:', msg)
  })
  registerFileManageIpcHandlers() // 注册文件操作相关
  registerDataIpcHandlers() // 注册访问内存缓存操作
  // 业务API
  registerLocalAccountApiIpcHandlers()
  registerUserApiIpcHandlers()
  registerFriendApiIpcHandlers()
  registerChatApiIpcHandlers()
  // 未来新增的 IPC 模块只需在这里添加函数调用
}

// ------------------------------
// 2. 窗口创建逻辑
// ------------------------------

// 保存窗口引用的全局变量
let loginWindow: BrowserWindow
let registerWindow: BrowserWindow
let mainWindow: BrowserWindow
let addFriendWindow: BrowserWindow
let addSessionWindow: BrowserWindow

function createLoginWindow(): void {
  loginWindow = new BrowserWindow({
    width: 450,
    height: 650,
    resizable: true,
    titleBarStyle: 'hiddenInset',
    show: true,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  loginWindow.on('ready-to-show', () => {
    loginWindow.show()
  })

  loginWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    // 开发环境加载
    const devUrl = new URL(process.env['ELECTRON_RENDERER_URL'])
    devUrl.pathname = '/login.html' // 修改为实际 HTML 文件名
    loginWindow.loadURL(devUrl.toString())
  } else {
    // 生产环境加载
    loginWindow.loadFile(
      path.join(__dirname, '../renderer/login.html') // 生产环境路径
    )
  }
}

function createRegisterWindow(): void {
  registerWindow = new BrowserWindow({
    width: 750,
    height: 650,
    resizable: false,
    titleBarStyle: 'hiddenInset',
    show: true,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  registerWindow.on('ready-to-show', () => {
    registerWindow.show()
  })

  registerWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    // 开发环境加载
    const devUrl = new URL(process.env['ELECTRON_RENDERER_URL'])
    devUrl.pathname = '/register.html' // 修改为实际 HTML 文件名
    registerWindow.loadURL(devUrl.toString())
  } else {
    // 生产环境加载
    registerWindow.loadFile(
      path.join(__dirname, '../renderer/register.html') // 生产环境路径
    )
  }
}

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 670,
    minWidth: 700,
    minHeight: 500,
    show: true,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    // 开发环境加载
    const devUrl = new URL(process.env['ELECTRON_RENDERER_URL'])
    devUrl.pathname = '/home'
    mainWindow.loadURL(devUrl.toString())
    mainWindow.webContents.openDevTools()
  } else {
    // 生产环境加载
    mainWindow.loadFile(
      path.join(__dirname, '../renderer/home.html') // 生产环境路径
    )
  }
}

function createAddFriendWindow(): void {
  addFriendWindow = new BrowserWindow({
    width: 400,
    height: 400,
    resizable: false, // 允许调整大小
    titleBarStyle: 'default', // 使用系统默认标题栏
    frame: true, // 显示窗口框架
    show: false,
    autoHideMenuBar: true,
    minimizable: false, // 禁止最小化
    maximizable: false, // 允许最大化
    closable: true, // 允许关闭
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      transparent: false // 禁用透明背景
    }
  })

  addFriendWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    const devUrl = new URL(process.env['ELECTRON_RENDERER_URL'])
    devUrl.pathname = '/addFriend'
    addFriendWindow.loadURL(devUrl.toString())
    addFriendWindow.webContents.openDevTools()
  } else {
    addFriendWindow.loadFile(path.join(__dirname, '../renderer/addFriend.html'))
  }

  addFriendWindow.on('ready-to-show', () => {
    addFriendWindow.show()
  })
}

function createAddSessionWindow(): void {
  addSessionWindow = new BrowserWindow({
    width: 600,
    height: 600,
    resizable: false, // 允许调整大小
    titleBarStyle: 'default', // 使用系统默认标题栏
    frame: true, // 显示窗口框架
    show: false,
    autoHideMenuBar: true,
    minimizable: false, // 禁止最小化
    maximizable: false, // 允许最大化
    closable: true, // 允许关闭
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      transparent: false // 禁用透明背景
    }
  })

  addSessionWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    const devUrl = new URL(process.env['ELECTRON_RENDERER_URL'])
    devUrl.pathname = '/addSession'
    addSessionWindow.loadURL(devUrl.toString())
    addSessionWindow.webContents.openDevTools()
  } else {
    addSessionWindow.loadFile(path.join(__dirname, '../renderer/addSession.html'))
  }

  addSessionWindow.on('ready-to-show', () => {
    addSessionWindow.show()
  })
}

// ------------------------------
// 3. 应用生命周期
// ------------------------------

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // 初始化时注册所有 IPC 接口
  registerAllIpcHandlers()

  createLoginWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createLoginWindow()
  })

  ipcMain.handle('openMainWindow', async () => {
    nettyClient.connect()
    createMainWindow()
  })

  ipcMain.handle('openRegisterWindow', async () => {
    createRegisterWindow()
  })

  ipcMain.handle('closeLoginWindow', async () => {
    loginWindow?.close()
  })

  ipcMain.handle('closeRegisterWindow', async () => {
    registerWindow?.close()
  })

  ipcMain.handle('openAddFriendWindow', async () => {
    createAddFriendWindow()
  })

  ipcMain.handle('closeAddFriendWindow', async () => {
    addFriendWindow.close()
  })

  ipcMain.handle('openAddSessionWindow', async () => {
    createAddSessionWindow()
  })

  ipcMain.handle('closeAddSessionWindow', async () => {
    addSessionWindow.close()
    notifyWindows('update', 'group_member')
    notifyWindows('update', 'group')
    notifyWindows('update', 'chat_session')
  })

  ipcMain.handle('navigateMainWindow', async (_event, route) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      // 向主窗口的渲染进程发送路由跳转命令
      mainWindow.webContents.send('onNavigateMainWindow', route)
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

export function closeMainWindow(): void {
  mainWindow.close()
}

export function openLoginWindow(): void {
  createLoginWindow()
}

export function notifyWindows(topic: string, info: unknown): void {
  BrowserWindow.getAllWindows().forEach((window) => {
    // 检查窗口是否已关闭，避免操作已销毁的窗口
    if (!window.isDestroyed()) {
      window.webContents.send(topic, info)
    }
  })
}
