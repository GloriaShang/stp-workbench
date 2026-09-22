import { useEffect, useMemo, useRef, useState, type PointerEvent as RPE } from 'react'
import { Badge, Button, Check, Segmented } from '../components/ui'
import { addDays, fromISO, hhmm, minutes, mondayOf, teachingWeekOf, todayISO, WEEKDAY_ZH, weekdayOf } from '../lib/dates'
import { buildEvents, useSuggestions, type CalEvent } from '../lib/events'
import { STATUS_LABEL } from '../lib/i18n'
import { useStore, type CalView } from '../store'
import { useVault } from '../vault'
import type { AssessmentStatus } from '../types'

const START_H = 7
const END_H = 24
const HOUR = 52
const SNAP = 10
const px = (min: number) => ((min - START_H * 60) / 60) * HOUR
const toMin = (y: number) => Math.round((y / HOUR) * 60 / SNAP) * SNAP + START_H * 60
const clampMin = (m: number) => Math.max(START_H * 60, Math.min(END_H * 60, m))

function datesFor(view: CalView, anchor: string) {
  if (view === 'day') return [anchor]
  if (view === '3day') return [anchor, addDays(anchor, 1), addDays(anchor, 2)]
  if (view === 'week') {
    const m = mondayOf(anchor)
    return Array.from({ length: 7 }, (_, i) => addDays(m, i))
  }
  const first = anchor.slice(0, 8) + '01'
  const m = mondayOf(first)
  return Array.from({ length: 42 }, (_, i) => addDays(m, i))
}

/** 块的最小显示高度对应的分钟数；10 分钟的待办也画成这么高，排列时按这个高度算重叠 */
const MIN_VISUAL = 22
const visEnd = (e: CalEvent) => Math.max(minutes(e.end!), minutes(e.start!) + MIN_VISUAL)

/** 同一天内重叠事件分列 */
function layout(evs: CalEvent[]) {
  const sorted = [...evs].sort((a, b) => minutes(a.start!) - minutes(b.start!) || visEnd(b) - visEnd(a))
  const out: { ev: CalEvent; col: number; cols: number }[] = []
  let cluster: { ev: CalEvent; col: number }[] = []
  let clusterEnd = -1
  const flush = () => {
    const n = Math.max(1, ...cluster.map((c) => c.col + 1))
    cluster.forEach((c) => out.push({ ...c, cols: n }))
    cluster = []
  }
  for (const ev of sorted) {
    const s = minutes(ev.start!)
    if (s >= clusterEnd) {
      flush()
      clusterEnd = -1
    }
    const used = new Set(cluster.filter((c) => visEnd(c.ev) > s).map((c) => c.col))
    let col = 0
    while (used.has(col)) col++
    cluster.push({ ev, col })
    clusterEnd = Math.max(clusterEnd, visEnd(ev))
  }
  flush()
  return out
}

interface Drag {
  ev: CalEvent
  mode: 'move' | 'resize'
  x0: number
  y0: number
  s0: number
  e0: number
  d0: number
  s: number
  e: number
  d: number
  moved: boolean
}

export default function CalendarPage() {
  const { calendar, courses, view, layers, set, markAdopted, dismiss, setAssessment } = useStore()
  const vault = useVault()
  const { suggestions } = useSuggestions()
  const [anchor, setAnchor] = useState(todayISO())
  const dates = useMemo(() => datesFor(view, anchor), [view, anchor])
  const [pop, setPop] = useState<{ ev: CalEvent; x: number; y: number } | null>(null)
  const [quick, setQuick] = useState<{ date: string; start: number } | null>(null)
  const [toast, setToast] = useState('')

  // 读取并轮询可见日期的 Obsidian 文件（在 Obsidian 里改动后几秒内同步过来）
  const dateKey = dates.join(',')
  useEffect(() => {
    vault.load(dates)
    const t = setInterval(() => document.visibilityState === 'visible' && useVault.getState().load(dates), 4000)
    const onFocus = () => useVault.getState().load(dates)
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(t)
      window.removeEventListener('focus', onFocus)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey, vault.status])

  const events = useMemo(
    () => buildEvents(calendar, courses, dates, vault.days, suggestions, layers),
    [calendar, courses, dates, vault.days, suggestions, layers],
  )

  const step = view === 'month' ? 0 : view === 'week' ? 7 : view === '3day' ? 3 : 1
  const go = (dir: number) => {
    if (view === 'month') {
      const d = fromISO(anchor)
      d.setMonth(d.getMonth() + dir, 1)
      setAnchor(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`)
    } else setAnchor(addDays(anchor, dir * step))
  }

  const ready = vault.status === 'ready'
  const flash = (m: string) => {
    setToast(m)
    setTimeout(() => setToast(''), 3000)
  }
  const needVault = () => flash('先到「设置」连接 Obsidian vault，才能写入日程')

  const visibleSug = events.filter((e) => e.kind === 'suggestion')
  async function adoptAll() {
    if (!ready) return needVault()
    const byDate = new Map<string, CalEvent[]>()
    visibleSug.forEach((e) => byDate.set(e.date, [...(byDate.get(e.date) ?? []), e]))
    for (const [d, list] of byDate) await vault.add(d, list.map((e) => ({ start: e.start!, end: e.end!, text: e.title })))
    markAdopted(visibleSug.map((e) => e.suggestion!.id))
    flash(`已写入 ${visibleSug.length} 个学习块到 Obsidian`)
  }

  const mid = dates[Math.floor(dates.length / 2)]
  const wk = teachingWeekOf(calendar, view === 'month' ? addDays(dates[0], 14) : mid)
  const title = view === 'month' ? `${fromISO(anchor).getFullYear()} 年 ${fromISO(anchor).getMonth() + 1} 月` : `${fromISO(mid).getFullYear()} 年 ${fromISO(mid).getMonth() + 1} 月`

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-panel px-4 py-2">
        <Button kind="ghost" onClick={() => go(-1)} aria-label="上一页">‹</Button>
        <Button onClick={() => setAnchor(todayISO())}>今天</Button>
        <Button kind="ghost" onClick={() => go(1)} aria-label="下一页">›</Button>
        <div className="ml-1 text-lg font-bold">{title}</div>
        {wk && <Badge color="var(--accent)">第 {wk} 周</Badge>}
        <div className="flex-1" />
        <Segmented<CalView>
          value={view}
          onChange={(v) => set({ view: v })}
          options={[{ v: 'day', label: '日' }, { v: '3day', label: '3 天' }, { v: 'week', label: '周' }, { v: 'month', label: '月' }]}
        />
      </div>
      <div className="flex flex-wrap items-center gap-4 border-b border-line bg-panel-2 px-4 py-1.5 text-sm">
        <Check checked={layers.classes} onChange={(v) => set({ layers: { ...layers, classes: v } })} label="上课" />
        <Check checked={layers.deadlines} onChange={(v) => set({ layers: { ...layers, deadlines: v } })} label="截止" />
        <Check checked={layers.obsidian} onChange={(v) => set({ layers: { ...layers, obsidian: v } })} label="Obsidian 待办" />
        <Check checked={layers.suggestions} onChange={(v) => set({ layers: { ...layers, suggestions: v } })} label="建议学习块" />
        <div className="flex-1" />
        <VaultPill />
        {view !== 'month' && visibleSug.length > 0 && (
          <Button kind="primary" onClick={adoptAll} disabled={vault.busy}>
            采纳可见的 {visibleSug.length} 个建议
          </Button>
        )}
      </div>

      {view === 'month' ? (
        <MonthGrid dates={dates} anchor={anchor} events={events} onPick={(d) => { setAnchor(d); set({ view: 'day' }) }} />
      ) : (
        <TimeGrid
          dates={dates}
          events={events}
          onEventClick={(ev, x, y) => setPop({ ev, x, y })}
          onEmptyClick={(date, start) => (ready ? setQuick({ date, start }) : needVault())}
          onCommit={async (d) => {
            const date = dates[d.d]
            const s = hhmm(d.s)
            const e = hhmm(d.e)
            if (d.ev.kind === 'obsidian') {
              if (d.mode === 'resize') await vault.update(d.ev.task!, { end: e })
              else await vault.move(d.ev.task!, date, s, e)
            } else if (d.ev.kind === 'suggestion') {
              if (!ready) return needVault()
              await vault.add(date, [{ start: s, end: e, text: d.ev.title }])
              markAdopted([d.ev.suggestion!.id])
              flash('已采纳并写入 Obsidian')
            }
          }}
          onToggle={(t) => vault.toggle(t)}
          quick={quick}
          onQuickDone={async (text) => {
            if (quick && text.trim()) await vault.add(quick.date, [{ start: hhmm(quick.start), end: hhmm(quick.start + 30), text: text.trim() }])
            setQuick(null)
          }}
        />
      )}

      {pop && (
        <Popover
          {...pop}
          onClose={() => setPop(null)}
          onAdopt={async () => {
            if (!ready) return needVault()
            const e = pop.ev
            await vault.add(e.date, [{ start: e.start!, end: e.end!, text: e.title }])
            markAdopted([e.suggestion!.id])
            setPop(null)
          }}
          onDismiss={() => {
            dismiss(pop.ev.suggestion!.id)
            setPop(null)
          }}
          onStatus={(s) => {
            const [, code, id] = pop.ev.id.split(':')
            setAssessment(code, id, { status: s })
            setPop(null)
          }}
        />
      )}
      {(toast || vault.error) && (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-md bg-ink px-4 py-2 text-sm text-bg shadow-lg" onClick={() => vault.clearError()}>
          {vault.error ?? toast}
        </div>
      )}
    </div>
  )
}

function VaultPill() {
  const { status, reauthorize } = useVault()
  const setPage = useStore((s) => s.setPage)
  if (status === 'ready') return <span className="text-xs text-ok">● Obsidian 已同步</span>
  if (status === 'needs-permission')
    return (
      <Button onClick={reauthorize} className="text-xs">
        重新授权 Obsidian
      </Button>
    )
  return (
    <button className="text-xs text-muted underline" onClick={() => setPage('settings')}>
      {status === 'unsupported' ? '当前浏览器不支持连接 Obsidian（请用 Chrome）' : status === 'no-daily-dir' ? '找不到 Daily Matter 文件夹' : '未连接 Obsidian'}
    </button>
  )
}

// ───────────────────────── 时间轴视图 ─────────────────────────

function TimeGrid(p: {
  dates: string[]
  events: CalEvent[]
  onEventClick: (ev: CalEvent, x: number, y: number) => void
  onEmptyClick: (date: string, start: number) => void
  onCommit: (d: Drag) => void
  onToggle: (t: NonNullable<CalEvent['task']>) => void
  quick: { date: string; start: number } | null
  onQuickDone: (text: string) => void
}) {
  const { dates, events } = p
  const calendar = useStore((s) => s.calendar)
  const scroller = useRef<HTMLDivElement>(null)
  const cols = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [now, setNow] = useState(new Date())
  const today = todayISO()

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])
  useEffect(() => {
    // 打开时滚到当前时间附近
    const m = now.getHours() * 60 + now.getMinutes()
    scroller.current?.scrollTo({ top: Math.max(0, px(m) - 160) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const timed = events.filter((e) => e.start && e.end && e.kind !== 'deadline' && e.kind !== 'banner')
  const allDay = events.filter((e) => !(e.start && e.end && e.kind !== 'deadline' && e.kind !== 'banner'))

  function startDrag(e: RPE, ev: CalEvent, mode: Drag['mode']) {
    if (ev.kind !== 'obsidian' && ev.kind !== 'suggestion') return
    e.stopPropagation()
    const s = minutes(ev.start!)
    const en = minutes(ev.end!)
    const d = dates.indexOf(ev.date)
    const st: Drag = { ev, mode, x0: e.clientX, y0: e.clientY, s0: s, e0: en, d0: d, s, e: en, d, moved: false }
    setDrag(st)
    let cur = st
    const move = (m: PointerEvent) => {
      const dy = m.clientY - st.y0
      const dx = m.clientX - st.x0
      const dm = Math.round((dy / HOUR) * 60 / SNAP) * SNAP
      const colW = (cols.current?.clientWidth ?? 1) / dates.length
      const dd = Math.round(dx / colW)
      const moved = st.moved || Math.abs(dx) > 3 || Math.abs(dy) > 3
      if (mode === 'resize') cur = { ...st, e: clampMin(Math.max(st.s0 + SNAP, st.e0 + dm)), moved }
      else {
        const len = st.e0 - st.s0
        const s2 = clampMin(Math.min(END_H * 60 - len, st.s0 + dm))
        cur = { ...st, s: s2, e: s2 + len, d: Math.max(0, Math.min(dates.length - 1, st.d0 + dd)), moved }
      }
      setDrag(cur)
    }
    const up = (u: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      setDrag(null)
      if (!cur.moved) p.onEventClick(ev, u.clientX, u.clientY)
      else if (cur.s !== st.s0 || cur.e !== st.e0 || cur.d !== st.d0) p.onCommit(cur)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const gridH = (END_H - START_H) * HOUR
  const colTemplate = { gridTemplateColumns: `repeat(${dates.length}, minmax(0, 1fr))` }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-panel">
      {/* 表头：星期 + 日期 */}
      <div className="flex border-b border-line">
        <div className="w-14 shrink-0" />
        <div className="grid flex-1" style={colTemplate}>
          {dates.map((d) => {
            const isToday = d === today
            return (
              <div key={d} className="flex flex-col items-center py-1.5">
                <span className="text-xs text-muted">{WEEKDAY_ZH[weekdayOf(d)]}</span>
                <span className={`mt-0.5 rounded-md px-3 py-0.5 text-lg ${isToday ? 'bg-today text-white' : ''}`}>{fromISO(d).getDate()}</span>
              </div>
            )
          })}
        </div>
      </div>
      {/* 全天栏 */}
      <div className="flex border-b border-line">
        <div className="flex w-14 shrink-0 items-start justify-center pt-1 text-xs text-muted">
          W{teachingWeekOf(calendar, dates[0]) ?? '–'}
        </div>
        <div className="grid max-h-36 flex-1 overflow-y-auto" style={colTemplate}>
          {dates.map((d) => {
            const list = allDay.filter((e) => e.date === d).sort((a, b) => kindOrder(a) - kindOrder(b))
            return (
              <div key={d} className="min-h-8 space-y-0.5 border-l border-line-soft p-0.5">
                {list.map((ev) => (
                  <AllDayChip key={ev.id} ev={ev} onClick={(x, y) => p.onEventClick(ev, x, y)} onToggle={p.onToggle} />
                ))}
              </div>
            )
          })}
        </div>
      </div>
      {/* 时间轴 */}
      <div ref={scroller} className="relative min-h-0 flex-1 overflow-y-auto">
        <div className="flex" style={{ height: gridH }}>
          <div className="relative w-14 shrink-0">
            {Array.from({ length: END_H - START_H }, (_, i) => (
              <div key={i} className="absolute right-2 -translate-y-2 text-sm font-bold text-muted" style={{ top: i * HOUR }}>
                {i === 0 ? '' : START_H + i}
              </div>
            ))}
          </div>
          <div ref={cols} className="relative grid flex-1" style={colTemplate}>
            {dates.map((d, di) => {
              const isToday = d === today
              const dayEvents = timed.filter((e) => e.date === d && !(drag && drag.ev.id === e.id))
              return (
                <div
                  key={d}
                  className={`relative border-l border-line-soft ${isToday ? 'bg-[color-mix(in_srgb,var(--today)_4%,transparent)]' : ''}`}
                  onPointerDown={(e) => {
                    if (e.target !== e.currentTarget) return
                    const r = e.currentTarget.getBoundingClientRect()
                    p.onEmptyClick(d, clampMin(toMin(e.clientY - r.top - HOUR / 4)))
                  }}
                >
                  {Array.from({ length: END_H - START_H }, (_, i) => (
                    <div key={i} className="pointer-events-none absolute inset-x-0 border-t border-line-soft" style={{ top: i * HOUR }}>
                      <div className="border-t border-dashed border-line-soft" style={{ marginTop: HOUR / 2 }} />
                    </div>
                  ))}
                  {layout(dayEvents).map(({ ev, col, cols: n }) => (
                    <EventBlock key={ev.id} ev={ev} col={col} cols={n} onPointerDown={startDrag} onOpen={p.onEventClick} onToggle={p.onToggle} />
                  ))}
                  {drag && drag.d === di && (
                    <EventBlock ev={{ ...drag.ev, start: hhmm(drag.s), end: hhmm(drag.e) }} col={0} cols={1} ghost onPointerDown={() => {}} onToggle={() => {}} />
                  )}
                  {p.quick && p.quick.date === d && <QuickAdd start={p.quick.start} onDone={p.onQuickDone} />}
                  {isToday && (
                    <div className="pointer-events-none absolute inset-x-0 z-20 flex items-center" style={{ top: px(now.getHours() * 60 + now.getMinutes()) }}>
                      <div className="-ml-1 size-2 rounded-full bg-danger" />
                      <div className="h-px flex-1 bg-danger" />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

const kindOrder = (e: CalEvent) => ({ banner: 0, deadline: 1, obsidian: 2, class: 3, suggestion: 4 })[e.kind]

function AllDayChip({ ev, onClick, onToggle }: { ev: CalEvent; onClick: (x: number, y: number) => void; onToggle: (t: NonNullable<CalEvent['task']>) => void }) {
  if (ev.kind === 'banner') {
    const c = ev.bannerKind === 'holiday' ? 'var(--ok)' : ev.bannerKind === 'exam' ? 'var(--danger)' : 'var(--muted)'
    return (
      <div className="truncate rounded px-1.5 text-xs" style={{ color: c, background: `color-mix(in srgb, ${c} 12%, transparent)` }}>
        {ev.title}
      </div>
    )
  }
  if (ev.kind === 'obsidian') {
    return (
      <div className="flex items-center gap-1 truncate rounded px-1 text-xs text-white" style={{ background: ev.color }}>
        <input type="checkbox" className="size-3" checked={!!ev.done} onChange={() => onToggle(ev.task!)} />
        <span className={`truncate ${ev.done ? 'line-through opacity-60' : ''}`} onClick={(e) => onClick(e.clientX, e.clientY)}>
          {ev.title}
        </span>
      </div>
    )
  }
  return (
    <button
      onClick={(e) => onClick(e.clientX, e.clientY)}
      className={`block w-full truncate rounded border-l-[3px] px-1 text-left text-xs ${ev.done ? 'line-through opacity-50' : ''}`}
      style={{ borderColor: ev.color, background: `color-mix(in srgb, ${ev.color} 12%, transparent)` }}
      title={ev.title}
    >
      <b>{ev.start ? `${ev.start} ` : ''}截止</b> {ev.title}
    </button>
  )
}

function EventBlock({ ev, col, cols, ghost, onPointerDown, onOpen, onToggle }: {
  ev: CalEvent
  col: number
  cols: number
  ghost?: boolean
  onPointerDown: (e: RPE, ev: CalEvent, mode: Drag['mode']) => void
  onOpen?: (ev: CalEvent, x: number, y: number) => void
  onToggle: (t: NonNullable<CalEvent['task']>) => void
}) {
  const s = minutes(ev.start!)
  const e = minutes(ev.end!)
  const top = px(Math.max(s, START_H * 60))
  const h = Math.max((MIN_VISUAL / 60) * HOUR - 1, px(Math.min(e, END_H * 60)) - top - 1)
  const draggable = ev.kind === 'obsidian' || ev.kind === 'suggestion'
  const style: React.CSSProperties = { top, height: h, left: `calc(${(col / cols) * 100}% + 2px)`, width: `calc(${100 / cols}% - 4px)` }
  const compact = h < 34
  // 一小时以内的块：标题只占一行，保证时间可见
  const oneLine = h < 60

  let cls = ''
  if (ev.kind === 'class') {
    Object.assign(style, { background: ev.color, color: '#fff' })
  } else if (ev.kind === 'obsidian') {
    Object.assign(style, { background: ev.color, color: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,.25)' })
  } else if (ev.kind === 'suggestion') {
    Object.assign(style, { borderColor: ev.color, color: 'var(--text)', background: `color-mix(in srgb, ${ev.color} 9%, var(--panel))` })
    cls = 'border border-dashed'
  }
  return (
    <div
      className={`absolute z-10 overflow-hidden rounded-md px-1.5 text-xs leading-tight select-none ${cls} ${draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${ghost ? 'z-30 opacity-80 ring-2 ring-today' : ''}`}
      style={style}
      onPointerDown={(pe) => {
        if (draggable) onPointerDown(pe, ev, 'move')
      }}
      onClick={(ce) => {
        // 上课块不可拖动，单击直接打开详情；可拖动的块由拖拽逻辑判断是否为单击
        if (!draggable) onOpen?.(ev, ce.clientX, ce.clientY)
      }}
      data-kind={ev.kind}
    >
      <div className={`flex items-start gap-1 ${compact ? '' : 'pt-0.5'}`}>
        {ev.kind === 'obsidian' && (
          <input
            type="checkbox"
            className="mt-px size-3 shrink-0"
            checked={!!ev.done}
            onPointerDown={(x) => x.stopPropagation()}
            onChange={() => onToggle(ev.task!)}
          />
        )}
        <span className={`min-w-0 font-bold ${ev.done ? 'line-through opacity-60' : ''} ${oneLine ? 'truncate' : ''}`} title={ev.title}>
          {ev.kind === 'suggestion' && '＋ '}
          {ev.title}
        </span>
      </div>
      {!compact && (
        <div className="truncate opacity-85">
          {ev.start}–{ev.end}
          {ev.sub ? ` · ${ev.sub}` : ''}
        </div>
      )}
      {draggable && !ghost && (
        <div className="absolute inset-x-0 bottom-0 h-1.5 cursor-ns-resize" onPointerDown={(pe) => onPointerDown(pe, ev, 'resize')} />
      )}
    </div>
  )
}

/** 点击空白处新建 Obsidian 待办 */
function QuickAdd({ start, onDone }: { start: number; onDone: (text: string) => void }) {
  const [text, setText] = useState('')
  // 回车保存后输入框卸载会再触发一次 blur，用 ref 保证只提交一次
  const sent = useRef(false)
  const finish = (t: string) => {
    if (sent.current) return
    sent.current = true
    onDone(t)
  }
  return (
    <div className="absolute inset-x-1 z-30 rounded-md border border-accent bg-panel p-1 shadow-lg" style={{ top: px(start) }}>
      <div className="mb-0.5 text-[11px] text-muted">
        {hhmm(start)}–{hhmm(start + 30)} 新建 Obsidian 待办（回车保存，Esc 取消）
      </div>
      <input
        autoFocus
        className="field w-full text-sm"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') finish(text)
          if (e.key === 'Escape') finish('')
        }}
        onBlur={() => finish(text)}
      />
    </div>
  )
}

// ───────────────────────── 弹窗 ─────────────────────────

function Popover({ ev, x, y, onClose, onAdopt, onDismiss, onStatus }: {
  ev: CalEvent
  x: number
  y: number
  onClose: () => void
  onAdopt: () => void
  onDismiss: () => void
  onStatus: (s: AssessmentStatus) => void
}) {
  const vault = useVault()
  const ref = useRef<HTMLDivElement>(null)
  const [text, setText] = useState(ev.task?.text ?? '')
  const [start, setStart] = useState(ev.start ?? '')
  const [end, setEnd] = useState(ev.end ?? '')
  const courses = useStore((s) => s.courses)
  const calendar = useStore((s) => s.calendar)

  useEffect(() => {
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && onClose()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    setTimeout(() => window.addEventListener('mousedown', onDown))
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const left = Math.min(x + 8, window.innerWidth - 340)
  const top = Math.min(y + 8, window.innerHeight - 300)
  const c = ev.course
  const assessment = ev.kind === 'deadline' ? courses.find((k) => k.code === c?.code)?.assessments.find((a) => a.id === ev.id.split(':')[2]) : undefined
  const week = teachingWeekOf(calendar, ev.date)
  const row = c?.weekly.find((r) => r.week === week)

  return (
    <div ref={ref} className="fixed z-50 w-80 rounded-lg border border-line bg-panel p-3 text-sm shadow-xl" style={{ left, top }}>
      <div className="mb-1 flex items-start gap-2">
        <span className="mt-1.5 inline-block size-2.5 shrink-0 rounded-full" style={{ background: ev.color }} />
        <div className="font-bold">{ev.kind === 'obsidian' ? 'Obsidian 待办' : ev.title}</div>
      </div>
      <div className="mb-2 text-xs text-muted">
        {ev.date} {WEEKDAY_ZH[weekdayOf(ev.date)]} {ev.start ? `${ev.start}${ev.end && ev.kind !== 'deadline' ? '–' + ev.end : ''}` : ''}
        {week ? ` · 第 ${week} 周` : ''}
      </div>

      {ev.kind === 'class' && c && (
        <div className="space-y-1">
          <div>{c.name.zh} <span className="text-muted">{c.name.en}</span></div>
          <div className="text-muted">{ev.sub}</div>
          {row?.activity && <div>课堂：{row.activity.zh || row.activity.en}</div>}
          {row?.homework && <div>练习：{row.homework.zh || row.homework.en}</div>}
          {row?.events && <div className="text-accent">本周：{row.events.zh || row.events.en}</div>}
        </div>
      )}

      {ev.kind === 'deadline' && assessment && (
        <div className="space-y-1.5">
          <div>{ev.sub}</div>
          {assessment.requirements && <div className="text-muted">{assessment.requirements.zh || assessment.requirements.en}</div>}
          <div className="flex items-center gap-2 pt-1">
            状态
            <select className="field" value={assessment.status} onChange={(e) => onStatus(e.target.value as AssessmentStatus)}>
              {(['todo', 'doing', 'done'] as const).map((s) => (
                <option key={s} value={s}>{STATUS_LABEL[s].zh}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {ev.kind === 'suggestion' && (
        <div className="space-y-2">
          <div className="text-muted">排程器生成的建议。采纳后会写进这天的 Daily Matter；也可以直接拖到别的时间再松手。</div>
          <div className="flex gap-2">
            <Button kind="primary" onClick={onAdopt}>采纳到 Obsidian</Button>
            <Button onClick={onDismiss}>忽略</Button>
          </div>
        </div>
      )}

      {ev.kind === 'obsidian' && ev.task && (
        <div className="space-y-2">
          <textarea className="field w-full" rows={2} value={text} onChange={(e) => setText(e.target.value)} />
          <div className="flex items-center gap-2">
            <input type="time" className="field" value={start} onChange={(e) => setStart(e.target.value)} />–
            <input type="time" className="field" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button kind="primary" onClick={async () => { await vault.update(ev.task!, { text, start: start || undefined, end: end || undefined }); onClose() }}>保存</Button>
            <Button onClick={async () => { await vault.toggle(ev.task!); onClose() }}>{ev.done ? '标为未完成' : '完成'}</Button>
            <Button kind="danger" onClick={async () => { if (confirm('从 Obsidian 删除这条待办？')) { await vault.remove(ev.task!); onClose() } }}>删除</Button>
          </div>
          <div className="text-[11px] text-muted">{ev.date}.md 第 {ev.task.line + 1} 行</div>
        </div>
      )}
    </div>
  )
}

// ───────────────────────── 月视图 ─────────────────────────

function MonthGrid({ dates, anchor, events, onPick }: { dates: string[]; anchor: string; events: CalEvent[]; onPick: (d: string) => void }) {
  const month = anchor.slice(0, 7)
  const today = todayISO()
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-panel">
      <div className="grid grid-cols-7 border-b border-line text-center text-xs text-muted">
        {[1, 2, 3, 4, 5, 6, 7].map((d) => <div key={d} className="py-1.5">{WEEKDAY_ZH[d]}</div>)}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-6">
        {dates.map((d) => {
          const list = events.filter((e) => e.date === d)
          const banners = list.filter((e) => e.kind === 'banner')
          const deadlines = list.filter((e) => e.kind === 'deadline')
          const classes = list.filter((e) => e.kind === 'class').length
          const obs = list.filter((e) => e.kind === 'obsidian')
          const sug = list.filter((e) => e.kind === 'suggestion').length
          return (
            <button key={d} onClick={() => onPick(d)} className={`flex min-h-0 flex-col gap-0.5 overflow-hidden border-b border-l border-line-soft p-1 text-left hover:bg-panel-2 ${d.slice(0, 7) !== month ? 'opacity-40' : ''}`}>
              <span className={`self-start rounded px-1.5 text-sm ${d === today ? 'bg-today text-white' : ''}`}>{fromISO(d).getDate()}</span>
              {banners.map((b) => (
                <span key={b.id} className="truncate text-[11px]" style={{ color: b.bannerKind === 'holiday' ? 'var(--ok)' : b.bannerKind === 'exam' ? 'var(--danger)' : 'var(--muted)' }}>{b.title}</span>
              ))}
              {deadlines.map((e) => (
                <span key={e.id} className={`truncate rounded border-l-2 px-1 text-[11px] ${e.done ? 'line-through opacity-50' : ''}`} style={{ borderColor: e.color, background: `color-mix(in srgb, ${e.color} 12%, transparent)` }}>{e.title}</span>
              ))}
              <span className="mt-auto flex flex-wrap gap-x-2 text-[11px] text-muted">
                {classes > 0 && <span>{classes} 节课</span>}
                {obs.length > 0 && <span>待办 {obs.filter((o) => o.done).length}/{obs.length}</span>}
                {sug > 0 && <span>建议 {sug}</span>}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
