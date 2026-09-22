/**
 * 待办的统一入口：连上 Obsidian 时读写 Daily Matter，没连时存在工作台本地。
 * 日历、仪表盘都只调这里，不用关心任务存在哪。
 */
import type { NewTask, ObsidianTask } from './lib/obsidian'
import { useStore, type LocalTask } from './store'
import { useVault } from './vault'

const vaultReady = () => useVault.getState().status === 'ready'

export const localAsTask = (l: LocalTask): ObsidianTask => ({
  date: l.date,
  line: -1,
  raw: '',
  indent: '',
  status: l.done ? 'x' : ' ',
  start: l.start,
  end: l.end,
  text: l.text,
  localId: l.id,
})

export async function addTasks(date: string, items: NewTask[]) {
  if (!items.length) return
  if (vaultReady()) return useVault.getState().add(date, items)
  useStore.getState().addLocalTasks(items.map((i) => ({ date, start: i.start, end: i.end, text: i.text })))
}

export async function toggleTask(t: ObsidianTask) {
  if (t.localId) return useStore.getState().updateLocalTask(t.localId, { done: t.status === ' ' })
  return useVault.getState().toggle(t)
}

export async function updateTask(t: ObsidianTask, patch: Partial<Pick<ObsidianTask, 'start' | 'end' | 'text' | 'status'>>) {
  if (t.localId) {
    const { status, ...rest } = patch
    return useStore.getState().updateLocalTask(t.localId, { ...rest, ...(status !== undefined ? { done: status !== ' ' } : {}) })
  }
  return useVault.getState().update(t, patch)
}

export async function moveTask(t: ObsidianTask, date: string, start: string, end: string) {
  if (t.localId) return useStore.getState().updateLocalTask(t.localId, { date, start, end })
  return useVault.getState().move(t, date, start, end)
}

export async function removeTask(t: ObsidianTask) {
  if (t.localId) return useStore.getState().removeLocalTasks([t.localId])
  return useVault.getState().remove(t)
}
