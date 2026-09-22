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
      set: (p) => set(p),
      resetCourses: () => set({ courses: SEED_COURSES, activeCourse: SEED_COURSES[0].code }),
      importBackup: (json) => {
        const d = JSON.parse(json)
        if (!Array.isArray(d.courses)) throw new Error('备份文件格式不对：缺少 courses')
        set({
          courses: d.courses,
          exportPrefs: { ...DEFAULT_EXPORT, ...d.exportPrefs },
          rules: { ...DEFAULT_RULES, ...d.rules },
          obsidian: { ...DEFAULT_OBSIDIAN, ...d.obsidian },
          adopted: d.adopted ?? [],
          dismissed: d.dismissed ?? [],
        })
      },
    }),
    {
      name: 'stp-planner-v1',
      version: 1,
      // 校历由代码内置，不存进 localStorage，方便以后修正校历时自动生效
      partialize: ({ calendar: _c, page: _p, ...rest }) => rest,
    },
  ),
)

export const backupJSON = () => {
  const s = useStore.getState()
  return JSON.stringify(
    { version: 1, exportedAt: new Date().toISOString(), courses: s.courses, exportPrefs: s.exportPrefs, rules: s.rules, obsidian: s.obsidian, adopted: s.adopted, dismissed: s.dismissed },
    null,
    2,
  )
}

export const courseByCode = (code: string) => useStore.getState().courses.find((c) => c.code === code)
