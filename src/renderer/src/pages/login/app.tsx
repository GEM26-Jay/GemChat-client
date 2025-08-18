import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import LoginBoard from './LoginBoard'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10 * 60 * 1000, // 缓存数据 30 分钟内视为"新鲜"，不重新请求
      retry: 1 // 请求失败时重试 1 次
    }
  }
})
// 获取页面中 id 为 'root' 的 DOM 元素作为渲染根节点，并用 createRoot 初始化
// 非空断言 ! 表示确认该元素存在
createRoot(document.getElementById('root')!).render(
  // 严格模式：开发环境下增强错误检测，无实际UI影响
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <LoginBoard></LoginBoard>
    </QueryClientProvider>
  </StrictMode>
)
