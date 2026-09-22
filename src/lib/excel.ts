import ExcelJS from 'exceljs'
import type { Assessment, Course, SemesterCalendar } from '../types'
import { TYPE_COLOR, type ExportPrefs } from './exportPrefs'
import { WEEKDAY_EN, WEEKDAY_ZH, diffDays, fromISO, resolveDue, shortDate, todayISO, weekRangeLabel } from './dates'
import { STATUS_LABEL, TYPE_LABEL, hx, tx, type Lang } from './i18n'
import { argb, mix, type Theme } from './themes'
import { childrenOf, isLeaf, topLevel, weeklyLoad } from './validate'

const SIZE = { compact: 9, standard: 10.5, loose: 12 }

type Cell = ExcelJS.Cell

class Styler {
  size: number
  constructor(public p: ExportPrefs, public theme: Theme) {
    this.size = SIZE[p.density]
  }

  /** 中文与英文分别套用各自字体（按字符切分成 rich text 片段） */
  rich(text: string, opt: { bold?: boolean; color?: string; size?: number; italic?: boolean } = {}): ExcelJS.CellValue {
    const parts = text.match(/[　-〿㐀-鿿＀-￯]+|[^　-〿㐀-鿿＀-￯]+/g) ?? ['']
    return {
      richText: parts.map((t) => ({
        text: t,
        font: {
          name: /[　-鿿＀-￯]/.test(t) ? this.p.fontZh : this.p.fontEn,
          size: opt.size ?? this.size,
          bold: opt.bold,
          italic: opt.italic,
          color: { argb: argb(opt.color ?? '#222222') },
        },
      })),
    }
  }

  set(c: Cell, text: string | number | Date | undefined, opt: Parameters<Styler['rich']>[1] & { wrap?: boolean; center?: boolean; fill?: string; indent?: number } = {}) {
    if (text === undefined || text === '') c.value = null
    else if (typeof text === 'string') c.value = this.rich(text, opt)
    else {
      c.value = text
      c.font = { name: this.p.fontEn, size: opt.size ?? this.size, bold: opt.bold, color: { argb: argb(opt.color ?? '#222222') } }
    }
    c.alignment = {
      vertical: 'top',
      wrapText: opt.wrap ?? true,
      horizontal: opt.center ? 'center' : 'left',
      indent: opt.indent,
    }
    if (opt.fill) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(opt.fill) } }
    c.border = {
      top: { style: 'thin', color: { argb: argb(this.theme.line) } },
      bottom: { style: 'thin', color: { argb: argb(this.theme.line) } },
      left: { style: 'thin', color: { argb: argb(this.theme.line) } },
      right: { style: 'thin', color: { argb: argb(this.theme.line) } },
    }
  }

  header(ws: ExcelJS.Worksheet, row: number, labels: (string | [string, number])[]) {
    let col = 1
    for (const l of labels) {
      const [text, span] = typeof l === 'string' ? [l, 1] : l
      if (span > 1) ws.mergeCells(row, col, row, col + span - 1)
      this.set(ws.getCell(row, col), text, { bold: true, color: '#ffffff', fill: this.theme.primary, center: true })
      col += span
    }
    ws.getRow(row).height = this.size * 2.2
  }

  section(ws: ExcelJS.Worksheet, row: number, text: string, cols: number, col = 1) {
    if (cols > 0) ws.mergeCells(row, col, row, cols)
    const c = ws.getCell(row, col)
    c.value = this.rich(text, { bold: true, size: this.size + 2, color: this.theme.accent })
    c.border = { bottom: { style: 'medium', color: { argb: argb(this.theme.primary) } } }
    ws.getRow(row).height = this.size * 2.4
  }

  title(ws: ExcelJS.Worksheet, text: string, sub: string, cols: number) {
    ws.mergeCells(1, 1, 1, cols)
    ws.getCell(1, 1).value = this.rich(text, { bold: true, size: this.size + 7, color: this.theme.accent })
    ws.getRow(1).height = (this.size + 7) * 2
    ws.mergeCells(2, 1, 2, cols)
    ws.getCell(2, 1).value = this.rich(sub, { size: this.size - 1, color: '#777777', italic: true })
  }

  zebra(i: number) {
    return this.p.zebra && i % 2 === 1 ? this.theme.soft : undefined
  }
}

/** exceljs 以 UTC 写入日期，本地零点会被存成前一天，所以用 UTC 零点 */
const excelDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

const safeSheetName = (s: string) => s.replace(/[\\/?*[\]:]/g, '-').slice(0, 31)

function dueLabel(cal: SemesterCalendar, c: Course, a: Assessment, lang: Lang) {
  const d = resolveDue(cal, c, a)
  if (d.confidence === 'tba') return lang === 'en' ? 'TBA' : '待定 TBA'
  if (!d.date) return ''
  const wd = fromISO(d.date).getDay() || 7
  const day = lang === 'en' ? WEEKDAY_EN[wd] : WEEKDAY_ZH[wd]
  const range = a.dueWeekEnd ? ` – W${a.dueWeekEnd}` : ''
  const inferred = d.confidence === 'inferred' ? (lang === 'en' ? ' (inferred)' : '（推算）') : ''
  return `W${d.week ?? '?'}${range}  ${shortDate(d.date)} ${day}${d.time ? ' ' + d.time : ''}${inferred}`
}

function sessionsLabel(c: Course, lang: Lang) {
  return c.sessions
    .map((s) => `${lang === 'en' ? WEEKDAY_EN[s.weekday] : WEEKDAY_ZH[s.weekday]} ${s.start}–${s.end}  ${s.room}`)
    .join('\n')
}

function overviewSheet(wb: ExcelJS.Workbook, cal: SemesterCalendar, courses: Course[], st: Styler) {
  const L = st.p.lang
  const ws = wb.addWorksheet(safeSheetName(hx('Overview', '总览', L === 'bi' ? 'zh' : L)), {
    views: [{ state: 'frozen', ySplit: 2 }],
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  })
  const COLS = 11
  const HM = COLS + 2 // 热力图起始列：截止表右侧空一列
  ws.columns = [14, 8, 8, 8, 12, 44, 12, 8, 10, 10, 12, 3, 7, 12, ...courses.map(() => 9), 8].map((width) => ({ width }))
  st.title(ws, L === 'bi' ? `${cal.name} 学期总览 Overview` : hx(`${cal.name} Overview`, `${cal.name} 学期总览`, L), `${hx('Exported', '导出于', L)} ${todayISO()}`, COLS)

  // 一、截止事项
  let r = 4
  st.section(ws, r++, hx('1. Deadlines', '一、截止事项', L), COLS)
  st.header(ws, r++, [
    hx('Date', '日期', L), hx('Time', '时间', L), hx('Day', '星期', L), hx('Week', '教学周', L), hx('Course', '课程', L),
    hx('Item', '事项', L), hx('Type', '类型', L), hx('Weight', '占比', L), hx('Date source', '日期来源', L),
    hx('Days left', '距今(天)', L), hx('Status', '状态', L),
  ])
  const rows = courses.flatMap((c) =>
    c.assessments
      .filter((a) => isLeaf(c, a.id) && a.type !== 'Participation' && a.type !== 'FinalExam')
      .map((a) => ({ c, a, d: resolveDue(cal, c, a) })),
  )
  rows.sort((x, y) => (x.d.date ?? '9999').localeCompare(y.d.date ?? '9999'))
  const statusList = (['todo', 'doing', 'done'] as const).map((s) => tx(STATUS_LABEL[s], L === 'bi' ? 'zh' : L))
  rows.forEach(({ c, a, d }, i) => {
    const fill = st.zebra(i)
    const wd = d.date ? fromISO(d.date).getDay() || 7 : 0
    const src = { explicit: hx('Explicit', '明确', L), inferred: hx('Inferred', '推算', L), tba: 'TBA', none: '—' }[d.confidence]
    st.set(ws.getCell(r, 1), d.date ? excelDate(d.date) : 'TBA', { fill, center: true })
    if (d.date) ws.getCell(r, 1).numFmt = 'yyyy-mm-dd'
    st.set(ws.getCell(r, 2), d.time ?? '', { fill, center: true })
    st.set(ws.getCell(r, 3), wd ? (L === 'en' ? WEEKDAY_EN[wd] : WEEKDAY_ZH[wd]) : '', { fill, center: true })
    st.set(ws.getCell(r, 4), d.week ? `W${d.week}${a.dueWeekEnd ? '–' + a.dueWeekEnd : ''}` : '', { fill, center: true })
    st.set(ws.getCell(r, 5), c.short, { fill, bold: true, color: c.color })
    st.set(ws.getCell(r, 6), tx(a.name, L), { fill })
    st.set(ws.getCell(r, 7), tx(TYPE_LABEL[a.type], L === 'bi' ? 'zh' : L), {
      fill: st.p.typeColors ? mix(TYPE_COLOR[a.type], '#ffffff', 0.85) : fill,
      color: st.p.typeColors ? TYPE_COLOR[a.type] : undefined, center: true,
    })
    st.set(ws.getCell(r, 8), a.weight / 100, { fill, center: true })
    ws.getCell(r, 8).numFmt = '0%'
    st.set(ws.getCell(r, 9), src, { fill, center: true, color: d.confidence === 'explicit' ? undefined : '#b35900' })
    // 距今天数用公式，打开文件时自动更新
    const cd = ws.getCell(r, 10)
    st.set(cd, undefined, { fill, center: true })
    if (d.date) cd.value = { formula: `A${r}-TODAY()`, result: diffDays(todayISO(), d.date) }
    else cd.value = 'TBA'
    cd.numFmt = '0'
    st.set(ws.getCell(r, 11), tx(STATUS_LABEL[a.status], L === 'bi' ? 'zh' : L), { fill, center: true })
    ws.getCell(r, 11).dataValidation = { type: 'list', allowBlank: true, formulae: [`"${statusList.join(',')}"`] }
    r++
  })
  const first = r - rows.length
  ws.addConditionalFormatting({
    ref: `J${first}:J${r - 1}`,
    rules: [
      { type: 'cellIs', operator: 'between', formulae: ['0', '7'], priority: 1, style: { font: { color: { argb: argb('#b3261e') }, bold: true } } },
      { type: 'cellIs', operator: 'lessThan', formulae: ['0'], priority: 2, style: { font: { color: { argb: argb('#aaaaaa') } } } },
    ],
  })

  // 二、每周负荷热力图（与截止表并排）
  const endDeadlines = r
  let h = 4
  const hmCols = 3 + courses.length
  ws.mergeCells(h, HM, h, HM + hmCols - 1)
  st.section(ws, h, hx('2. Weekly load (sum of weights due)', '二、每周负荷热力图（当周截止占比之和）', L), 0, HM)
  h++
  const load = weeklyLoad(cal, courses)
  const hmHeader = [hx('Week', '教学周', L), hx('Dates', '日期', L), ...courses.map((c) => c.short), hx('Total', '合计', L)]
  hmHeader.forEach((t, i) => st.set(ws.getCell(h, HM + i), t, { bold: true, color: '#ffffff', fill: st.theme.primary, center: true }))
  h++
  for (const w of cal.weeks) {
    const byC = load[w.week] ?? {}
    const total = Object.values(byC).reduce((sum, v) => sum + v, 0)
    const grey = w.reading ? '#e6e6e6' : undefined
    st.set(ws.getCell(h, HM), `W${w.week}`, { center: true, bold: true, fill: grey })
    st.set(ws.getCell(h, HM + 1), w.label && !w.reading ? w.label : weekRangeLabel(cal, w.week), { center: true, size: st.size - 1.5, fill: grey, wrap: false })
    courses.forEach((c, i) => {
      const v = byC[c.code] ?? 0
      st.set(ws.getCell(h, HM + 2 + i), v ? `${v}%` : '', { center: true, fill: v ? mix(st.theme.soft, st.theme.primary, Math.min(1, v / 40)) : grey, color: v >= 25 ? '#ffffff' : undefined })
    })
    st.set(ws.getCell(h, HM + 2 + courses.length), total ? `${total}%` : '', { center: true, bold: true, fill: total ? mix('#ffffff', '#b3261e', Math.min(0.85, total / 70)) : grey, color: total >= 35 ? '#ffffff' : undefined })
    h++
  }
  r = Math.max(endDeadlines, h)

  // 三、各课总评构成
  r += 1
  st.section(ws, r++, hx('3. Assessment composition', '三、各课总评构成', L), COLS)
  st.header(ws, r++, [hx('Course', '课程', L), hx('Particip.', '参与', L), hx('Indiv.', '个人', L), hx('Group', '小组', L), hx('Final', '期末', L), [hx('Components', '组成', L), 6]])
  courses.forEach((c, i) => {
    const fill = st.zebra(i)
    const leaf = c.assessments.filter((a) => isLeaf(c, a.id))
    const sum = (f: (a: Assessment) => boolean) => leaf.filter(f).reduce((s, a) => s + a.weight, 0)
    st.set(ws.getCell(r, 1), `${c.short}  ${c.code}`, { bold: true, color: c.color, fill })
    st.set(ws.getCell(r, 2), `${sum((a) => a.type === 'Participation')}%`, { center: true, fill })
    st.set(ws.getCell(r, 3), `${sum((a) => !a.group && a.type !== 'FinalExam' && a.type !== 'Participation')}%`, { center: true, fill })
    st.set(ws.getCell(r, 4), `${sum((a) => !!a.group)}%`, { center: true, fill })
    st.set(ws.getCell(r, 5), c.finalExam ? `${sum((a) => a.type === 'FinalExam')}%` : hx('None', '无', L), { center: true, fill })
    ws.mergeCells(r, 6, r, 11)
    st.set(ws.getCell(r, 6), topLevel(c).map((a) => `${tx(a.name, L === 'bi' ? 'zh' : L)} ${a.weight}%`).join('；'), { fill })
    r++
  })
}

function courseSheet(wb: ExcelJS.Workbook, cal: SemesterCalendar, c: Course, st: Styler) {
  const L = st.p.lang
  const ws = wb.addWorksheet(safeSheetName(c.code), {
    views: [{ state: 'frozen', ySplit: 2 }],
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    properties: { tabColor: { argb: argb(c.color) } },
  })
  const COLS = 10
  ws.columns = [8, 13, 9, 40, 16, 36, 30, 32, 9, 12].map((width) => ({ width }))
  st.title(ws, `${c.code}  ${tx(c.name, L).replace('\n', '  ')}`, `Section ${c.section} · ${c.teacher}`, COLS)

  const kv = (r: number, k: string, v: string, i: number) => {
    ws.mergeCells(r, 1, r, 3)
    ws.mergeCells(r, 4, r, 8)
    st.set(ws.getCell(r, 1), k, { bold: true, fill: st.theme.soft })
    st.set(ws.getCell(r, 4), v, { fill: st.zebra(i) })
  }

  // 一、课程信息
  let r = 4
  st.section(ws, r++, hx('1. Course information', '一、课程信息', L), COLS)
  const info: [string, string][] = [
    [hx('Course', '课程名称', L), tx(c.name, L)],
    [hx('Short name', '简称', L), c.short],
    ['Section', c.section],
    [hx('Convener', '课程负责人', L), c.convener],
    [hx('Teacher', '任课老师', L), c.teacher],
    [hx('Class times', '上课时间', L), sessionsLabel(c, L)],
  ]
  if (c.consultation) info.push([hx('Consultation', '答疑时间', L), c.consultation])
  if (c.aiPolicy) info.push([hx('AI policy', 'AI 政策', L), tx(c.aiPolicy, L)])
  info.push([hx('Final exam', '期末考试', L), c.finalExam ? hx('Yes', '有', L) : hx('None', '无', L)])
  info.forEach(([k, v], i) => kv(r++, k, v, i))

  // 二、评分构成
  r += 1
  st.section(ws, r++, hx('2. Assessment', '二、评分构成', L), COLS)
  st.header(ws, r, [[hx('Item', '项目', L), 3], hx('Requirements', '要求', L), hx('Type', '类型', L), hx('Release → Due', '发布 → 截止', L), hx('AI policy', 'AI 政策', L), hx('Late policy', '迟交政策', L), hx('Weight', '占比', L), hx('Status', '状态', L)])
  r++
  const ordered: { a: Assessment; depth: number }[] = []
  for (const a of topLevel(c)) {
    ordered.push({ a, depth: 0 })
    childrenOf(c, a.id).forEach((k) => ordered.push({ a: k, depth: 1 }))
  }
  ordered.forEach(({ a, depth }, i) => {
    const fill = st.zebra(i)
    const parent = !isLeaf(c, a.id)
    ws.mergeCells(r, 1, r, 3)
    st.set(ws.getCell(r, 1), tx(a.name, L), { fill, bold: depth === 0, indent: depth * 2 })
    st.set(ws.getCell(r, 4), tx(a.requirements, L) + (a.conflict ? `\n⚠ ${tx(a.conflict, L)}` : ''), { fill, size: st.size - 0.5 })
    st.set(ws.getCell(r, 5), tx(TYPE_LABEL[a.type], L === 'bi' ? 'zh' : L), {
      center: true,
      fill: st.p.typeColors && !parent ? mix(TYPE_COLOR[a.type], '#ffffff', 0.85) : fill,
      color: st.p.typeColors && !parent ? TYPE_COLOR[a.type] : undefined,
    })
    const rel = a.releaseWeek ? `W${a.releaseWeek} → ` : ''
    st.set(ws.getCell(r, 6), parent || a.type === 'Participation' || a.type === 'FinalExam' ? (a.type === 'FinalExam' ? hx('Exam period 12/16–12/27', '考试周 12/16–12/27', L) : '') : rel + dueLabel(cal, c, a, L), { fill })
    st.set(ws.getCell(r, 7), tx(a.aiPolicy, L), { fill, size: st.size - 0.5 })
    st.set(ws.getCell(r, 8), tx(a.latePolicy, L), { fill, size: st.size - 0.5 })
    st.set(ws.getCell(r, 9), a.weight / 100, { fill, center: true, bold: depth === 0 })
    ws.getCell(r, 9).numFmt = '0%'
    st.set(ws.getCell(r, 10), parent ? '' : tx(STATUS_LABEL[a.status], L === 'bi' ? 'zh' : L), { fill, center: true })
    r++
  })
  const total = topLevel(c).reduce((s, a) => s + a.weight, 0)
  ws.mergeCells(r, 1, r, 8)
  st.set(ws.getCell(r, 1), hx('Total', '合计', L), { bold: true, fill: st.theme.soft })
  st.set(ws.getCell(r, 9), total / 100, { bold: true, center: true, fill: total === 100 ? st.theme.soft : '#f6d5d3', color: total === 100 ? undefined : '#b3261e' })
  ws.getCell(r, 9).numFmt = '0%'
  st.set(ws.getCell(r, 10), '', { fill: st.theme.soft })
  r += 2

  // 三、每周教学计划
  st.section(ws, r++, hx('3. Weekly teaching plan', '三、每周教学计划', L), COLS)
  st.header(ws, r++, [hx('Week', '教学周', L), hx('Dates', '日期', L), hx('Lecture', '讲次', L), hx('Topic', '主题', L), hx('Chapters', '章节', L), hx('Class activity', '课堂活动', L), hx('Homework', '作业练习', L), [hx('This week', '本周事项', L), 3]])
  for (const [i, row] of c.weekly.entries()) {
    const fill = row.readingWeek ? '#e6e6e6' : st.zebra(i)
    st.set(ws.getCell(r, 1), `W${row.week}`, { center: true, bold: true, fill })
    st.set(ws.getCell(r, 2), weekRangeLabel(cal, row.week), { center: true, fill, size: st.size - 1 })
    st.set(ws.getCell(r, 3), row.lectureNo ? `L${row.lectureNo}` : '', { center: true, fill })
    st.set(ws.getCell(r, 4), tx(row.topic, L), { fill, bold: !row.readingWeek })
    st.set(ws.getCell(r, 5), row.chapters ?? '', { fill, size: st.size - 1 })
    st.set(ws.getCell(r, 6), tx(row.activity, L), { fill })
    st.set(ws.getCell(r, 7), tx(row.homework, L), { fill })
    ws.mergeCells(r, 8, r, 10)
    st.set(ws.getCell(r, 8), tx(row.events, L), { fill, color: row.events ? st.theme.accent : undefined })
    r++
  }
  r += 1

  // 四、重要时间点
  if (c.keyDates.length) {
    st.section(ws, r++, hx('4. Key dates', '四、重要时间点', L), COLS)
    c.keyDates.forEach((k, i) => {
      ws.mergeCells(r, 1, r, 3)
      ws.mergeCells(r, 4, r, 10)
      st.set(ws.getCell(r, 1), k.date ?? (k.week ? `W${k.week}  ${weekRangeLabel(cal, k.week)}` : '—'), { bold: true, fill: st.theme.soft })
      st.set(ws.getCell(r, 4), tx(k.event, L), { fill: st.zebra(i) })
      r++
    })
    r += 1
  }

  // 五、教材
  st.section(ws, r++, hx('5. Textbooks', '五、教材', L), COLS)
  const books: [string, string][] = [
    ...c.textbooks.required.map((b) => [hx('Required', '必读', L), b] as [string, string]),
    ...c.textbooks.references.map((b) => [hx('Reference', '参考', L), b] as [string, string]),
  ]
  books.forEach(([k, b], i) => {
    ws.mergeCells(r, 1, r, 3)
    ws.mergeCells(r, 4, r, 10)
    st.set(ws.getCell(r, 1), k, { bold: true, fill: st.theme.soft })
    st.set(ws.getCell(r, 4), b, { fill: st.zebra(i) })
    r++
  })
}

export async function buildWorkbook(cal: SemesterCalendar, courses: Course[], p: ExportPrefs, theme: Theme) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'STP 学期工作台'
  wb.created = new Date()
  const st = new Styler(p, theme)
  overviewSheet(wb, cal, courses, st)
  for (const c of courses) courseSheet(wb, cal, c, st)
  return wb
}

export async function downloadWorkbook(cal: SemesterCalendar, courses: Course[], p: ExportPrefs, theme: Theme) {
  const wb = await buildWorkbook(cal, courses, p, theme)
  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${cal.name.replace(/\W+/g, '_')}_课程汇总_${todayISO()}.xlsx`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}
