import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AddSessionBoard from './addSessionBoard'

// 创建 React Query 客户端实例，用于配置和管理数据请求
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 30 * 60 * 1000, // 缓存保留30分钟
      staleTime: Infinity,
      retry: 0
    }
  }
})

createRoot(document.getElementById('root')!).render(
  // 严格模式：开发环境下增强错误检测，无实际UI影响
  <StrictMode>
    {/* React Query 上下文提供者：注入 queryClient 实例，让应用可使用数据请求功能 */}
    <QueryClientProvider client={queryClient}>
      <AddSessionBoard></AddSessionBoard>
    </QueryClientProvider>
  </StrictMode>
)
