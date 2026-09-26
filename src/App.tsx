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
  const { page, setPage, themeMode, fontSize, fontBold, set, calendar } = useStore()
  const vaultStatus = useVault((s) => s.status)

  useEffect(() => {
    useVault.getState().init()
  }, [])
  useEffect(() => {
    const root = document.documentElement
    if (themeMode === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', themeMode)
  }, [themeMode])
  useEffect(() => {
    document.documentElement.style.setProperty('--app-font-size', `${fontSize}px`)
    document.documentElement.dataset.textBold = String(fontBold)
  }, [fontSize, fontBold])

  const today = useToday((s) => s.today)
  const week = teachingWeekOf(calendar, today)
  const activeNav = NAV.find((n) => n.id === page)

  return (
    <div className="flex h-[100dvh] overflow-hidden md:flex-row">
      <nav className="hidden w-44 shrink-0 flex-col border-r border-line bg-panel-2 md:flex">
        <div className="px-4 pt-4 pb-3">
          <div className="text-lg font-bold">STP 工作台</div>
          <div className="text-xs text-muted">{calendar.name}{week ? ` · 第 ${week} 周` : ''}</div>
        </div>
        <div className="flex-1 space-y-0.5 px-2">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => setPage(n.id)}
              className={`flex w-full items-center gap-2.5 rounded-md px-3 py-1.5 text-left text-base ${page === n.id ? 'bg-accent-soft font-bold text-accent' : 'hover:bg-accent-soft'}`}
            >
              <span className="w-4 text-center opacity-70">{n.icon}</span>
              {n.label}
            </button>
          ))}
        </div>
        <div className="space-y-2 border-t border-line px-4 py-3 text-xs text-muted">
          <div className="flex items-center gap-1.5">
            <span className={vaultStatus === 'ready' ? 'text-ok' : 'text-muted'}>●</span>
            Obsidian {vaultStatus === 'ready' ? '已连接' : vaultStatus === 'needs-permission' ? '日程待授权' : '未连接'}
          </div>
          <button className="flex items-center gap-1.5 hover:text-ink" onClick={() => set({ themeMode: NEXT_MODE[themeMode] })} title="切换明暗">
            <span>{MODE_ICON[themeMode]}</span>
            {MODE_LABEL[themeMode]}
          </button>
        </div>
      </nav>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-line bg-panel px-3 py-2 md:hidden">
          <div className="min-w-0">
            <div className="truncate text-base font-bold">STP 工作台</div>
            <div className="truncate text-[0.7333rem] text-muted">{activeNav?.label}{week ? ` · 第 ${week} 周` : ''}</div>
          </div>
          <div className={`shrink-0 text-xs ${vaultStatus === 'ready' ? 'text-ok' : 'text-muted'}`}>
            ● {vaultStatus === 'ready' ? '已同步' : '本机模式'}
          </div>
        </header>
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">
        {page === 'dashboard' && <Dashboard />}
        {page === 'calendar' && <CalendarPage />}
        {page === 'courses' && <Courses />}
        {page === 'rules' && <Rules />}
        {page === 'export' && <Export />}
        {page === 'settings' && <Settings />}
        </main>
        <nav className="mobile-bottom-nav grid shrink-0 grid-cols-6 border-t border-line bg-panel md:hidden" aria-label="手机端主导航">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => setPage(n.id)}
              aria-current={page === n.id ? 'page' : undefined}
              className={`flex min-w-0 flex-col items-center justify-center gap-0.5 px-0.5 py-1.5 text-[0.6667rem] ${page === n.id ? 'bg-accent-soft font-bold text-accent' : 'text-muted'}`}
            >
              <span className="text-base leading-none">{n.icon}</span>
              <span className="max-w-full truncate">{n.label.replace('学习规则', '规则').replace('导出 Excel', '导出')}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  )
}
