/**
 * Obsidian vault 双向同步（File System Access API，仅 Chrome / Edge）。
 *
 * 读写 `<vault>/<dailyPath>/YYYY-MM-DD.md`，格式与 Day Planner 插件一致：
 *   # Day planner
 *   - [ ] 13:30 - 13:40 DA-NM课
 *
 * 写入时只改动目标那一行，文件里的其他内容原样保留。
 * 每次写入前重新读取文件，按原行文本定位；找不到说明文件已在 Obsidian 里被改过，放弃写入并提示重新加载。
 */
import { idbGet, idbSet, idbDel } from './idb'
import { hhmm, minutes } from './dates'

export interface ObsidianConfig {
  dailyPath: string // 相对 vault 根目录
  plannerHeading: string
  headingLevel: number
  defaultDurationMinutes: number
}

export const DEFAULT_OBSIDIAN: ObsidianConfig = {
  dailyPath: '00日程管理/Daily Matter',
  plannerHeading: 'Day planner',
  headingLevel: 1,
  defaultDurationMinutes: 30,
}

export interface ObsidianTask {
  date: string
  line: number
  raw: string
  indent: string
  status: string // ' ' | 'x' | 其他自定义状态
  start?: string
  end?: string
  text: string
}

export interface DayFile {
  date: string
  exists: boolean
  lastModified: number
  tasks: ObsidianTask[]
}

const HANDLE_KEY = 'vault-handle'

// File System Access API 的类型在 TS 的 DOM lib 里并不完整，这里只声明用到的部分。
type Perm = 'granted' | 'denied' | 'prompt'
interface FSDir extends FileSystemDirectoryHandle {
  queryPermission(d: { mode: 'readwrite' }): Promise<Perm>
  requestPermission(d: { mode: 'readwrite' }): Promise<Perm>
}
declare global {
  interface Window {
    showDirectoryPicker?: (o?: { mode?: 'readwrite'; id?: string }) => Promise<FileSystemDirectoryHandle>
  }
}

export const fsSupported = () => typeof window !== 'undefined' && !!window.showDirectoryPicker

export async function pickVault(): Promise<FileSystemDirectoryHandle> {
  const h = await window.showDirectoryPicker!({ mode: 'readwrite', id: 'obsidian-vault' })
  await idbSet(HANDLE_KEY, h)
  return h
}

export const loadSavedVault = () => idbGet<FileSystemDirectoryHandle>(HANDLE_KEY)
export const forgetVault = () => idbDel(HANDLE_KEY)

/** 已授权返回 true；未授权时 request=true 会弹出浏览器授权框（必须由用户点击触发） */
export async function ensurePermission(h: FileSystemDirectoryHandle, request: boolean) {
  const d = h as FSDir
  if ((await d.queryPermission({ mode: 'readwrite' })) === 'granted') return true
  if (!request) return false
  return (await d.requestPermission({ mode: 'readwrite' })) === 'granted'
}

async function dailyDir(vault: FileSystemDirectoryHandle, cfg: ObsidianConfig, create: boolean) {
  let dir = vault
  for (const part of cfg.dailyPath.split('/').filter(Boolean)) {
    dir = await dir.getDirectoryHandle(part, { create })
  }
  return dir
}

export async function checkDailyDir(vault: FileSystemDirectoryHandle, cfg: ObsidianConfig) {
  try {
    await dailyDir(vault, cfg, false)
    return true
  } catch {
    return false
  }
}

// ───────────── 解析 ─────────────

const TASK_RE = /^(\s*)- \[(.)\] (?:(\d{1,2}:\d{2})(?:\s*-\s*(\d{1,2}:\d{2}))?\s+)?(.*)$/

const norm = (t: string) => (t.length === 4 ? '0' + t : t)

export function parseDay(date: string, content: string, cfg: ObsidianConfig): ObsidianTask[] {
  const tasks: ObsidianTask[] = []
  content.split('\n').forEach((raw, line) => {
    const m = TASK_RE.exec(raw)
    if (!m) return
    const [, indent, status, start, end, text] = m
    const s = start ? norm(start) : undefined
    const e = end ? norm(end) : s ? hhmm(minutes(s) + cfg.defaultDurationMinutes) : undefined
    tasks.push({ date, line, raw, indent, status, start: s, end: e, text: text.trim() })
  })
  return tasks
}

export const formatTask = (t: { status: string; start?: string; end?: string; text: string; indent?: string }) =>
  `${t.indent ?? ''}- [${t.status}] ${t.start ? `${t.start}${t.end ? ` - ${t.end}` : ''} ` : ''}${t.text}`

// ───────────── 读写 ─────────────

async function fileHandle(vault: FileSystemDirectoryHandle, cfg: ObsidianConfig, date: string, create: boolean) {
  const dir = await dailyDir(vault, cfg, create)
  return dir.getFileHandle(`${date}.md`, { create })
}

export async function readDay(vault: FileSystemDirectoryHandle, cfg: ObsidianConfig, date: string): Promise<DayFile & { content: string }> {
  try {
    const fh = await fileHandle(vault, cfg, date, false)
    const f = await fh.getFile()
    const content = await f.text()
    return { date, exists: true, lastModified: f.lastModified, content, tasks: parseDay(date, content, cfg) }
  } catch {
    return { date, exists: false, lastModified: 0, content: '', tasks: [] }
  }
}

async function writeContent(vault: FileSystemDirectoryHandle, cfg: ObsidianConfig, date: string, content: string) {
  const fh = await fileHandle(vault, cfg, date, true)
  const w = await fh.createWritable()
  await w.write(content)
  await w.close()
}

export class StaleFileError extends Error {
  constructor(date: string) {
    super(`${date}.md 已在别处被修改，请刷新后再试`)
  }
}

/** 找回任务所在的行：先看原行号，再按原文本全文查找 */
function locate(lines: string[], t: ObsidianTask) {
  if (lines[t.line] === t.raw) return t.line
  const i = lines.indexOf(t.raw)
  return i
}

export async function updateTask(
  vault: FileSystemDirectoryHandle,
  cfg: ObsidianConfig,
  t: ObsidianTask,
  patch: Partial<Pick<ObsidianTask, 'status' | 'start' | 'end' | 'text'>>,
) {
  const { content } = await readDay(vault, cfg, t.date)
  const lines = content.split('\n')
  const i = locate(lines, t)
  if (i < 0) throw new StaleFileError(t.date)
  lines[i] = formatTask({ ...t, ...patch })
  await writeContent(vault, cfg, t.date, lines.join('\n'))
}

export async function deleteTask(vault: FileSystemDirectoryHandle, cfg: ObsidianConfig, t: ObsidianTask) {
  const { content } = await readDay(vault, cfg, t.date)
  const lines = content.split('\n')
  const i = locate(lines, t)
  if (i < 0) throw new StaleFileError(t.date)
  lines.splice(i, 1)
  await writeContent(vault, cfg, t.date, lines.join('\n'))
}

/** 移动到另一天：从原文件删除，再加到目标日期 */
export async function moveTask(
  vault: FileSystemDirectoryHandle,
  cfg: ObsidianConfig,
  t: ObsidianTask,
  toDate: string,
  start: string,
  end: string,
) {
  if (toDate === t.date) return updateTask(vault, cfg, t, { start, end })
  await deleteTask(vault, cfg, t)
  await addTasks(vault, cfg, toDate, [{ status: t.status, start, end, text: t.text }])
}

/** 纯函数：把任务按时间顺序插入 `# Day planner` 段落；没有这个标题就在文末新建。 */
export function insertTasks(
  content: string,
  cfg: ObsidianConfig,
  items: { status?: string; start: string; end: string; text: string }[],
): string {
  const lines = content.length ? content.split('\n') : []
  if (lines.length && lines[lines.length - 1] === '') lines.pop()
  const heading = `${'#'.repeat(cfg.headingLevel)} ${cfg.plannerHeading}`
  let h = lines.findIndex((l) => l.trim().toLowerCase() === heading.toLowerCase())
  if (h < 0) {
    while (lines.length && lines[lines.length - 1].trim() === '') lines.pop()
    if (lines.length) lines.push('')
    lines.push(heading)
    h = lines.length - 1
  }
  if (lines[h + 1] === undefined || lines[h + 1].trim() !== '') lines.splice(h + 1, 0, '')
  // 段落结束位置：下一个同级或更高级标题
  const sectionEnd = () => {
    for (let i = h + 1; i < lines.length; i++) {
      const m = /^(#+)\s/.exec(lines[i])
      if (m && m[1].length <= cfg.headingLevel) return i
    }
    return lines.length
  }
  for (const it of [...items].sort((x, y) => x.start.localeCompare(y.start))) {
    const end = sectionEnd()
    let pos = -1
    let lastTask = -1
    for (let i = h + 1; i < end; i++) {
      const m = TASK_RE.exec(lines[i])
      if (!m || m[1]) continue
      lastTask = i
      if (pos < 0 && m[3] && norm(m[3]) > it.start) pos = i
    }
    if (pos < 0) pos = lastTask >= 0 ? lastTask + 1 : h + 2
    lines.splice(pos, 0, formatTask({ status: it.status ?? ' ', start: it.start, end: it.end, text: it.text }))
  }
  return lines.join('\n') + '\n'
}

/** 新建任务或"采纳"排程建议时调用 */
export async function addTasks(
  vault: FileSystemDirectoryHandle,
  cfg: ObsidianConfig,
  date: string,
  items: { status?: string; start: string; end: string; text: string }[],
) {
  if (!items.length) return
  const { content } = await readDay(vault, cfg, date)
  await writeContent(vault, cfg, date, insertTasks(content, cfg, items))
}
