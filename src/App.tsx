import { useEffect } from 'react'
import CalendarPage from './pages/Calendar'
import Courses from './pages/Courses'
import Dashboard from './pages/Dashboard'
import Export from './pages/Export'
import Rules from './pages/Rules'
import Settings from './pages/Settings'
import { teachingWeekOf } from './lib/dates'
import { useStore, type Page, type ThemeMode } from './store'
import { useVault } from './vault'
import { useToday } from './today'

const NAV: { id: Page; label: string; icon: string }[] = [
  { id: 'dashboard', label: '仪表盘', icon: '◧' },
  { id: 'calendar', label: '日历', icon: '▦' },
  { id: 'courses', label: '课程', icon: '☰' },
  { id: 'rules', label: '学习规则', icon: '✓' },
  { id: 'export', label: '导出 Excel', icon: '⇩' },
  { id: 'settings', label: '设置', icon: '⚙' },
]

const NEXT_MODE: Record<ThemeMode, ThemeMode> = { system: 'light', light: 'dark', dark: 'system' }
const MODE_ICON: Record<ThemeMode, string> = { system: '◐', light: '☀', dark: '☾' }
const MODE_LABEL: Record<ThemeMode, string> = { system: '跟随系统', light: '浅色', dark: '深色' }

export default function App() {
  const { page, setPage, themeMode, set, calendar } = useStore()
  const vaultStatus = useVault((s) => s.status)

  useEffect(() => {
    useVault.getState().init()
  }, [])
  useEffect(() => {
    const root = document.documentElement
    if (themeMode === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', themeMode)
  }, [themeMode])

  const today = useToday((s) => s.today)
  const week = teachingWeekOf(calendar, today)

  return (
    <div className="flex h-screen overflow-hidden">
      <nav className="flex w-44 shrink-0 flex-col border-r border-line bg-panel-2">
        <div className="px-4 pt-4 pb-3">
          <div className="text-lg font-bold">STP 工作台</div>
          <div className="text-xs text-muted">{calendar.name}{week ? ` · 第 ${week} 周` : ''}</div>
        </div>
        <div className="flex-1 space-y-0.5 px-2">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => setPage(n.id)}
              className={`flex w-full items-center gap-2.5 rounded-md px-3 py-1.5 text-left text-[15px] ${page === n.id ? 'bg-panel font-bold text-accent shadow-sm' : 'hover:bg-panel'}`}
            >
              <span className="w-4 text-center opacity-70">{n.icon}</span>
              {n.label}
            </button>
          ))}
        </div>
        <div className="space-y-2 border-t border-line px-4 py-3 text-xs text-muted">
          <div className="flex items-center gap-1.5">
            <span className={vaultStatus === 'ready' ? 'text-ok' : 'text-muted'}>●</span>
            Obsidian {vaultStatus === 'ready' ? '已连接' : '未连接'}
          </div>
          <button className="flex items-center gap-1.5 hover:text-ink" onClick={() => set({ themeMode: NEXT_MODE[themeMode] })} title="切换明暗">
            <span>{MODE_ICON[themeMode]}</span>
            {MODE_LABEL[themeMode]}
          </button>
        </div>
      </nav>
      <main className="min-w-0 flex-1 overflow-y-auto">
        {page === 'dashboard' && <Dashboard />}
        {page === 'calendar' && <CalendarPage />}
        {page === 'courses' && <Courses />}
        {page === 'rules' && <Rules />}
        {page === 'export' && <Export />}
        {page === 'settings' && <Settings />}
      </main>
    </div>
  )
}
