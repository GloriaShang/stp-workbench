import { useEffect, useMemo } from 'react'
import { Badge, Card, COURSE_DOT, Empty } from '../components/ui'
import { classOccurrences, diffDays, resolveDue, shortDate, teachingWeekOf, todayISO, WEEKDAY_ZH, weekdayOf, weekRangeLabel } from '../lib/dates'
import { useSuggestions } from '../lib/events'
import { matchCourse, NEUTRAL } from '../lib/courseMatch'
import type { ObsidianTask } from '../lib/obsidian'
import { localAsTask, toggleTask } from '../tasks'
import { STATUS_LABEL, TYPE_LABEL } from '../lib/i18n'
import { courseIssues, globalIssues, isLeaf, weeklyLoad } from '../lib/validate'
import { useStore } from '../store'
import { useVault } from '../vault'
import type { AssessmentStatus } from '../types'

export default function Dashboard() {
  const { calendar, courses, setAssessment, setPage, set, localTasks } = useStore()
  const vault = useVault()
  const { suggestions } = useSuggestions()
  const today = todayISO()
  const week = teachingWeekOf(calendar, today)

  useEffect(() => {
    vault.load([today])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vault.status])

  // 今天：上课 + Obsidian 待办 + 建议，按时间合并
  const todayItems = useMemo(() => {
    const items: { time: string; end?: string; label: string; sub?: string; color: string; kind: string; done?: boolean; task?: ObsidianTask }[] = []
    for (const c of courses) {
      for (const o of classOccurrences(calendar, c).filter((o) => o.date === today)) {
        items.push({ time: o.start, end: o.end, label: `${c.short} 上课`, sub: o.room, color: c.color, kind: '上课' })
      }
    }
    const local = localTasks.filter((t) => t.date === today).map(localAsTask)
    for (const t of [...(vault.days[today]?.tasks ?? []), ...local]) {
      items.push({ time: t.start ?? '', end: t.end, label: t.text, color: matchCourse(t.text, courses)?.color ?? NEUTRAL, kind: t.localId ? '待办' : 'Obsidian', done: t.status !== ' ', task: t })
    }
    for (const s of suggestions.filter((s) => s.date === today)) {
      items.push({ time: s.start, end: s.end, label: s.title, color: courses.find((c) => c.code === s.course)?.color ?? '#888', kind: '建议' })
    }
    return items.sort((a, b) => (a.time || '99').localeCompare(b.time || '99'))
  }, [courses, calendar, today, vault.days, localTasks, suggestions])

  const upcoming = useMemo(
    () =>
      courses
        .flatMap((c) =>
          c.assessments
            .filter((a) => isLeaf(c, a.id) && a.type !== 'Participation' && a.type !== 'FinalExam')
            .map((a) => ({ c, a, d: resolveDue(calendar, c, a) })),
        )
        .filter((x) => x.d.confidence === 'tba' || (x.d.date && x.d.date >= today))
        .sort((x, y) => (x.d.date ?? '9999').localeCompare(y.d.date ?? '9999')),
    [courses, calendar, today],
  )

  const load = weeklyLoad(calendar, courses)
  const maxWeek = Math.max(...calendar.weeks.map((w) => w.week))
  const issues = [...courses.flatMap((c) => courseIssues(calendar, c)), ...globalIssues(calendar, courses)].filter((i) => i.severity !== 'info')

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-5">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-2xl font-bold">
          {shortDate(today)} {WEEKDAY_ZH[weekdayOf(today)]}
        </h1>
        {week ? <Badge color="var(--accent)">第 {week} 周 · {weekRangeLabel(calendar, week)}</Badge> : <Badge>不在教学周内</Badge>}
        {calendar.weeks.find((w) => w.week === week)?.reading && <Badge color="var(--ok)">Reading Week</Badge>}
        <span className="text-sm text-muted">{calendar.name}</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.35fr]">
        <Card title="今天" extra={<button className="text-sm text-accent" onClick={() => { set({ view: 'day' }); setPage('calendar') }}>打开日历 →</button>}>
          {todayItems.length ? (
            <ul className="space-y-1.5">
              {todayItems.map((it, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="w-24 shrink-0 whitespace-nowrap text-muted tabular-nums">{it.time ? `${it.time}${it.end ? '–' + it.end : ''}` : '未排时间'}</span>
                  {it.task ? (
                    <input type="checkbox" className="mt-1 size-3.5 shrink-0" style={{ accentColor: it.color }} checked={!!it.done} onChange={() => toggleTask(it.task!)} />
                  ) : (
                    <span className="mt-1.5 inline-block h-2.5 w-1 shrink-0 rounded" style={{ background: it.color }} />
                  )}
                  <span className={`min-w-0 flex-1 truncate ${it.done ? 'text-muted line-through' : ''}`} title={it.label}>
                    {it.label}
                    {it.sub && <span className="ml-2 text-xs text-muted">{it.sub}</span>}
                  </span>
                  <span className="shrink-0 text-xs text-muted">{it.kind}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>今天没有课，也没有待办</Empty>
          )}
          {vault.status !== 'ready' && (
            <p className="mt-3 text-xs text-muted">
              连接 Obsidian 后这里会一起显示 Daily Matter 里的待办。
              <button className="ml-1 text-accent underline" onClick={() => setPage('settings')}>去连接</button>
            </p>
          )}
        </Card>

        <Card title="接下来的截止" extra={<span className="text-xs text-muted">{upcoming.length} 项</span>}>
          <ul className="max-h-80 divide-y divide-line-soft overflow-y-auto">
            {upcoming.map(({ c, a, d }) => {
              const left = d.date ? diffDays(today, d.date) : undefined
              return (
                <li key={a.id} className="flex items-center gap-3 py-1.5 text-sm">
                  <span className={`w-14 shrink-0 text-right tabular-nums ${left !== undefined && left <= 7 ? 'font-bold text-danger' : 'text-muted'}`}>
                    {left === undefined ? 'TBA' : left === 0 ? '今天' : `${left} 天`}
                  </span>
                  <span className="w-24 shrink-0 text-muted tabular-nums">
                    {d.date ? `${shortDate(d.date)} ${WEEKDAY_ZH[weekdayOf(d.date)]}` : '—'}
                    {d.confidence === 'inferred' && <span title="只写了周次，日期为推算"> *</span>}
                  </span>
                  <COURSE_DOT color={c.color} />
                  <span className="w-16 shrink-0 font-bold" style={{ color: c.color }}>{c.short}</span>
                  <span className={`min-w-0 flex-1 truncate ${a.status === 'done' ? 'text-muted line-through' : ''}`} title={a.name.zh}>{a.name.zh || a.name.en}</span>
                  <Badge>{TYPE_LABEL[a.type].zh}</Badge>
                  <span className="w-10 text-right tabular-nums">{a.weight}%</span>
                  <select className="field py-0 text-xs" value={a.status} onChange={(e) => setAssessment(c.code, a.id, { status: e.target.value as AssessmentStatus })}>
                    {(['todo', 'doing', 'done'] as const).map((s) => <option key={s} value={s}>{STATUS_LABEL[s].zh}</option>)}
                  </select>
                </li>
              )
            })}
          </ul>
          <p className="mt-2 text-xs text-muted">* 表示 STP 只写了周次，日期按校历和你的课表推算。</p>
        </Card>
      </div>

      <Card title="每周负荷热力图" extra={<span className="text-xs text-muted">格子里是当周截止的占比之和</span>}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-center text-xs">
            <thead>
              <tr>
                <th className="w-16" />
                {calendar.weeks.map((w) => (
                  <th key={w.week} className={`px-0.5 pb-1 font-normal ${w.week === week ? 'font-bold text-today' : 'text-muted'}`}>W{w.week}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {courses.map((c) => (
                <tr key={c.code}>
                  <td className="pr-2 text-left font-bold whitespace-nowrap" style={{ color: c.color }}>{c.short}</td>
                  {calendar.weeks.map((w) => {
                    const v = load[w.week]?.[c.code] ?? 0
                    return (
                      <td key={w.week} className="p-0.5">
                        <div
                          className="flex h-7 items-center justify-center rounded"
                          style={{ background: v ? `color-mix(in srgb, ${c.color} ${Math.min(100, 15 + v * 2.5)}%, transparent)` : w.reading ? 'var(--line-soft)' : 'var(--panel-2)', color: v >= 20 ? '#fff' : undefined }}
                          title={`${c.short} 第 ${w.week} 周：${v}%`}
                        >
                          {v ? v : ''}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
              <tr>
                <td className="pr-2 text-left text-muted">合计</td>
                {Array.from({ length: maxWeek }, (_, i) => i + 1).map((wk) => {
                  const t = Object.values(load[wk] ?? {}).reduce((s, v) => s + v, 0)
                  return <td key={wk} className={`pt-1 tabular-nums ${t >= 30 ? 'font-bold text-danger' : 'text-muted'}`}>{t || ''}</td>
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="本周各课主题">
          <ul className="space-y-2 text-sm">
            {courses.map((c) => {
              const row = c.weekly.find((r) => r.week === week)
              return (
                <li key={c.code} className="flex gap-2">
                  <span className="w-16 shrink-0 font-bold" style={{ color: c.color }}>{c.short}</span>
                  <span className="min-w-0">
                    {row ? row.topic.zh || row.topic.en : <span className="text-muted">—</span>}
                    {row?.chapters && <span className="ml-1 text-muted">{row.chapters}</span>}
                    {row?.events && <div className="text-xs text-accent">{row.events.zh || row.events.en}</div>}
                  </span>
                </li>
              )
            })}
          </ul>
        </Card>
        <Card title="需要注意" extra={<span className="text-xs text-muted">{issues.length} 条</span>}>
          <ul className="max-h-72 space-y-1.5 overflow-y-auto text-sm">
            {issues.map((i, k) => (
              <li key={k} className="flex gap-2">
                <span className={i.severity === 'error' ? 'text-danger' : 'text-warn'}>{i.severity === 'error' ? '●' : '▲'}</span>
                <button className="w-16 shrink-0 text-left font-bold hover:underline" onClick={() => { if (i.course !== '全部') { set({ activeCourse: i.course }); setPage('courses') } }}>
                  {courses.find((c) => c.code === i.course)?.short ?? i.course}
                </button>
                <span>{i.message}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  )
}
