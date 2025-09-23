import { ApiResult, UniversalFile } from '@shared/types'
import { useState, useEffect } from 'react'
import electronSVG from '@renderer/assets/electron.svg'
import { useQuery, useQueryClient } from '@tanstack/react-query'

export interface LocalImageProps {
  fileName?: string
  className?: string
  alt?: string
  option?: 'avatar' | 'image'
}

// 获取图片数据的主函数 - 直接调用时确保返回Base64
const fetchAvatarData = async (fileName: string): Promise<UniversalFile> => {
  if (!fileName) throw new Error('文件名为空')

  // 直接调用接口，确保返回Base64格式
  const result: ApiResult<UniversalFile> = await window.fileManager.getAvatar(fileName, 'Base64')

  if (result.isSuccess && result.data) {
    return result.data
  }

  throw new Error(`本地文件获取失败: ${fileName}`)
}

// 获取图片数据的主函数 - 直接调用时确保返回Base64
const fetchImageData = async (fileName: string): Promise<UniversalFile> => {
  if (!fileName) throw new Error('文件名为空')

  // 直接调用接口，确保返回Base64格式
  const result: ApiResult<UniversalFile> = await window.fileManager.getUserFile(fileName, 'Base64')

  if (result.isSuccess && result.data) {
    return result.data
  }

  throw new Error(`本地文件获取失败: ${fileName}`)
}

const LocalImage: React.FC<LocalImageProps> = ({
  fileName = '',
  className = '',
  alt = 'local image',
  option = 'avatar'
}: LocalImageProps) => {
  const [src, setSrc] = useState<string>(electronSVG)
  const queryClient = useQueryClient()

  // 使用React Query管理请求和缓存
  const { data, isLoading, isError, refetch } = useQuery<UniversalFile>({
    queryKey: ['file', option, fileName],
    queryFn: () => {
      if (option === 'avatar') {
        return fetchAvatarData(fileName)
      } else {
        return fetchImageData(fileName)
      }
    },
    enabled: !!fileName
  })

  useEffect(() => {
    if (!isLoading && data) {
      // 缓存数据不是Base64格式时需要刷新
      if (data.contentType !== 'Base64' || typeof data.content !== 'string') {
        console.log(`Cache for ${fileName} is not valid Base64, refreshing...`)

        // 直接调用原始接口获取Base64数据
        fetchAvatarData(fileName).then((freshData) => {
          if (
            freshData &&
            freshData.contentType === 'Base64' &&
            typeof freshData.content === 'string'
          ) {
            // 更新缓存为正确的Base64数据
            queryClient.setQueryData(['file', fileName], freshData)
          }
        })
      }
    }
  }, [data, fileName, isLoading, queryClient])

  // 处理图片源更新
  useEffect(() => {
    if (isLoading) return

    if (isError || !data || !data.content) {
      setSrc(electronSVG)
    } else {
      // 验证缓存数据是否为有效的Base64格式
      if (data.contentType === 'Base64' && typeof data.content === 'string') {
        setSrc(`data:${data.mimeType};base64,${data.content}`)
      } else {
        // 缓存数据无效时使用默认图并触发重新请求
        setSrc(electronSVG)
        refetch()
      }
    }
  }, [data, isLoading, isError, refetch])

  // 加载状态显示占位符
  if (isLoading) {
    return <div className={className} />
  }

  return <img src={src} alt={alt} className={className} onError={() => setSrc(electronSVG)} />
}

export default LocalImage
