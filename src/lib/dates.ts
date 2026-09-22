import type { Assessment, Course, SemesterCalendar, Weekday } from '../types'

// 所有日期都用 'YYYY-MM-DD' 字符串，按本地时区处理，避免 UTC 偏移。

export const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export const fromISO = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const addDays = (s: string, n: number) => {
  const d = fromISO(s)
  d.setDate(d.getDate() + n)
  return toISO(d)
}

export const diffDays = (a: string, b: string) =>
  Math.round((fromISO(b).getTime() - fromISO(a).getTime()) / 86_400_000)

export const todayISO = () => toISO(new Date())

/** 1 = 周一 … 7 = 周日 */
export const weekdayOf = (s: string): Weekday => (((fromISO(s).getDay() + 6) % 7) + 1) as Weekday

export const WEEKDAY_ZH = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日']
export const WEEKDAY_EN = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** 本周周一 */
export const mondayOf = (s: string) => addDays(s, 1 - weekdayOf(s))

export const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}
export const hhmm = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

export const teachingWeekOf = (cal: SemesterCalendar, date: string) =>
  cal.weeks.find((w) => date >= w.start && date <= w.end)?.week

export const isReadingWeek = (cal: SemesterCalendar, week?: number) =>
  !!cal.weeks.find((w) => w.week === week)?.reading

/** 一门课在整个学期实际上课的每一次（已处理补课日、假期、阅读周） */
export interface ClassOccurrence {
  course: Course
  week: number
  date: string
  start: string
  end: string
  room: string
}

export function classOccurrences(cal: SemesterCalendar, course: Course): ClassOccurrence[] {
  const out: ClassOccurrence[] = []
  for (const [wk, days] of Object.entries(cal.classDays)) {
    for (const s of course.sessions) {
      const date = days[s.weekday]
      if (date) out.push({ course, week: Number(wk), date, start: s.start, end: s.end, room: s.room })
    }
  }
  return out.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))
}

export type DateConfidence = 'explicit' | 'inferred' | 'tba' | 'none'

export interface ResolvedDue {
  date?: string
  time?: string
  week?: number
  confidence: DateConfidence
}

/**
 * 截止日期推算：
 *  - 有明确日期 → 直接用
 *  - 只写了周次（含课内完成）→ 宁可提前：取该周这门课最早的一次课；阅读周等无课的周取该周周一
 */
export function resolveDue(cal: SemesterCalendar, course: Course, a: Assessment): ResolvedDue {
  if (a.tba) return { confidence: 'tba' }
  if (a.dueDate) {
    return { date: a.dueDate, time: a.dueTime, week: teachingWeekOf(cal, a.dueDate), confidence: 'explicit' }
  }
  if (!a.dueWeek) return { confidence: 'none' }
  const occ = classOccurrences(cal, course).filter((o) => o.week === a.dueWeek)
  if (occ.length) {
    const o = occ[0]
    return { date: o.date, time: o.start, week: a.dueWeek, confidence: 'inferred' }
  }
  const w = cal.weeks.find((x) => x.week === a.dueWeek)
  if (!w) return { week: a.dueWeek, confidence: 'none' }
  return { date: addDays(w.start, 1), week: a.dueWeek, confidence: 'inferred' }
}

/** 某个教学周在日历上的显示范围，如 "9/20–9/26" */
export function weekRangeLabel(cal: SemesterCalendar, week: number) {
  const w = cal.weeks.find((x) => x.week === week)
  if (!w) return ''
  const f = (s: string) => `${fromISO(s).getMonth() + 1}/${fromISO(s).getDate()}`
  return `${f(w.start)}–${f(w.end)}`
}

export const shortDate = (s: string) => `${fromISO(s).getMonth() + 1}/${fromISO(s).getDate()}`
