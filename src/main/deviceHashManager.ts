import { app } from 'electron'
import * as os from 'os'
import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'

// 定义设备信息接口
interface DeviceInfo {
  platform: string
  arch: string
  release: string
  hostname: string
  cpus: number
  totalMem: number
  networkInterfaces: string
  electronVersion: string
  appVersion: string
}

// 设备哈希管理器类
export class DeviceHashManager {
  private static instance: DeviceHashManager
  private deviceHashPath: string

  private constructor() {
    // 确定存储设备哈希的文件路径
    this.deviceHashPath = path.join(app.getPath('userData'), 'device-hash.json')
  }

  // 单例模式获取实例
  public static getInstance(): DeviceHashManager {
    if (!DeviceHashManager.instance) {
      DeviceHashManager.instance = new DeviceHashManager()
    }
    return DeviceHashManager.instance
  }

  // 获取设备唯一哈希
  public async getDeviceHash(): Promise<string> {
    // 检查是否已有存储的哈希
    const existingHash = this.loadExistingHash()
    if (existingHash) {
      return existingHash
    }

    // 生成新的设备哈希
    const deviceInfo = this.collectDeviceInfo()
    const newHash = this.generateHash(deviceInfo)

    // 保存新哈希到本地
    this.saveHash(newHash)

    return newHash
  }

  // 收集设备信息
  private collectDeviceInfo(): DeviceInfo {
    // 收集网络接口信息（简化处理）
    const networkInterfaces = Object.values(os.networkInterfaces())
      .flat()
      .filter((iface) => iface && !iface.internal && iface.mac !== '00:00:00:00:00:00')
      .map((iface) => iface!.mac)
      .sort()
      .join('|')

    return {
      platform: os.platform(),
      arch: os.arch(),
      release: os.release(),
      hostname: os.hostname(),
      cpus: os.cpus().length,
      totalMem: os.totalmem(),
      networkInterfaces: networkInterfaces,
      electronVersion: process.versions.electron,
      appVersion: app.getVersion()
    }
  }

  // 生成256位哈希
  private generateHash(deviceInfo: DeviceInfo): string {
    // 将设备信息转换为字符串
    const infoString = JSON.stringify(deviceInfo, Object.keys(deviceInfo).sort())

    // 创建SHA-256哈希
    return crypto.createHash('sha256').update(infoString).digest('hex')
  }

  // 加载已存在的哈希
  private loadExistingHash(): string | null {
    try {
      if (fs.existsSync(this.deviceHashPath)) {
        const data = fs.readFileSync(this.deviceHashPath, 'utf8')
        const parsed = JSON.parse(data)
        return parsed.deviceHash as string
      }
    } catch (error) {
      console.error('Failed to load existing device hash:', error)
    }
    return null
  }

  // 保存哈希到本地
  private saveHash(hash: string): void {
    try {
      const data = JSON.stringify(
        {
          deviceHash: hash,
          createdAt: new Date().toISOString()
        },
        null,
        2
      )

      fs.writeFileSync(this.deviceHashPath, data, 'utf8')
      console.log('Device hash saved successfully')
    } catch (error) {
      console.error('Failed to save device hash:', error)
    }
  }
}
