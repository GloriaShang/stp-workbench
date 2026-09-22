/**
 * 全局的"今天"：页面一直开着（比如装成应用常驻）也会在 0 点自动切到新的一天。
 * 0 点定时切换；另外每分钟、从睡眠唤醒、切回窗口时都检查一次，防止定时器被系统睡眠推迟。
 */
import { create } from 'zustand'
import { todayISO } from './lib/dates'

export const useToday = create<{ today: string }>(() => ({ today: todayISO() }))

const check = () => {
  const t = todayISO()
  if (t !== useToday.getState().today) useToday.setState({ today: t })
}

function scheduleMidnight() {
  const now = new Date()
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1)
  setTimeout(() => {
    check()
    scheduleMidnight()
  }, next.getTime() - now.getTime())
}

scheduleMidnight()
setInterval(check, 60_000)
document.addEventListener('visibilitychange', check)
window.addEventListener('focus', check)
