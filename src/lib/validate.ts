import type { Course, SemesterCalendar } from '../types'
import { isReadingWeek, resolveDue } from './dates'

export type Severity = 'error' | 'warn' | 'info'

export interface Issue {
  severity: Severity
  course: string
  assessmentId?: string
  message: string
}

export const topLevel = (c: Course) => c.assessments.filter((a) => !a.parentId)
export const childrenOf = (c: Course, id: string) => c.assessments.filter((a) => a.parentId === id)
export const isLeaf = (c: Course, id: string) => childrenOf(c, id).length === 0

export function courseIssues(cal: SemesterCalendar, c: Course): Issue[] {
  const out: Issue[] = []
  const push = (severity: Severity, message: string, assessmentId?: string) =>
    out.push({ severity, course: c.code, message, assessmentId })

  const total = topLevel(c).reduce((s, a) => s + (Number(a.weight) || 0), 0)
  if (Math.abs(total - 100) > 0.01) push('error', `各项占比合计 ${total}%，不等于 100%`)

  for (const a of c.assessments) {
    const kids = childrenOf(c, a.id)
    if (kids.length) {
      const sub = kids.reduce((s, k) => s + (Number(k.weight) || 0), 0)
      if (Math.abs(sub - a.weight) > 0.01) push('error', `「${a.name.zh || a.name.en}」子项合计 ${sub}%，与父项 ${a.weight}% 不一致`, a.id)
      continue
    }
    const name = a.name.zh || a.name.en
    if (a.type === 'Participation' || a.type === 'FinalExam') continue

    const due = resolveDue(cal, c, a)
    if (due.confidence === 'tba') push('warn', `「${name}」截止日期未公布（TBA）`, a.id)
    else if (due.confidence === 'none') push('warn', `「${name}」没有截止信息`, a.id)
    else if (due.confidence === 'inferred') push('info', `「${name}」只写了第 ${a.dueWeek} 周，按该周最早一次课推算`, a.id)

    if (due.week && isReadingWeek(cal, due.week)) push('info', `「${name}」在 Reading Week 截止`, a.id)
  }
  return out
}

/** 每周各课截止占比，用于热力图与"高压周" */
export function weeklyLoad(cal: SemesterCalendar, courses: Course[]) {
  const load: Record<number, Record<string, number>> = {}
  for (const c of courses) {
    for (const a of c.assessments) {
      if (!isLeaf(c, a.id) || a.type === 'Participation' || a.type === 'FinalExam') continue
      const wk = resolveDue(cal, c, a).week
      if (!wk) continue
      load[wk] ??= {}
      load[wk][c.code] = (load[wk][c.code] ?? 0) + a.weight
    }
  }
  return load
}

export function globalIssues(cal: SemesterCalendar, courses: Course[]): Issue[] {
  const out: Issue[] = []
  const load = weeklyLoad(cal, courses)
  for (const [wk, byCourse] of Object.entries(load)) {
    const sum = Object.values(byCourse).reduce((s, v) => s + v, 0)
    if (sum >= 30) out.push({ severity: 'warn', course: '全部', message: `第 ${wk} 周截止占比合计 ${sum}%，是高压周` })
  }
  return out
}
