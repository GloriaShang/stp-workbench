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
  type NewTask,
  type ObsidianTask,
} from './lib/obsidian'
import { readBackup, writeBackup } from './lib/backup'
import { backupJSON, useStore } from './store'

// 本机数据最后一次改动的时间、是否已经和 vault 备份对过一次（都按网址分开存）
const LOCAL_MODIFIED = 'stp-local-modified'
const SYNCED = 'stp-vault-synced'

export type VaultStatus = 'unsupported' | 'none' | 'needs-permission' | 'no-daily-dir' | 'ready'

interface VaultState {
  handle?: FileSystemDirectoryHandle
  status: VaultStatus
  days: Record<string, DayFile>
  error?: string
  /** 普通提示（非错误），日历底部弹出 */
  notice?: string
  busy: boolean
  lastBackupAt?: number
  backup: () => Promise<void>
  init: () => Promise<void>
  connect: () => Promise<void>
  reauthorize: () => Promise<void>
  disconnect: () => Promise<void>
  load: (dates: string[]) => Promise<void>
  toggle: (t: ObsidianTask) => Promise<void>
  update: (t: ObsidianTask, patch: Partial<Pick<ObsidianTask, 'start' | 'end' | 'text' | 'status'>>) => Promise<void>
  move: (t: ObsidianTask, date: string, start: string, end: string) => Promise<void>
  remove: (t: ObsidianTask) => Promise<void>
  add: (date: string, items: NewTask[]) => Promise<void>
  clearError: () => void
}

const cfg = () => useStore.getState().obsidian

export const useVault = create<VaultState>((set, get) => {
  async function settle(h: FileSystemDirectoryHandle) {
    const ok = await checkDailyDir(h, cfg())
    set({ handle: h, status: ok ? 'ready' : 'no-daily-dir', days: {} })
    await syncBackup(h)
    if (ok) await flushLocalTasks(h)
  }

  /** 没连 vault 时建的待办，连上后搬进对应日期的 Daily Matter */
  async function flushLocalTasks(h: FileSystemDirectoryHandle) {
    const local = useStore.getState().localTasks
    if (!local.length) return
    try {
      const byDate = new Map<string, typeof local>()
      local.forEach((t) => byDate.set(t.date, [...(byDate.get(t.date) ?? []), t]))
      for (const [date, list] of byDate) {
        await addTasks(h, cfg(), date, list.map((t) => ({ status: t.done ? 'x' : ' ', start: t.start, end: t.end, text: t.text })))
      }
      useStore.getState().removeLocalTasks(local.map((t) => t.id))
      set({ notice: `已把工作台里的 ${local.length} 条待办写进 Obsidian Daily Matter` })
    } catch (e) {
      set({ error: `搬运本地待办失败：${e instanceof Error ? e.message : String(e)}` })
    }
  }

  /**
   * 连上 vault 时和备份对一次：
   *  - 这个网址第一次连 vault，或者 vault 里的备份比本机新（在别的浏览器 / 网址改过）→ 询问是否用备份恢复
   *  - 否则用本机数据更新备份
   */
  async function syncBackup(h: FileSystemDirectoryHandle) {
    try {
      const b = await readBackup(h)
      const localModified = Number(localStorage.getItem(LOCAL_MODIFIED) || 0)
      const firstTime = localStorage.getItem(SYNCED) !== '1'
      if (b && (firstTime || b.savedAt > localModified + 2000)) {
        const when = new Date(b.savedAt).toLocaleString('zh-CN')
        const ok = confirm(
          `在 Obsidian vault 里找到 ${when} 的工作台备份。\n\n要用它恢复吗？\n确定：恢复备份里的课程、编辑和设置\n取消：保留当前浏览器里的数据，并用它更新备份（之前每天的快照仍在 .stp-workbench 文件夹里）`,
        )
        if (ok) useStore.getState().importBackup(b.json)
      }
      localStorage.setItem(SYNCED, '1')
      await get().backup()
    } catch (e) {
      set({ error: `备份失败：${e instanceof Error ? e.message : String(e)}` })
    }
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
    clearError: () => set({ error: undefined, notice: undefined }),
    backup: async () => {
      const h = get().handle
      if (!h || get().status !== 'ready') return
      await writeBackup(h, backupJSON())
      set({ lastBackupAt: Date.now() })
    },
  }
})

// 课程、设置等需要持久化的数据一变，就记下时间并排一次备份
let timer: ReturnType<typeof setTimeout> | undefined
useStore.subscribe((s, prev) => {
  const keys = ['courses', 'exportPrefs', 'rules', 'obsidian', 'adopted', 'dismissed', 'localTasks'] as const
  if (keys.every((k) => s[k] === prev[k])) return
  localStorage.setItem(LOCAL_MODIFIED, String(Date.now()))
  clearTimeout(timer)
  timer = setTimeout(() => {
    useVault.getState().backup().catch((e) => useVault.setState({ error: `备份失败：${e instanceof Error ? e.message : String(e)}` }))
  }, 1500)
})
