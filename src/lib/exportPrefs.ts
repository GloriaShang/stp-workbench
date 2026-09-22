// 导出设置与常量。单独成文件，避免页面一加载就把 exceljs 打进首屏。
import type { AssessmentType } from '../types'
import type { Lang } from './i18n'

export interface ExportPrefs {
  lang: Lang
  fontZh: string
  fontEn: string
  themeId: string
  customColor: string
  density: 'compact' | 'standard' | 'loose'
  zebra: boolean
  typeColors: boolean
}

export const DEFAULT_EXPORT: ExportPrefs = {
  lang: 'zh',
  fontZh: 'Songti SC',
  fontEn: 'Times New Roman',
  themeId: 'obsidian',
  customColor: '#355c7d',
  density: 'standard',
  zebra: true,
  typeColors: true,
}

export const FONT_ZH = [
  { v: 'Songti SC', label: '宋体-简（Mac）' },
  { v: 'SimSun', label: '宋体（Windows）' },
  { v: 'PingFang SC', label: '苹方' },
  { v: 'Microsoft YaHei', label: '微软雅黑' },
  { v: 'Source Han Sans SC', label: '思源黑体' },
  { v: 'DengXian', label: '等线' },
  { v: 'Kaiti SC', label: '楷体' },
]
export const FONT_EN = ['Times New Roman', 'Calibri', 'Arial', 'Georgia', 'Helvetica']

export const TYPE_COLOR: Record<AssessmentType, string> = {
  Participation: '#7a7a7a',
  Individual: '#2f6f8f',
  Group: '#7a4f9a',
  InClass: '#a07a2c',
  Presentation: '#3f7f5a',
  FinalExam: '#8c2f39',
  Other: '#7a7a7a',
}

