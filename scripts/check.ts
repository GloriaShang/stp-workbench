// 数据层自检：校验结果、截止日期推算、排程、Excel 生成
import { S1_2026 as cal } from '../src/data/calendar'
import { SEED_COURSES as courses } from '../src/data/courses'
import { courseIssues, globalIssues } from '../src/lib/validate'
import { resolveDue, classOccurrences } from '../src/lib/dates'
import { schedule, DEFAULT_RULES } from '../src/lib/scheduler'
import { buildWorkbook } from '../src/lib/excel'
import { DEFAULT_EXPORT } from '../src/lib/exportPrefs'
import { THEMES } from '../src/lib/themes'
import { isLeaf } from '../src/lib/validate'

for (const c of courses) {
  console.log(`\n== ${c.code} (${c.short}) — ${classOccurrences(cal, c).length} 次课`)
  for (const a of c.assessments.filter((a) => isLeaf(c, a.id))) {
    const d = resolveDue(cal, c, a)
    console.log(`  ${a.weight}%\t${a.name.zh}\t→ ${d.date ?? '-'} ${d.time ?? ''} W${d.week ?? '?'} [${d.confidence}]`)
  }
  for (const i of courseIssues(cal, c)) console.log(`  ${i.severity.toUpperCase()}: ${i.message}`)
}
for (const i of globalIssues(cal, courses)) console.log(`GLOBAL ${i.message}`)

const all = { ...DEFAULT_RULES, preview: { ...DEFAULT_RULES.preview, on: true }, review: { ...DEFAULT_RULES.review, on: true },
  assignment: { ...DEFAULT_RULES.assignment, on: true }, group: { ...DEFAULT_RULES.group, on: true }, exam: { ...DEFAULT_RULES.exam, on: true }, inclass: { on: true } }
const res = schedule(cal, courses, all, [], '2026-09-22', new Set())
console.log(`\n排程：${res.suggestions.length} 个建议，${res.unplaced.length} 个放不下`)
res.suggestions.filter((s) => s.date <= '2026-09-27').forEach((s) => console.log(`  ${s.date} ${s.start}-${s.end} ${s.title}`))
res.unplaced.slice(0, 8).forEach((u) => console.log('  放不下:', u.title))
const again = schedule(cal, courses, all, [], '2026-09-22', new Set())
console.log('确定性:', JSON.stringify(again) === JSON.stringify(res))

for (const lang of ['zh', 'en', 'bi'] as const) {
  const wb = await buildWorkbook(cal, courses, { ...DEFAULT_EXPORT, lang }, THEMES[0])
  await wb.xlsx.writeFile(`${process.env.OUT}/test_${lang}.xlsx`)
}
console.log('xlsx written')
