import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// 正式版注册离线缓存（开发时不注册，免得缓存干扰热更新）
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js'))
}
// 请求"持久存储"，避免 Chrome 在磁盘紧张时清掉本地数据
navigator.storage?.persist?.()
