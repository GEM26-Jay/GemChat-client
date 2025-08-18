import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import router from './routes'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Provider } from 'react-redux'
import store from './store/store'

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

// 获取页面中 id 为 'root' 的 DOM 元素作为渲染根节点，并用 createRoot 初始化
createRoot(document.getElementById('root')!).render(
  // 严格模式：开发环境下增强错误检测，无实际UI影响
  <StrictMode>
    {/* React Query 上下文提供者：注入 queryClient 实例，让应用可使用数据请求功能 */}
    <QueryClientProvider client={queryClient}>
      {/* Redux 上下文提供者：注入 store 实例，让应用可使用全局状态管理 */}
      <Provider store={store}>
        {/* 路由提供者：注入路由配置，让应用可使用页面跳转等路由功能 */}
        <RouterProvider router={router}></RouterProvider>
      </Provider>
    </QueryClientProvider>
  </StrictMode>
)
