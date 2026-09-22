import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { S1_2026 } from './data/calendar'
import { SEED_COURSES } from './data/courses'
import { DEFAULT_EXPORT, type ExportPrefs } from './lib/exportPrefs'
import { DEFAULT_OBSIDIAN, type ObsidianConfig } from './lib/obsidian'
import { DEFAULT_RULES, type PlannerRules } from './lib/scheduler'
import type { Assessment, Course, SemesterCalendar } from './types'

export type ThemeMode = 'system' | 'light' | 'dark'
export type CalView = 'day' | '3day' | 'week' | 'month'
export type Page = 'dashboard' | 'calendar' | 'courses' | 'export' | 'rules' | 'settings'

/** 没连 Obsidian 时，在日历里新建的待办先存在这里；连上后自动搬进 Daily Matter */
export interface LocalTask {
  id: string
  date: string
  start?: string
  end?: string
  text: string
  done: boolean
}

export interface Layers {
  classes: boolean
  deadlines: boolean
  obsidian: boolean
  suggestions: boolean
}

interface State {
  calendar: SemesterCalendar
  courses: Course[]
  exportPrefs: ExportPrefs
  rules: PlannerRules
  obsidian: ObsidianConfig
  /** 已写入 Obsidian 的建议 id，或被忽略的建议 id；排程时跳过 */
  adopted: string[]
  dismissed: string[]
  localTasks: LocalTask[]
  themeMode: ThemeMode
  view: CalView
  layers: Layers
  page: Page
  activeCourse: string

  setPage: (p: Page) => void
  setCourse: (code: string, fn: (c: Course) => Course) => void
  setAssessment: (code: string, id: string, patch: Partial<Assessment>) => void
  addCourse: (c: Course) => void
  removeCourse: (code: string) => void
  setExportPrefs: (p: Partial<ExportPrefs>) => void
  setRules: (fn: (r: PlannerRules) => PlannerRules) => void
  setObsidian: (p: Partial<ObsidianConfig>) => void
  markAdopted: (ids: string[]) => void
  dismiss: (id: string) => void
  restoreDismissed: () => void
  addLocalTasks: (items: Omit<LocalTask, 'id' | 'done'>[]) => void
  updateLocalTask: (id: string, patch: Partial<LocalTask>) => void
  removeLocalTasks: (ids: string[]) => void
  set: (p: Partial<Pick<State, 'themeMode' | 'view' | 'layers' | 'activeCourse'>>) => void
  resetCourses: () => void
  importBackup: (json: string) => void
}

export const useStore = create<State>()(
  persist(
    (set) => ({
      calendar: S1_2026,
      courses: SEED_COURSES,
      exportPrefs: DEFAULT_EXPORT,
      rules: DEFAULT_RULES,
      obsidian: DEFAULT_OBSIDIAN,
      adopted: [],
      dismissed: [],
      localTasks: [],
      themeMode: 'system',
      view: 'week',
      layers: { classes: true, deadlines: true, obsidian: true, suggestions: true },
      page: 'dashboard',
      activeCourse: SEED_COURSES[0].code,

      setPage: (page) => set({ page }),
      setCourse: (code, fn) => set((s) => ({ courses: s.courses.map((c) => (c.code === code ? fn(c) : c)) })),
      setAssessment: (code, id, patch) =>
        set((s) => ({
          courses: s.courses.map((c) =>
            c.code === code ? { ...c, assessments: c.assessments.map((a) => (a.id === id ? { ...a, ...patch } : a)) } : c,
          ),
        })),
      addCourse: (c) => set((s) => ({ courses: [...s.courses, c], activeCourse: c.code })),
      removeCourse: (code) =>
        set((s) => {
          const courses = s.courses.filter((c) => c.code !== code)
          return { courses, activeCourse: courses[0]?.code ?? '' }
        }),
      setExportPrefs: (p) => set((s) => ({ exportPrefs: { ...s.exportPrefs, ...p } })),
      setRules: (fn) => set((s) => ({ rules: fn(s.rules) })),
      setObsidian: (p) => set((s) => ({ obsidian: { ...s.obsidian, ...p } })),
      markAdopted: (ids) => set((s) => ({ adopted: [...new Set([...s.adopted, ...ids])] })),
      dismiss: (id) => set((s) => ({ dismissed: [...new Set([...s.dismissed, id])] })),
      restoreDismissed: () => set({ dismissed: [] }),
      addLocalTasks: (items) =>
        set((s) => ({
          localTasks: [...s.localTasks, ...items.map((t) => ({ ...t, id: `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`, done: false }))],
        })),
      updateLocalTask: (id, patch) => set((s) => ({ localTasks: s.localTasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
      removeLocalTasks: (ids) => set((s) => ({ localTasks: s.localTasks.filter((t) => !ids.includes(t.id)) })),
      set: (p) => set(p),
      resetCourses: () => set({ courses: SEED_COURSES, activeCourse: SEED_COURSES[0].code }),
      importBackup: (json) => {
        const d = JSON.parse(json)
        if (!Array.isArray(d.courses)) throw new Error('备份文件格式不对：缺少 courses')
        set({
          courses: (Number(d.version) || 1) < 2 ? migrateV2(d.courses) : d.courses,
          exportPrefs: { ...DEFAULT_EXPORT, ...d.exportPrefs },
          rules: { ...DEFAULT_RULES, ...d.rules },
          obsidian: { ...DEFAULT_OBSIDIAN, ...d.obsidian },
          adopted: d.adopted ?? [],
          dismissed: d.dismissed ?? [],
          localTasks: d.localTasks ?? [],
        })
      },
    }),
    {
      name: 'stp-planner-v1',
      version: 2,
      migrate: (persisted, from) => {
        const p = persisted as Partial<State>
        if (from < 2 && p.courses) p.courses = migrateV2(p.courses)
        return p as State
      },
      // 新版本给规则加了字段时，旧的本地数据里没有这些字段：逐层用默认值补齐
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<State>
        const rules = { ...DEFAULT_RULES, ...p.rules } as PlannerRules
        for (const k of Object.keys(DEFAULT_RULES) as (keyof PlannerRules)[]) {
          const d = DEFAULT_RULES[k]
          if (d && typeof d === 'object' && !Array.isArray(d)) (rules as unknown as Record<string, unknown>)[k] = { ...d, ...(p.rules?.[k] as object) }
        }
        return { ...current, ...p, rules, exportPrefs: { ...DEFAULT_EXPORT, ...p.exportPrefs }, obsidian: { ...DEFAULT_OBSIDIAN, ...p.obsidian } }
      },
      // 校历由代码内置，不存进 localStorage，方便以后修正校历时自动生效
      partialize: ({ calendar: _c, page: _p, ...rest }) => rest,
    },
  ),
)

/**
 * v2："宁可提前"——去掉矛盾提示，FM 作业 2/3 的发布事项移到较早的周，Service L 个人作业 II 的事项移到 W12。
 * 只替换仍是旧内置文字的行，自己改过的内容不动。
 */
const V2_ROWS: Record<string, { week: number; oldEn?: string }[]> = {
  FIN3073: [{ week: 5, oldEn: 'Assignment 1 due' }, { week: 6, oldEn: 'Assignment 2 posted' }, { week: 9 }, { week: 11, oldEn: 'Assignment 3 posted' }],
  GCAP3213: [{ week: 11, oldEn: 'Individual assignment II due 17:00, Fri 27 Nov (listed in Week 11)' }, { week: 12 }],
}
function migrateV2(courses: Course[]): Course[] {
  return courses.map((c) => {
    const seed = SEED_COURSES.find((x) => x.code === c.code)
    const rows = V2_ROWS[c.code]
    const assessments = c.assessments.map(({ conflict: _drop, ...a }: Assessment & { conflict?: unknown }) => a)
    if (!seed || !rows) return { ...c, assessments }
    const weekly = c.weekly.map((r) => {
      const rule = rows.find((x) => x.week === r.week)
      if (!rule || (r.events?.en ?? undefined) !== rule.oldEn) return r
      return { ...r, events: seed.weekly.find((x) => x.week === r.week)?.events }
    })
    return { ...c, assessments, weekly }
  })
}

export const backupJSON = () => {
  const s = useStore.getState()
  return JSON.stringify(
    { version: 2, savedAt: Date.now(), exportedAt: new Date().toISOString(), courses: s.courses, exportPrefs: s.exportPrefs, rules: s.rules, obsidian: s.obsidian, adopted: s.adopted, dismissed: s.dismissed, localTasks: s.localTasks },
    null,
    2,
  )
}

export const courseByCode = (code: string) => useStore.getState().courses.find((c) => c.code === code)
