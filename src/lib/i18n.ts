import type { AssessmentStatus, AssessmentType, L } from '../types'

export type Lang = 'en' | 'zh' | 'bi'

/** 按导出语言取文本；双语时英文在上、中文在下 */
export const tx = (v: L | undefined, lang: Lang) => {
  if (!v) return ''
  if (lang === 'en') return v.en
  if (lang === 'zh') return v.zh || v.en
  return v.zh && v.zh !== v.en ? `${v.en}\n${v.zh}` : v.en
}

/** 表头等短标签：双语时写成 "中文 English" 一行 */
export const hx = (en: string, zh: string, lang: Lang) => (lang === 'en' ? en : lang === 'zh' ? zh : `${zh} ${en}`)

export const TYPE_LABEL: Record<AssessmentType, L> = {
  Participation: { en: 'Participation', zh: '课堂参与' },
  Individual: { en: 'Individual', zh: '个人' },
  Group: { en: 'Group', zh: '小组' },
  InClass: { en: 'In-class', zh: '课堂' },
  Presentation: { en: 'Presentation', zh: '展示' },
  FinalExam: { en: 'Final Exam', zh: '期末考试' },
  Other: { en: 'Other', zh: '其他' },
}

export const STATUS_LABEL: Record<AssessmentStatus, L> = {
  todo: { en: 'Not started', zh: '未开始' },
  doing: { en: 'In progress', zh: '进行中' },
  done: { en: 'Submitted', zh: '已提交' },
}
