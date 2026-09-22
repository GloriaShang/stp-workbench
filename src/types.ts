/** 中英双语文本。zh 为空时回退到 en。 */
export interface L {
  en: string
  zh: string
}

/** 1 = 周一 … 7 = 周日 */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7

export interface Session {
  weekday: Weekday
  start: string // HH:mm
  end: string
  room: string
}

export interface WeekRow {
  week: number
  lectureNo?: number
  readingWeek?: boolean
  topic: L
  chapters?: string
  activity?: L
  homework?: L
  events?: L
}

export type AssessmentType =
  | 'Participation'
  | 'Individual'
  | 'Group'
  | 'InClass'
  | 'Presentation'
  | 'FinalExam'
  | 'Other'

export type AssessmentStatus = 'todo' | 'doing' | 'done'

export interface Assessment {
  id: string
  name: L
  parentId?: string
  type: AssessmentType
  /** 占总评百分比。父项 = 子项之和，校验只用顶层项目。 */
  weight: number
  /** 小组作业还是个人作业（影响日历排程） */
  group?: boolean
  releaseWeek?: number
  dueWeek?: number
  /** 跨周的展示，例如 W12–13 */
  dueWeekEnd?: number
  dueDate?: string // YYYY-MM-DD，有明确日期时优先
  dueTime?: string // HH:mm
  inClass?: boolean
  requirements?: L
  aiPolicy?: L
  latePolicy?: L
  tba?: boolean
  status: AssessmentStatus
}

export interface KeyDate {
  week?: number
  date?: string
  event: L
}

export interface Course {
  code: string
  /** 日历等空间有限处使用的简称，如 FM、DA- NM */
  short: string
  name: L
  section: string
  convener: string
  teacher: string
  consultation?: string
  color: string
  sessions: Session[]
  weekly: WeekRow[]
  assessments: Assessment[]
  keyDates: KeyDate[]
  textbooks: { required: string[]; references: string[] }
  aiPolicy?: L
  finalExam: boolean
  sources: string[]
}

export interface SemesterCalendar {
  name: string
  /** 每个教学周在校历上的日期范围（校历按周日–周六排） */
  weeks: { week: number; start: string; end: string; reading?: boolean; label?: string }[]
  /** 每周各个星期几实际上课的日期；null = 当天不上课。已处理补课日。 */
  classDays: Record<number, Partial<Record<Weekday, string | null>>>
  /** 全天横幅：假期、考试周等 */
  banners: { start: string; end: string; label: string; kind: 'holiday' | 'exam' | 'info' }[]
}
