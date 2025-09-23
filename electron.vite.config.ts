import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { resolve } from 'path'
import react from '@vitejs/plugin-react'

// 提取别名配置为共享变量
const alias = {
  '@renderer': resolve('src/renderer/src'),
  '@shared': resolve('src/shared'),
  '@main': resolve('src/main')
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias } // 主进程添加别名
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias } // 预加载脚本也添加别名
  },
  renderer: {
    // 设置根目录为 renderer/
    root: resolve(__dirname, 'src/renderer'),
    plugins: [react()],
    build: {
      rollupOptions: {
        input: {
          // 指向与 src 同级的 HTML 文件
          home: resolve(__dirname, 'src/renderer/home.html'),
          login: resolve(__dirname, 'src/renderer/login.html'),
          register: resolve(__dirname, 'src/renderer/register.html'),
          addFriend: resolve(__dirname, 'src/renderer/addFriend.html'),
          addSession: resolve(__dirname, 'src/renderer/addSession.html')
        },
        output: {
          // 确保资源输出到正确位置
          assetFileNames: 'assets/[name].[ext]'
        }
      }
    },
    resolve: { alias },
    server: {
      port: 5173,
      fs: {
        // 允许访问 renderer/ 下所有文件
        allow: [resolve(__dirname, 'src/renderer')]
      },
      proxy: {
        // 将 /api 开头的请求转发到后端 8100 端口
        '/userApi': {
          target: 'http://localhost:8088',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/userApi/, '')
        }
      }
    }
  }
})
