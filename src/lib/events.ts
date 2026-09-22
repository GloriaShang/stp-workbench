import { useMemo } from 'react'
import { useStore, type LocalTask } from '../store'
import { localAsTask } from '../tasks'
import { useVault } from '../vault'
import { useToday } from '../today'
import type { Course, SemesterCalendar } from '../types'
import { classOccurrences, resolveDue } from './dates'
import type { ObsidianTask } from './obsidian'
import { schedule, type Busy, type Suggestion } from './scheduler'
import { matchCourse, NEUTRAL } from './courseMatch'
import { isLeaf } from './validate'

export type EventKind = 'class' | 'deadline' | 'obsidian' | 'suggestion' | 'banner'

export interface CalEvent {
  id: string
  kind: EventKind
  date: string
  start?: string
  end?: string
  title: string
  sub?: string
  color: string
  course?: Course
  task?: ObsidianTask
  suggestion?: Suggestion
  bannerKind?: 'holiday' | 'exam' | 'info'
  done?: boolean
}

export function buildEvents(
  cal: SemesterCalendar,
  courses: Course[],
  dates: string[],
  days: Record<string, { tasks: ObsidianTask[] }>,
  localTasks: LocalTask[],
  suggestions: Suggestion[],
  layers: { classes: boolean; deadlines: boolean; obsidian: boolean; suggestions: boolean },
): CalEvent[] {
  const inRange = new Set(dates)
  const out: CalEvent[] = []

  for (const b of cal.banners) {
    for (const d of dates) {
      if (d >= b.start && d <= b.end) out.push({ id: `banner:${b.label}:${d}`, kind: 'banner', date: d, title: b.label, color: '', bannerKind: b.kind })
    }
  }

  for (const c of courses) {
    if (layers.classes) {
      for (const o of classOccurrences(cal, c)) {
        if (!inRange.has(o.date)) continue
        const topic = c.weekly.find((r) => r.week === o.week)?.topic
        out.push({
          id: `class:${c.code}:${o.date}:${o.start}`, kind: 'class', date: o.date, start: o.start, end: o.end,
          title: c.short, sub: `${o.room} · W${o.week}${topic ? ' ' + (topic.zh || topic.en) : ''}`, color: c.color, course: c,
        })
      }
    }
    if (layers.deadlines) {
      for (const a of c.assessments) {
        if (!isLeaf(c, a.id) || a.type === 'Participation' || a.type === 'FinalExam') continue
        const d = resolveDue(cal, c, a)
        if (!d.date || !inRange.has(d.date)) continue
        out.push({
          id: `deadline:${c.code}:${a.id}`, kind: 'deadline', date: d.date, start: d.time,
          title: `${c.short} ${a.name.zh || a.name.en}`,
          sub: `${a.weight}%${a.inClass ? ' · 课堂' : ''}${d.confidence === 'inferred' ? ' · 日期推算' : ''}`,
          color: c.color, course: c, done: a.status === 'done',
        })
      }
    }
  }

  if (layers.obsidian) {
    for (const d of dates) {
      const local = localTasks.filter((l) => l.date === d).map(localAsTask)
      for (const t of [...(days[d]?.tasks ?? []), ...local]) {
        // 待办按文字里提到的课程着色，认不出的用中性色
        const course = matchCourse(t.text, courses)
        out.push({
          id: t.localId ? `obs:local:${t.localId}` : `obs:${d}:${t.line}:${t.raw}`, kind: 'obsidian', date: d, start: t.start, end: t.end,
          title: t.text, color: course?.color ?? NEUTRAL, course, task: t, done: t.status !== ' ',
        })
      }
    }
  }

  if (layers.suggestions) {
    for (const s of suggestions) {
      if (!inRange.has(s.date)) continue
      const c = courses.find((x) => x.code === s.course)
      out.push({ id: `sug:${s.id}`, kind: 'suggestion', date: s.date, start: s.start, end: s.end, title: s.title, color: c?.color ?? '#888', course: c, suggestion: s })
    }
  }
  return out
}

/** 全学期排程建议；Obsidian 已有的时间块（已加载的日期）视为忙碌 */
export function useSuggestions() {
  const { calendar, courses, rules, adopted, dismissed, localTasks } = useStore()
  const days = useVault((s) => s.days)
  const today = useToday((s) => s.today)
  return useMemo(() => {
    const anyOn = rules.preview.on || rules.review.on || rules.assignment.on || rules.group.on || rules.exam.on || rules.inclass.on
    if (!anyOn) return { suggestions: [], unplaced: [] }
    const busy: Busy[] = []
    for (const d of Object.values(days)) for (const t of d.tasks) if (t.start && t.end) busy.push({ date: t.date, start: t.start, end: t.end })
    for (const t of localTasks) if (t.start && t.end) busy.push({ date: t.date, start: t.start, end: t.end })
    return schedule(calendar, courses, rules, busy, today, new Set([...adopted, ...dismissed]))
  }, [calendar, courses, rules, adopted, dismissed, days, localTasks, today])
}
