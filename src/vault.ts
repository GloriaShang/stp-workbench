import { create } from 'zustand'
import {
  addTasks,
  checkDailyDir,
  deleteTask,
  ensurePermission,
  forgetVault,
  fsSupported,
  loadSavedVault,
  moveTask,
  pickVault,
  readDay,
  updateTask,
  type DayFile,
  type ObsidianTask,
} from './lib/obsidian'
import { useStore } from './store'

export type VaultStatus = 'unsupported' | 'none' | 'needs-permission' | 'no-daily-dir' | 'ready'

interface VaultState {
  handle?: FileSystemDirectoryHandle
  status: VaultStatus
  days: Record<string, DayFile>
  error?: string
  busy: boolean
  init: () => Promise<void>
  connect: () => Promise<void>
  reauthorize: () => Promise<void>
  disconnect: () => Promise<void>
  load: (dates: string[]) => Promise<void>
  toggle: (t: ObsidianTask) => Promise<void>
  update: (t: ObsidianTask, patch: Partial<Pick<ObsidianTask, 'start' | 'end' | 'text' | 'status'>>) => Promise<void>
  move: (t: ObsidianTask, date: string, start: string, end: string) => Promise<void>
  remove: (t: ObsidianTask) => Promise<void>
  add: (date: string, items: { start: string; end: string; text: string }[]) => Promise<void>
  clearError: () => void
}

const cfg = () => useStore.getState().obsidian

export const useVault = create<VaultState>((set, get) => {
  async function settle(h: FileSystemDirectoryHandle) {
    const ok = await checkDailyDir(h, cfg())
    set({ handle: h, status: ok ? 'ready' : 'no-daily-dir', days: {} })
  }

  /** 写操作的统一包装：出错时记下信息，并重新读取受影响的日期 */
  async function op(dates: string[], fn: (h: FileSystemDirectoryHandle) => Promise<void>) {
    const h = get().handle
    if (!h || get().status !== 'ready') return
    set({ busy: true })
    try {
      await fn(h)
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) })
    } finally {
      await get().load(dates)
      set({ busy: false })
    }
  }

  return {
    status: fsSupported() ? 'none' : 'unsupported',
    days: {},
    busy: false,

    init: async () => {
      if (!fsSupported()) return
      const h = await loadSavedVault()
      if (!h) return
      if (await ensurePermission(h, false)) await settle(h)
      else set({ handle: h, status: 'needs-permission' })
    },
    connect: async () => {
      try {
        const h = await pickVault()
        if (await ensurePermission(h, true)) await settle(h)
      } catch (e) {
        if ((e as DOMException).name !== 'AbortError') set({ error: String(e) })
      }
    },
    reauthorize: async () => {
      const h = get().handle
      if (h && (await ensurePermission(h, true))) await settle(h)
    },
    disconnect: async () => {
      await forgetVault()
      set({ handle: undefined, status: 'none', days: {} })
    },
    load: async (dates) => {
      const h = get().handle
      if (!h || get().status !== 'ready') return
      const results = await Promise.all(dates.map((d) => readDay(h, cfg(), d)))
      const prev = get().days
      let changed = false
      const next = { ...prev }
      for (const r of results) {
        const old = prev[r.date]
        if (!old || old.lastModified !== r.lastModified || old.exists !== r.exists) {
          next[r.date] = { date: r.date, exists: r.exists, lastModified: r.lastModified, tasks: r.tasks }
          changed = true
        }
      }
      if (changed) set({ days: next })
    },
    toggle: (t) => op([t.date], (h) => updateTask(h, cfg(), t, { status: t.status === ' ' ? 'x' : ' ' })),
    update: (t, patch) => op([t.date], (h) => updateTask(h, cfg(), t, patch)),
    move: (t, date, start, end) => op([t.date, date], (h) => moveTask(h, cfg(), t, date, start, end)),
    remove: (t) => op([t.date], (h) => deleteTask(h, cfg(), t)),
    add: (date, items) => op([date], (h) => addTasks(h, cfg(), date, items)),
    clearError: () => set({ error: undefined }),
  }
})
