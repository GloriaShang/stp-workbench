/**
 * 确定性排程器：根据学习规则生成"建议学习块"。同样的输入永远得到同样的输出。
 *
 * 流程：先生成任务（每个任务带若干候选日期），再按优先级依次放进空闲时段。
 * 忙碌时段 = 上课（前后留缓冲）+ Obsidian 里已有的时间块 + 已放下的建议块。
 */
import type { Course, SemesterCalendar, Weekday } from '../types'
import { addDays, classOccurrences, diffDays, fromISO, hhmm, minutes, mondayOf, resolveDue, weekdayOf } from './dates'
import { isLeaf } from './validate'

export type TaskKind = 'preview' | 'review' | 'assignment' | 'group' | 'inclass' | 'exam'

export const KIND_LABEL: Record<TaskKind, string> = {
  preview: '预习',
  review: '复习',
  assignment: '个人作业',
  group: '小组作业',
  inclass: '课堂测验准备',
  exam: '期末复习',
}

export interface BlockRule {
  weekday: Weekday
  kind: TaskKind | 'any'
  course: string // 'all' 或课程代码
}

export interface PlannerRules {
  preview: { on: boolean; daysBefore: number; minutes: number; perSession: boolean }
  review: { on: boolean; nextDay: boolean; minutes: number; perSession: boolean }
  assignment: { on: boolean; daysEarly: number }
  group: { on: boolean; fromWeek: number | null; minutes: number }
  exam: { on: boolean; fromWeek: number }
  inclass: { on: boolean }
  blocks: BlockRule[]
  dailyCapMinutes: number
  dayStart: string
  dayEnd: string
  preferredStart: string
  bufferMinutes: number
  /** 课程难度系数，影响预习、复习时长，如 { FIN3073: 2 } */
  courseFactor: Record<string, number>
}

export const DEFAULT_RULES: PlannerRules = {
  preview: { on: false, daysBefore: 1, minutes: 30, perSession: false },
  review: { on: false, nextDay: false, minutes: 45, perSession: false },
  assignment: { on: false, daysEarly: 3 },
  group: { on: false, fromWeek: null, minutes: 90 },
  exam: { on: false, fromWeek: 13 },
  inclass: { on: false },
  blocks: [],
  dailyCapMinutes: 180,
  dayStart: '09:00',
  dayEnd: '23:30',
  preferredStart: '19:00',
  bufferMinutes: 10,
  courseFactor: {},
}

export interface Busy {
  date: string
  start: string
  end: string
}

export interface Suggestion {
  id: string
  kind: TaskKind
  course: string
  date: string
  start: string
  end: string
  title: string
}

interface Task {
  id: string
  kind: TaskKind
  course: Course
  minutes: number
  /** 按偏好顺序排列的候选日期 */
  days: string[]
  notBefore?: { date: string; time: string }
  notAfter?: { date: string; time: string }
  title: string
  priority: number
}

const PRIORITY: Record<TaskKind, number> = { exam: 0, assignment: 1, inclass: 1, group: 2, preview: 3, review: 3 }

function range(from: string, to: string) {
  const out: string[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d)
  return out
}

function topicOf(c: Course, week: number) {
  const row = c.weekly.find((r) => r.week === week)
  return row ? row.topic.zh || row.topic.en : ''
}

function buildTasks(cal: SemesterCalendar, courses: Course[], r: PlannerRules, today: string): Task[] {
  const tasks: Task[] = []
  const semEnd = cal.weeks[cal.weeks.length - 1].end

  for (const c of courses) {
    const occ = classOccurrences(cal, c)
    const factor = r.courseFactor[c.code] ?? 1

    // 预习 / 复习：每次课，或每周一次（第一次课前 / 最后一次课后）
    const byWeek = new Map<number, typeof occ>()
    occ.forEach((o) => byWeek.set(o.week, [...(byWeek.get(o.week) ?? []), o]))
    for (const [week, list] of byWeek) {
      const topic = topicOf(c, week)
      if (r.preview.on) {
        for (const o of r.preview.perSession ? list : [list[0]]) {
          const target = addDays(o.date, -r.preview.daysBefore)
          tasks.push({
            id: `preview:${c.code}:${o.date}:${o.start}`,
            kind: 'preview', course: c, priority: PRIORITY.preview,
            minutes: Math.round(r.preview.minutes * factor),
            days: r.preview.daysBefore === 0 ? [o.date, addDays(o.date, -1)] : [target, addDays(target, -1), addDays(target, 1)].filter((d) => d <= o.date),
            notAfter: { date: o.date, time: o.start },
            title: `预习 ${c.short} W${week}${topic ? `：${topic}` : ''}`,
          })
        }
      }
      if (r.review.on) {
        for (const o of r.review.perSession ? list : [list[list.length - 1]]) {
          const first = r.review.nextDay ? addDays(o.date, 1) : o.date
          tasks.push({
            id: `review:${c.code}:${o.date}:${o.start}`,
            kind: 'review', course: c, priority: PRIORITY.review,
            minutes: Math.round(r.review.minutes * factor),
            days: [first, addDays(first, 1), addDays(first, 2)],
            notBefore: { date: o.date, time: o.end },
            title: `复习 ${c.short} W${week}${topic ? `：${topic}` : ''}`,
          })
        }
      }
    }

    for (const a of c.assessments) {
      if (!isLeaf(c, a.id) || a.type === 'Participation' || a.type === 'FinalExam' || a.status === 'done') continue
      const due = resolveDue(cal, c, a)
      const dueDate = due.date
      if (!dueDate) continue
      const name = a.name.zh || a.name.en
      const releaseDate = a.releaseWeek ? cal.weeks.find((w) => w.week === a.releaseWeek)?.start : undefined

      if (a.inClass) {
        if (!r.inclass.on) continue
        const d = addDays(dueDate, -1)
        tasks.push({
          id: `inclass:${c.code}:${a.id}`, kind: 'inclass', course: c, priority: PRIORITY.inclass,
          minutes: a.type === 'Presentation' ? 90 : 60,
          days: [d, addDays(d, -1), addDays(d, -2)],
          title: `${a.type === 'Presentation' ? '排练' : '准备'} ${c.short} ${name}`,
        })
        continue
      }

      if (a.group) {
        if (!r.group.on) continue
        // 默认从截止前 4 周（且不早于发布周）开始；用户设置了"从第 N 周开始"则以设置为准
        const auto = Math.max(a.releaseWeek ?? 1, (due.week ?? 5) - 4)
        const startWeek = r.group.fromWeek ? Math.max(r.group.fromWeek, a.releaseWeek ?? 1) : auto
        const startDate = cal.weeks.find((w) => w.week === startWeek)?.start ?? addDays(dueDate, -21)
        // 每周一次，截止前一周加一次
        const weeks: string[] = []
        // 校历的周从周日开始，+1 天取到这一周的周一
        for (let m = mondayOf(addDays(startDate, 1)); m < dueDate; m = addDays(m, 7)) weeks.push(m)
        weeks.forEach((mon, i) => {
          const days = range(mon, addDays(mon, 6)).filter((d) => d < dueDate)
          if (!days.length) return
          tasks.push({
            id: `group:${c.code}:${a.id}:${mon}`, kind: 'group', course: c, priority: PRIORITY.group,
            minutes: r.group.minutes, days: days.slice().reverse(),
            title: `小组 ${c.short} ${name}（第 ${i + 1} 次）`,
          })
        })
        const last = range(addDays(dueDate, -6), addDays(dueDate, -1)).reverse()
        tasks.push({
          id: `group:${c.code}:${a.id}:final`, kind: 'group', course: c, priority: PRIORITY.group - 0.5,
          minutes: r.group.minutes, days: last,
          title: `小组 ${c.short} ${name}：定稿`,
        })
        continue
      }

      if (!r.assignment.on) continue
      const finish = addDays(dueDate, -r.assignment.daysEarly)
      const start = releaseDate && releaseDate < finish ? releaseDate : addDays(finish, -14)
      const n = Math.min(5, Math.max(2, Math.round(a.weight / 7.5)))
      const span = Math.max(0, diffDays(start, finish))
      for (let i = 0; i < n; i++) {
        const target = addDays(start, Math.round((span * (i + 1)) / n))
        const isLast = i === n - 1
        tasks.push({
          id: `assignment:${c.code}:${a.id}:${i}`, kind: 'assignment', course: c, priority: PRIORITY.assignment,
          minutes: 60,
          days: [target, addDays(target, -1), addDays(target, 1), addDays(target, -2), addDays(target, 2), addDays(target, -3)].filter((d) => d <= finish),
          title: `${c.short} ${name}${isLast ? '：完成并检查' : `（${i + 1}/${n}）`}`,
        })
      }
    }

    if (r.exam.on && c.finalExam) {
      const fe = c.assessments.find((x) => x.type === 'FinalExam')
      const from = cal.weeks.find((w) => w.week === r.exam.fromWeek)?.start
      const examEnd = cal.banners.find((b) => b.kind === 'exam')?.end ?? semEnd
      if (from) {
        const days = range(from, examEnd)
        const n = Math.max(3, Math.round((fe?.weight ?? 30) / 10) + 2)
        for (let i = 0; i < n; i++) {
          const target = days[Math.floor((days.length * i) / n)]
          tasks.push({
            id: `exam:${c.code}:${i}`, kind: 'exam', course: c, priority: PRIORITY.exam,
            minutes: 90, days: [target, addDays(target, 1), addDays(target, -1), addDays(target, 2), addDays(target, -2)],
            title: `期末复习 ${c.short}（${i + 1}/${n}）`,
          })
        }
      }
    }
  }
  // 只保留今天及以后的任务
  return tasks
    .map((t) => ({ ...t, days: t.days.filter((d) => d >= today) }))
    .filter((t) => t.days.length)
}

function blocked(r: PlannerRules, date: string, t: Task) {
  const wd = weekdayOf(date)
  return r.blocks.some(
    (b) => b.weekday === wd && (b.kind === 'any' || b.kind === t.kind) && (b.course === 'all' || b.course === t.course.code),
  )
}

/** 在一天里找一个空档；优先 preferredStart 之后，再往前找 */
function findSlot(
  r: PlannerRules,
  busy: [number, number][],
  len: number,
  lo: number,
  hi: number,
): number | undefined {
  const sorted = [...busy].sort((a, b) => a[0] - b[0])
  const free: [number, number][] = []
  let cur = lo
  for (const [s, e] of sorted) {
    if (e <= cur) continue
    if (s > cur) free.push([cur, Math.min(s, hi)])
    cur = Math.max(cur, e)
    if (cur >= hi) break
  }
  if (cur < hi) free.push([cur, hi])
  const pref = minutes(r.preferredStart)
  const snap = (m: number) => Math.ceil(m / 10) * 10
  for (const [s, e] of free) {
    const st = snap(Math.max(s, pref))
    if (st + len <= e) return st
  }
  for (const [s, e] of free) {
    const st = snap(s)
    if (st + len <= e && st < pref) return st
  }
  return undefined
}

export interface ScheduleResult {
  suggestions: Suggestion[]
  unplaced: { id: string; title: string; kind: TaskKind; course: string }[]
}

export function schedule(
  cal: SemesterCalendar,
  courses: Course[],
  r: PlannerRules,
  existing: Busy[],
  today: string,
  skip: Set<string>,
): ScheduleResult {
  const tasks = buildTasks(cal, courses, r, today)
    .filter((t) => !skip.has(t.id))
    .sort((a, b) => a.priority - b.priority || a.days[0].localeCompare(b.days[0]) || a.id.localeCompare(b.id))

  const busy = new Map<string, [number, number][]>()
  const used = new Map<string, number>()
  const addBusy = (d: string, s: number, e: number) => busy.set(d, [...(busy.get(d) ?? []), [s, e]])

  for (const c of courses) {
    for (const o of classOccurrences(cal, c)) {
      addBusy(o.date, minutes(o.start) - r.bufferMinutes, minutes(o.end) + r.bufferMinutes)
    }
  }
  for (const b of existing) addBusy(b.date, minutes(b.start), minutes(b.end))

  const suggestions: Suggestion[] = []
  const unplaced: ScheduleResult['unplaced'] = []
  for (const t of tasks) {
    let placed = false
    for (const d of t.days) {
      if (blocked(r, d, t)) continue
      if ((used.get(d) ?? 0) + t.minutes > r.dailyCapMinutes) continue
      let lo = minutes(r.dayStart)
      let hi = minutes(r.dayEnd)
      if (t.notBefore && t.notBefore.date === d) lo = Math.max(lo, minutes(t.notBefore.time) + r.bufferMinutes)
      if (t.notAfter && t.notAfter.date === d) hi = Math.min(hi, minutes(t.notAfter.time) - r.bufferMinutes)
      if (t.notAfter && d > t.notAfter.date) continue
      const st = findSlot(r, busy.get(d) ?? [], t.minutes, lo, hi)
      if (st === undefined) continue
      addBusy(d, st, st + t.minutes)
      used.set(d, (used.get(d) ?? 0) + t.minutes)
      suggestions.push({ id: t.id, kind: t.kind, course: t.course.code, date: d, start: hhmm(st), end: hhmm(st + t.minutes), title: t.title })
      placed = true
      break
    }
    if (!placed) unplaced.push({ id: t.id, title: t.title, kind: t.kind, course: t.course.code })
  }
  suggestions.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))
  return { suggestions, unplaced }
}

export const fmtDay = (d: string) => `${fromISO(d).getMonth() + 1}/${fromISO(d).getDate()}`
