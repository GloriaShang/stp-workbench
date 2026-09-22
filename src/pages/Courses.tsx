import { useEffect, useState } from 'react'
import { Badge, Button, Card, Check, Segmented } from '../components/ui'
import { resolveDue, shortDate, WEEKDAY_ZH, weekRangeLabel } from '../lib/dates'
import { idbDel, idbGet, idbKeys, idbSet } from '../lib/idb'
import { STATUS_LABEL, TYPE_LABEL } from '../lib/i18n'
import { childrenOf, courseIssues, topLevel } from '../lib/validate'
import { useStore } from '../store'
import type { Assessment, AssessmentType, Course, L, Weekday, WeekRow } from '../types'

type EditLang = 'zh' | 'en'
const TYPES = Object.keys(TYPE_LABEL) as AssessmentType[]
const PALETTE = ['#2f6f8f', '#7a4f9a', '#b25f3a', '#3f7f5a', '#8f3a4f', '#a07a2c', '#355c7d', '#5c6f2f', '#6b5b95', '#3b8f86']

export default function Courses() {
  const { courses, activeCourse, set, calendar } = useStore()
  const [adding, setAdding] = useState(false)
  const c = courses.find((x) => x.code === activeCourse) ?? courses[0]

  return (
    <div className="flex h-full">
      <aside className="w-52 shrink-0 space-y-1 overflow-y-auto border-r border-line bg-panel p-2">
        <div className="px-2 py-1 text-xs text-muted">课程（{courses.length}/10）</div>
        {courses.map((x) => {
          const n = courseIssues(calendar, x).filter((i) => i.severity !== 'info').length
          return (
            <button
              key={x.code}
              onClick={() => set({ activeCourse: x.code })}
              className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm ${x.code === c?.code ? 'bg-panel-2 font-bold' : 'hover:bg-panel-2'}`}
            >
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: x.color }} />
              <span className="min-w-0 flex-1">
                <span className="block truncate">{x.short}</span>
                <span className="block truncate text-xs font-normal text-muted">{x.code}</span>
              </span>
              {n > 0 && <Badge color="var(--danger)">{n}</Badge>}
            </button>
          )
        })}
        <Button className="mt-2 w-full justify-center" disabled={courses.length >= 10} onClick={() => setAdding(true)}>
          ＋ 新增课程
        </Button>
      </aside>
      <div className="min-w-0 flex-1 overflow-y-auto">
        {adding ? <NewCourse onDone={() => setAdding(false)} /> : c ? <CourseEditor key={c.code} c={c} /> : null}
      </div>
    </div>
  )
}

function NewCourse({ onDone }: { onDone: () => void }) {
  const { courses, addCourse } = useStore()
  const [f, setF] = useState({ code: '', short: '', en: '', zh: '' })
  const ok = f.code.trim() && f.short.trim() && !courses.some((c) => c.code === f.code.trim())
  return (
    <div className="mx-auto max-w-xl p-6">
      <Card title="新增课程">
        <p className="mb-3 text-sm text-muted">
          先填基本信息，建好后再逐项补周计划、评分构成，把 STP 原文件作为附件上传，方便对照。
        </p>
        <div className="grid grid-cols-[6rem_1fr] items-center gap-2 text-sm">
          <span>课程代码</span><input className="field" value={f.code} placeholder="如 FIN3073" onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} />
          <span>简称</span><input className="field" value={f.short} placeholder="日历里显示，如 FM" onChange={(e) => setF({ ...f, short: e.target.value })} />
          <span>英文名称</span><input className="field" value={f.en} onChange={(e) => setF({ ...f, en: e.target.value })} />
          <span>中文名称</span><input className="field" value={f.zh} onChange={(e) => setF({ ...f, zh: e.target.value })} />
        </div>
        <div className="mt-4 flex gap-2">
          <Button
            kind="primary"
            disabled={!ok}
            onClick={() => {
              const code = f.code.trim()
              addCourse({
                code, short: f.short.trim(), name: { en: f.en, zh: f.zh }, section: '', convener: '', teacher: '',
                color: PALETTE[courses.length % PALETTE.length], sessions: [],
                weekly: Array.from({ length: 14 }, (_, i): WeekRow => (i + 1 === 8 ? { week: 8, readingWeek: true, topic: { en: 'Reading Week', zh: '阅读周' } } : { week: i + 1, topic: { en: '', zh: '' } })),
                assessments: [], keyDates: [], textbooks: { required: [], references: [] }, finalExam: true, sources: [],
              })
              onDone()
            }}
          >
            创建
          </Button>
          <Button onClick={onDone}>取消</Button>
        </div>
      </Card>
    </div>
  )
}

function CourseEditor({ c }: { c: Course }) {
  const { setCourse, removeCourse, calendar } = useStore()
  const [lang, setLang] = useState<EditLang>('zh')
  const upd = (patch: Partial<Course>) => setCourse(c.code, (x) => ({ ...x, ...patch }))
  const issues = courseIssues(calendar, c)
  const total = topLevel(c).reduce((s, a) => s + a.weight, 0)

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <input type="color" className="h-8 w-8 cursor-pointer rounded border border-line bg-transparent" value={c.color} onChange={(e) => upd({ color: e.target.value })} title="课程颜色" />
        <input className="field w-28 text-lg font-bold" value={c.short} onChange={(e) => upd({ short: e.target.value })} title="简称" />
        <span className="text-muted">{c.code}</span>
        <span className="text-lg">{c.name.zh}</span>
        <span className="text-muted">{c.name.en}</span>
        <div className="flex-1" />
        <span className="text-sm text-muted">编辑语言</span>
        <Segmented<EditLang> value={lang} onChange={setLang} options={[{ v: 'zh', label: '中文' }, { v: 'en', label: 'English' }]} />
      </div>

      {issues.length > 0 && (
        <Card title="核对提示">
          <ul className="space-y-1 text-sm">
            {issues.map((i, k) => (
              <li key={k} className={i.severity === 'error' ? 'text-danger' : i.severity === 'warn' ? 'text-warn' : 'text-muted'}>
                {i.severity === 'error' ? '●' : i.severity === 'warn' ? '▲' : '·'} {i.message}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="课程信息">
          <div className="grid grid-cols-[6.5rem_1fr] items-center gap-2 text-sm">
            <span className="text-muted">英文名称</span><input className="field" value={c.name.en} onChange={(e) => upd({ name: { ...c.name, en: e.target.value } })} />
            <span className="text-muted">中文名称</span><input className="field" value={c.name.zh} onChange={(e) => upd({ name: { ...c.name, zh: e.target.value } })} />
            <span className="text-muted">Section</span><input className="field" value={c.section} onChange={(e) => upd({ section: e.target.value })} />
            <span className="text-muted">课程负责人</span><input className="field" value={c.convener} onChange={(e) => upd({ convener: e.target.value })} />
            <span className="text-muted">任课老师</span><input className="field" value={c.teacher} onChange={(e) => upd({ teacher: e.target.value })} />
            <span className="text-muted">答疑时间</span><input className="field" value={c.consultation ?? ''} onChange={(e) => upd({ consultation: e.target.value })} />
            <span className="text-muted">AI 政策</span><LInput v={c.aiPolicy} lang={lang} onChange={(v) => upd({ aiPolicy: v })} />
            <span className="text-muted">期末考试</span><Check checked={c.finalExam} onChange={(v) => upd({ finalExam: v })} label={c.finalExam ? '有' : '无'} />
          </div>
        </Card>
        <Card title="上课时间" extra={<Button kind="ghost" className="text-xs" onClick={() => upd({ sessions: [...c.sessions, { weekday: 1, start: '09:00', end: '09:50', room: '' }] })}>＋ 添加</Button>}>
          <div className="space-y-2 text-sm">
            {c.sessions.map((s, i) => {
              const setS = (p: Partial<typeof s>) => upd({ sessions: c.sessions.map((x, j) => (j === i ? { ...x, ...p } : x)) })
              return (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <select className="field" value={s.weekday} onChange={(e) => setS({ weekday: Number(e.target.value) as Weekday })}>
                    {[1, 2, 3, 4, 5, 6, 7].map((d) => <option key={d} value={d}>{WEEKDAY_ZH[d]}</option>)}
                  </select>
                  <input type="time" className="field" value={s.start} onChange={(e) => setS({ start: e.target.value })} />–
                  <input type="time" className="field" value={s.end} onChange={(e) => setS({ end: e.target.value })} />
                  <input className="field w-24" placeholder="教室" value={s.room} onChange={(e) => setS({ room: e.target.value })} />
                  <Button kind="ghost" className="text-muted" onClick={() => upd({ sessions: c.sessions.filter((_, j) => j !== i) })}>✕</Button>
                </div>
              )
            })}
            <p className="text-xs text-muted">补课日（9/20 补周五、10/10 补周一）和假期由校历自动处理。</p>
          </div>
          <Attachments code={c.code} sources={c.sources} />
        </Card>
      </div>

      <Card
        title={<>评分构成 <span className={`ml-2 text-sm ${total === 100 ? 'text-ok' : 'text-danger'}`}>合计 {total}%</span></>}
        extra={<Button kind="ghost" className="text-xs" onClick={() => upd({ assessments: [...c.assessments, newAssessment(c)] })}>＋ 添加项目</Button>}
      >
        <AssessmentTable c={c} lang={lang} />
      </Card>

      <Card title="每周教学计划">
        <WeeklyTable c={c} lang={lang} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="重要时间点" extra={<Button kind="ghost" className="text-xs" onClick={() => upd({ keyDates: [...c.keyDates, { week: undefined, event: { en: '', zh: '' } }] })}>＋ 添加</Button>}>
          <div className="space-y-1.5 text-sm">
            {c.keyDates.map((k, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-muted">W</span>
                <input className="field w-12 text-center" value={k.week ?? ''} onChange={(e) => upd({ keyDates: c.keyDates.map((x, j) => (j === i ? { ...x, week: e.target.value ? Number(e.target.value) : undefined } : x)) })} />
                <div className="flex-1"><LInput v={k.event} lang={lang} onChange={(v) => upd({ keyDates: c.keyDates.map((x, j) => (j === i ? { ...x, event: v } : x)) })} /></div>
                <Button kind="ghost" className="text-muted" onClick={() => upd({ keyDates: c.keyDates.filter((_, j) => j !== i) })}>✕</Button>
              </div>
            ))}
            {!c.keyDates.length && <p className="text-muted">暂无</p>}
          </div>
        </Card>
        <Card title="教材">
          <div className="space-y-2 text-sm">
            <label className="block text-muted">必读（每行一本）</label>
            <textarea className="field w-full" rows={3} value={c.textbooks.required.join('\n')} onChange={(e) => upd({ textbooks: { ...c.textbooks, required: e.target.value.split('\n').filter(Boolean) } })} />
            <label className="block text-muted">参考</label>
            <textarea className="field w-full" rows={2} value={c.textbooks.references.join('\n')} onChange={(e) => upd({ textbooks: { ...c.textbooks, references: e.target.value.split('\n').filter(Boolean) } })} />
          </div>
        </Card>
      </div>

      <div className="pb-8 text-right">
        <Button kind="danger" onClick={() => confirm(`删除 ${c.code}？此操作只影响工作台，不会删 STP 原文件。`) && removeCourse(c.code)}>删除这门课</Button>
      </div>
    </div>
  )
}

function newAssessment(c: Course): Assessment {
  return { id: `${c.code.toLowerCase()}-${Date.now().toString(36)}`, name: { en: '', zh: '新项目' }, type: 'Individual', weight: 0, status: 'todo' }
}

/** 双语字段：只编辑当前选中的语言 */
function LInput({ v, lang, onChange, multiline, className = 'field w-full' }: { v?: L; lang: EditLang; onChange: (v: L) => void; multiline?: boolean; className?: string }) {
  const val = v?.[lang] ?? ''
  const other = v?.[lang === 'zh' ? 'en' : 'zh'] ?? ''
  const next = (s: string) => onChange({ en: v?.en ?? '', zh: v?.zh ?? '', [lang]: s })
  return multiline ? (
    <textarea className={className} rows={1} value={val} placeholder={other} onChange={(e) => next(e.target.value)} title={other} />
  ) : (
    <input className={className} value={val} placeholder={other} onChange={(e) => next(e.target.value)} title={other} />
  )
}

function AssessmentTable({ c, lang }: { c: Course; lang: EditLang }) {
  const { setAssessment, setCourse, calendar } = useStore()
  const rows: { a: Assessment; depth: number }[] = []
  for (const a of topLevel(c)) {
    rows.push({ a, depth: 0 })
    childrenOf(c, a.id).forEach((k) => rows.push({ a: k, depth: 1 }))
  }
  const up = (a: Assessment, p: Partial<Assessment>) => setAssessment(c.code, a.id, p)
  const num = (s: string) => (s === '' ? undefined : Number(s))
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1000px] text-sm">
        <thead className="text-left text-xs text-muted">
          <tr className="border-b border-line">
            <th className="py-1 font-normal">项目</th>
            <th className="font-normal">类型</th>
            <th className="w-16 font-normal">占比 %</th>
            <th className="font-normal">小组 / 课内</th>
            <th className="w-14 font-normal">发布周</th>
            <th className="w-14 font-normal">截止周</th>
            <th className="font-normal">截止日期 / 时间</th>
            <th className="font-normal">推算结果</th>
            <th className="font-normal">状态</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map(({ a, depth }) => {
            const leaf = !childrenOf(c, a.id).length
            const d = resolveDue(calendar, c, a)
            return (
              <tr key={a.id} className="border-b border-line-soft align-top">
                <td className="py-1" style={{ paddingLeft: depth * 20 }}>
                  <LInput v={a.name} lang={lang} onChange={(v) => up(a, { name: v })} className={`cell-input ${depth === 0 ? 'font-bold' : ''}`} />
                  {leaf && <LInput v={a.requirements} lang={lang} multiline onChange={(v) => up(a, { requirements: v })} className="cell-input text-xs text-muted" />}
                </td>
                <td>
                  <select className="cell-input" value={a.type} onChange={(e) => up(a, { type: e.target.value as AssessmentType })}>
                    {TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t].zh}</option>)}
                  </select>
                </td>
                <td><input className="cell-input text-center" value={a.weight} onChange={(e) => up(a, { weight: Number(e.target.value) || 0 })} /></td>
                <td className="space-y-0.5 text-xs">
                  {leaf && <Check checked={!!a.group} onChange={(v) => up(a, { group: v })} label="小组" />}
                  {leaf && <Check checked={!!a.inClass} onChange={(v) => up(a, { inClass: v })} label="课内" className="block" />}
                </td>
                <td>{leaf && <input className="cell-input text-center" value={a.releaseWeek ?? ''} onChange={(e) => up(a, { releaseWeek: num(e.target.value) })} />}</td>
                <td>{leaf && <input className="cell-input text-center" value={a.dueWeek ?? ''} onChange={(e) => up(a, { dueWeek: num(e.target.value) })} />}</td>
                <td className="space-y-0.5">
                  {leaf && (
                    <>
                      <input type="date" className="cell-input" value={a.dueDate ?? ''} onChange={(e) => up(a, { dueDate: e.target.value || undefined })} />
                      <div className="flex items-center gap-1">
                        <input type="time" className="cell-input" value={a.dueTime ?? ''} onChange={(e) => up(a, { dueTime: e.target.value || undefined })} />
                        <Check checked={!!a.tba} onChange={(v) => up(a, { tba: v })} label={<span className="text-xs">TBA</span>} />
                      </div>
                    </>
                  )}
                </td>
                <td className="text-xs whitespace-nowrap">
                  {leaf && a.type !== 'Participation' && a.type !== 'FinalExam' && (
                    d.date ? (
                      <span className={d.confidence === 'inferred' ? 'text-warn' : ''}>
                        W{d.week} {shortDate(d.date)} {WEEKDAY_ZH[new Date(d.date + 'T00:00').getDay() || 7]} {d.time}
                        {d.confidence === 'inferred' && '（推算）'}
                      </span>
                    ) : <span className="text-muted">{d.confidence === 'tba' ? 'TBA' : '—'}</span>
                  )}
                </td>
                <td>
                  {leaf && (
                    <select className="cell-input" value={a.status} onChange={(e) => up(a, { status: e.target.value as Assessment['status'] })}>
                      {(['todo', 'doing', 'done'] as const).map((s) => <option key={s} value={s}>{STATUS_LABEL[s].zh}</option>)}
                    </select>
                  )}
                </td>
                <td className="whitespace-nowrap">
                  {depth === 0 && (
                    <button className="text-xs text-muted hover:text-accent" title="添加子项" onClick={() => setCourse(c.code, (x) => ({ ...x, assessments: [...x.assessments, { ...newAssessment(x), parentId: a.id }] }))}>＋子项</button>
                  )}
                  <button
                    className="ml-2 text-xs text-muted hover:text-danger"
                    onClick={() => confirm(`删除「${a.name.zh || a.name.en}」${leaf ? '' : '及其子项'}？`) && setCourse(c.code, (x) => ({ ...x, assessments: x.assessments.filter((y) => y.id !== a.id && y.parentId !== a.id) }))}
                  >
                    删除
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function WeeklyTable({ c, lang }: { c: Course; lang: EditLang }) {
  const { setCourse, calendar } = useStore()
  const upRow = (week: number, p: Partial<WeekRow>) => setCourse(c.code, (x) => ({ ...x, weekly: x.weekly.map((r) => (r.week === week ? { ...r, ...p } : r)) }))
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-sm">
        <thead className="text-left text-xs text-muted">
          <tr className="border-b border-line">
            <th className="w-12 py-1 font-normal">周</th>
            <th className="w-20 font-normal">日期</th>
            <th className="font-normal">主题</th>
            <th className="w-32 font-normal">章节</th>
            <th className="font-normal">课堂活动</th>
            <th className="font-normal">作业练习</th>
            <th className="font-normal">本周事项</th>
          </tr>
        </thead>
        <tbody>
          {c.weekly.map((r) => (
            <tr key={r.week} className={`border-b border-line-soft align-top ${r.readingWeek ? 'bg-panel-2 text-muted' : ''}`}>
              <td className="py-1 font-bold">W{r.week}{r.lectureNo ? <div className="text-xs font-normal text-muted">L{r.lectureNo}</div> : null}</td>
              <td className="pt-1.5 text-xs text-muted">{weekRangeLabel(calendar, r.week)}</td>
              <td><LInput v={r.topic} lang={lang} multiline onChange={(v) => upRow(r.week, { topic: v })} className="cell-input font-bold" /></td>
              <td><input className="cell-input text-xs" value={r.chapters ?? ''} onChange={(e) => upRow(r.week, { chapters: e.target.value })} /></td>
              <td><LInput v={r.activity} lang={lang} multiline onChange={(v) => upRow(r.week, { activity: v })} className="cell-input text-xs" /></td>
              <td><LInput v={r.homework} lang={lang} multiline onChange={(v) => upRow(r.week, { homework: v })} className="cell-input text-xs" /></td>
              <td><LInput v={r.events} lang={lang} multiline onChange={(v) => upRow(r.week, { events: v })} className="cell-input text-xs text-accent" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** 原始文件附件：存在浏览器 IndexedDB，只在本机可见 */
function Attachments({ code, sources }: { code: string; sources: string[] }) {
  const [files, setFiles] = useState<string[]>([])
  const prefix = `file:${code}:`
  const refresh = async () => setFiles((await idbKeys()).map(String).filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length)))
  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])
  return (
    <div className="mt-4 border-t border-line-soft pt-3 text-sm">
      <div className="mb-1 flex items-center justify-between">
        <span className="font-bold">原始文件</span>
        <label className="cursor-pointer text-xs text-accent">
          ＋ 上传 STP / Rubrics / 作业说明
          <input
            type="file"
            multiple
            className="hidden"
            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.pptx"
            onChange={async (e) => {
              for (const f of Array.from(e.target.files ?? [])) await idbSet(prefix + f.name, f)
              e.target.value = ''
              refresh()
            }}
          />
        </label>
      </div>
      <ul className="space-y-0.5">
        {files.map((n) => (
          <li key={n} className="flex items-center gap-2">
            <button className="truncate text-left text-accent hover:underline" onClick={async () => { const f = await idbGet<File>(prefix + n); if (f) window.open(URL.createObjectURL(f)) }}>{n}</button>
            <button className="ml-auto text-xs text-muted hover:text-danger" onClick={async () => { await idbDel(prefix + n); refresh() }}>删除</button>
          </li>
        ))}
      </ul>
      {!files.length && sources.length > 0 && (
        <p className="text-xs text-muted">数据来源：{sources.join('；')}</p>
      )}
    </div>
  )
}
