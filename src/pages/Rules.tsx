import { Button, Card, Check, Num } from '../components/ui'
import { WEEKDAY_ZH } from '../lib/dates'
import { useSuggestions } from '../lib/events'
import { KIND_LABEL, type BlockRule, type PlannerRules, type TaskKind } from '../lib/scheduler'
import { useStore } from '../store'
import type { Weekday } from '../types'

export default function Rules() {
  const { rules: r, setRules, courses, setPage, set, dismissed, restoreDismissed, adopted } = useStore()
  const { suggestions, unplaced } = useSuggestions()
  const up = <K extends keyof PlannerRules>(k: K, v: Partial<PlannerRules[K]> | PlannerRules[K]) =>
    setRules((x) => ({ ...x, [k]: typeof v === 'object' && !Array.isArray(v) && v !== null ? { ...(x[k] as object), ...v } : v }))
  const allOn = r.preview.on && r.review.on && r.assignment.on && r.group.on && r.exam.on && r.inclass.on
  const setAll = (on: boolean) =>
    setRules((x) => ({
      ...x,
      preview: { ...x.preview, on }, review: { ...x.review, on }, assignment: { ...x.assignment, on },
      group: { ...x.group, on }, exam: { ...x.exam, on }, inclass: { ...x.inclass, on },
    }))

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-3 sm:p-5">
      <Card title="常规设置" extra={<span className="text-xs text-muted">可以全部勾选</span>}>
        <div className="space-y-3 text-sm">
          <Row on={r.preview.on} onToggle={(on) => up('preview', { on })}>
            每节课<b>课前预习</b>：上课前
            <Num value={r.preview.daysBefore} min={0} max={3} onChange={(daysBefore) => up('preview', { daysBefore })} className="w-12" />
            天，每次
            <Num value={r.preview.minutes} min={10} max={180} step={5} onChange={(minutes) => up('preview', { minutes })} />
            分钟
            <Check checked={r.preview.perSession} onChange={(perSession) => up('preview', { perSession })} label={<span className="text-muted">每次课都排（否则每周一次）</span>} />
          </Row>
          <Row on={r.review.on} onToggle={(on) => up('review', { on })}>
            每节课<b>课后复习</b>：
            <select className="field" value={r.review.nextDay ? '1' : '0'} onChange={(e) => up('review', { nextDay: e.target.value === '1' })}>
              <option value="0">当天</option>
              <option value="1">第二天</option>
            </select>
            ，每次
            <Num value={r.review.minutes} min={10} max={180} step={5} onChange={(minutes) => up('review', { minutes })} />
            分钟
            <Check checked={r.review.perSession} onChange={(perSession) => up('review', { perSession })} label={<span className="text-muted">每次课都排</span>} />
          </Row>
          <Row on={r.assignment.on} onToggle={(on) => up('assignment', { on })}>
            提前
            <Num value={r.assignment.daysEarly} min={0} max={14} onChange={(daysEarly) => up('assignment', { daysEarly })} className="w-12" />
            天完成 <b>Individual Assignment</b>
            <span className="text-muted">（从发布周开始倒排，占比越高拆得越多）</span>
          </Row>
          <Row on={r.group.on} onToggle={(on) => up('group', { on })}>
            <span className="flex w-full flex-wrap items-center gap-2">
              从第
              <input
                className="field w-12 text-center"
                placeholder="自动"
                value={r.group.fromWeek ?? ''}
                onChange={(e) => up('group', { fromWeek: e.target.value ? Number(e.target.value) : null })}
              />
              周开始准备<b>小组作业</b>，每周一次
              <Num value={r.group.minutes} min={30} max={240} step={15} onChange={(minutes) => up('group', { minutes })} />
              分钟
            </span>
            <span className="ml-6 flex w-full flex-wrap items-center gap-2">
              小组作业相关 DDL：至少提前
              <Num value={r.group.discussDaysBefore} min={1} max={60} onChange={(discussDaysBefore) => up('group', { discussDaysBefore })} className="w-12" />
              天<b>开始讨论</b>，提前
              <Num value={r.group.submitDaysEarly} min={0} max={14} onChange={(submitDaysEarly) => up('group', { submitDaysEarly })} className="w-12" />
              天<b>在 iSpace 提交</b>
            </span>
            <span className="ml-6 text-xs text-muted">"从第几周开始"留空时，就从"提前 N 天开始讨论"那天开始；课内展示不需要提交，只排讨论。</span>
          </Row>
          <Row on={r.inclass.on} onToggle={(on) => up('inclass', { on })}>
            如有 <b>in-class assignment</b>（课堂测验、开卷作业、展示），至少提前
            <Num value={r.inclass.daysBefore} min={1} max={21} onChange={(daysBefore) => up('inclass', { daysBefore })} className="w-12" />
            天<b>复习 / 整理资料</b>
            <span className="text-muted">（展示的最后一次改为排练）</span>
          </Row>
          <Row on={r.exam.on} onToggle={(on) => up('exam', { on })}>
            从第
            <Num value={r.exam.fromWeek} min={1} max={16} onChange={(fromWeek) => up('exam', { fromWeek })} className="w-12" />
            周开始<b>期末复习</b>
            <span className="text-muted">（按期末占比分配，没有期末考试的课自动跳过）</span>
          </Row>
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-accent/40 bg-[color-mix(in_srgb,var(--accent)_7%,var(--panel))] px-3 py-3 sm:gap-4 sm:px-4">
        <span className="text-2xl">🤖</span>
        <div className="flex-1 text-sm">
          <b>小助手：</b>不知道怎么选？建议「常规设置」全部勾选，对自己的学习负责哦！加油 :)
        </div>
        <Button kind="primary" onClick={() => setAll(!allOn)}>{allOn ? '全部取消' : '一键全部勾选'}</Button>
      </div>

      <Card title="个人设置">
        <div className="space-y-4 text-sm">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span>不排学习内容的日子</span>
              <Button kind="ghost" className="text-xs" onClick={() => up('blocks', [...r.blocks, { weekday: 6, kind: 'any', course: 'all' }])}>＋ 添加一条</Button>
            </div>
            <div className="space-y-1.5">
              {r.blocks.map((b, i) => {
                const setB = (p: Partial<BlockRule>) => up('blocks', r.blocks.map((x, j) => (j === i ? { ...x, ...p } : x)))
                return (
                  <div key={i} className="flex flex-wrap items-center gap-2">
                    每周的
                    <select className="field" value={b.weekday} onChange={(e) => setB({ weekday: Number(e.target.value) as Weekday })}>
                      {[1, 2, 3, 4, 5, 6, 7].map((d) => <option key={d} value={d}>{WEEKDAY_ZH[d]}</option>)}
                    </select>
                    不排
                    <select className="field" value={b.course} onChange={(e) => setB({ course: e.target.value })}>
                      <option value="all">所有课</option>
                      {courses.map((c) => <option key={c.code} value={c.code}>{c.short}</option>)}
                    </select>
                    的
                    <select className="field" value={b.kind} onChange={(e) => setB({ kind: e.target.value as TaskKind | 'any' })}>
                      <option value="any">任何学习内容</option>
                      {(Object.keys(KIND_LABEL) as TaskKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
                    </select>
                    <Button kind="ghost" className="text-muted" onClick={() => up('blocks', r.blocks.filter((_, j) => j !== i))}>✕</Button>
                  </div>
                )
              })}
              {!r.blocks.length && <p className="text-muted">暂无。例如「每周的周六不排所有课的任何学习内容」。</p>}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-2">每天学习上限 <Num value={r.dailyCapMinutes} min={30} max={600} step={30} onChange={(v) => up('dailyCapMinutes', v)} className="w-16" /> 分钟</label>
            <label className="flex items-center gap-2">上课前后留 <Num value={r.bufferMinutes} min={0} max={60} step={5} onChange={(v) => up('bufferMinutes', v)} /> 分钟空档</label>
            <label className="flex items-center gap-2">
              可排时段
              <input type="time" className="field" value={r.dayStart} onChange={(e) => up('dayStart', e.target.value)} />–
              <input type="time" className="field" value={r.dayEnd} onChange={(e) => up('dayEnd', e.target.value)} />
            </label>
            <label className="flex items-center gap-2">
              优先从
              <input type="time" className="field" value={r.preferredStart} onChange={(e) => up('preferredStart', e.target.value)} />
              开始排
            </label>
          </div>

          <div>
            <div className="mb-1">课程难度（放大预习、复习时长）</div>
            <div className="flex flex-wrap gap-3">
              {courses.map((c) => (
                <label key={c.code} className="flex items-center gap-1.5">
                  <span className="font-bold" style={{ color: c.color }}>{c.short}</span>
                  <select className="field" value={r.courseFactor[c.code] ?? 1} onChange={(e) => up('courseFactor', { ...r.courseFactor, [c.code]: Number(e.target.value) })}>
                    <option value={0.5}>×0.5</option>
                    <option value={1}>×1</option>
                    <option value={1.5}>×1.5</option>
                    <option value={2}>×2</option>
                  </select>
                </label>
              ))}
            </div>
          </div>
          <p className="text-xs text-muted">排程时会自动避开上课时间和 Obsidian 里已有的时间块。</p>
        </div>
      </Card>

      <Card title="排程结果">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span>生成了 <b>{suggestions.length}</b> 个建议学习块</span>
          <span className={unplaced.length ? 'text-warn' : 'text-muted'}><b>{unplaced.length}</b> 个放不下</span>
          <span className="text-muted">已采纳 {adopted.length} · 已忽略 {dismissed.length}</span>
          {dismissed.length > 0 && <Button kind="ghost" className="text-xs" onClick={restoreDismissed}>恢复已忽略的建议</Button>}
          <div className="flex-1" />
          <Button kind="primary" onClick={() => { set({ view: 'week' }); setPage('calendar') }}>在日历里查看 →</Button>
        </div>
        {unplaced.length > 0 && (
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-muted">放不下的任务（候选日期里时间都排满了。可以调高每天上限、放宽可排时段，或者减少勾选项）</summary>
            <ul className="mt-2 columns-2 gap-6 text-xs">
              {unplaced.map((u) => <li key={u.id} className="break-inside-avoid py-0.5">{u.title}</li>)}
            </ul>
          </details>
        )}
      </Card>
    </div>
  )
}

function Row({ on, onToggle, children }: { on: boolean; onToggle: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <div className={`flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 ${on ? 'border-accent/40 bg-[color-mix(in_srgb,var(--accent)_5%,var(--panel))]' : 'border-line-soft'}`}>
      <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={on} onChange={(e) => onToggle(e.target.checked)} />
      {children}
    </div>
  )
}
