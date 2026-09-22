import { useState } from 'react'
import { Button, Card, Check, Segmented } from '../components/ui'
import { resolveDue, WEEKDAY_ZH, WEEKDAY_EN, weekdayOf, weekRangeLabel } from '../lib/dates'
import { FONT_EN, FONT_ZH, TYPE_COLOR, type ExportPrefs } from '../lib/exportPrefs'
import { hx, tx, TYPE_LABEL, STATUS_LABEL, type Lang } from '../lib/i18n'
import { CVD_THEME, deriveTheme, mix, THEMES, type Theme } from '../lib/themes'
import { isLeaf } from '../lib/validate'
import { useStore } from '../store'

export const themeOf = (p: ExportPrefs): Theme =>
  p.themeId === 'custom' ? deriveTheme(p.customColor) : p.themeId === 'cvd' ? CVD_THEME : THEMES.find((t) => t.id === p.themeId) ?? THEMES[0]

export default function Export() {
  const { exportPrefs: p, setExportPrefs: setP, calendar, courses } = useStore()
  const [busy, setBusy] = useState(false)
  const theme = themeOf(p)

  return (
    <div className="mx-auto grid max-w-7xl gap-4 p-5 lg:grid-cols-[22rem_1fr]">
      <div className="space-y-4">
        <Card title="语言">
          <Segmented<Lang> value={p.lang} onChange={(lang) => setP({ lang })} options={[{ v: 'zh', label: '中文' }, { v: 'en', label: 'English' }, { v: 'bi', label: '中英双语' }]} />
          <p className="mt-2 text-xs text-muted">课程代码、老师姓名、教材名始终保留原文。</p>
        </Card>
        <Card title="字体">
          <div className="grid grid-cols-[4rem_1fr] items-center gap-2 text-sm">
            <span className="text-muted">中文</span>
            <select className="field" value={p.fontZh} onChange={(e) => setP({ fontZh: e.target.value })}>
              {FONT_ZH.map((f) => <option key={f.v} value={f.v}>{f.label}</option>)}
            </select>
            <span className="text-muted">英文</span>
            <select className="field" value={p.fontEn} onChange={(e) => setP({ fontEn: e.target.value })}>
              {FONT_EN.map((f) => <option key={f}>{f}</option>)}
            </select>
            <span className="text-muted">字号</span>
            <Segmented value={p.density} onChange={(density) => setP({ density })} options={[{ v: 'compact', label: '紧凑' }, { v: 'standard', label: '标准' }, { v: 'loose', label: '宽松' }]} />
          </div>
          <p className="mt-2 text-xs text-muted">中文和英文分别套用各自的字体。xlsx 不内嵌字体，对方电脑没装时会显示成默认字体。</p>
        </Card>
        <Card title="主题色">
          <div className="grid grid-cols-3 gap-2">
            {[...THEMES, CVD_THEME].map((t) => (
              <button
                key={t.id}
                onClick={() => setP({ themeId: t.id })}
                className={`rounded-md border p-1.5 text-left text-xs ${p.themeId === t.id ? 'border-accent ring-2 ring-accent/30' : 'border-line'}`}
              >
                <div className="mb-1 flex h-4 overflow-hidden rounded">
                  <span className="flex-[3]" style={{ background: t.primary }} />
                  <span className="flex-1" style={{ background: t.accent }} />
                  <span className="flex-1" style={{ background: t.soft }} />
                </div>
                {t.name}
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2 text-sm">
            <button onClick={() => setP({ themeId: 'custom' })} className={`rounded-md border px-2 py-1 ${p.themeId === 'custom' ? 'border-accent' : 'border-line'}`}>自定义主色</button>
            <input type="color" value={p.customColor} onChange={(e) => setP({ customColor: e.target.value, themeId: 'custom' })} className="h-8 w-10 cursor-pointer rounded border border-line bg-transparent" />
            <span className="text-xs text-muted">自动派生表头、隔行、强调色</span>
          </div>
        </Card>
        <Card title="其他">
          <div className="space-y-2 text-sm">
            <Check checked={p.zebra} onChange={(zebra) => setP({ zebra })} label="隔行底色" />
            <Check checked={p.typeColors} onChange={(typeColors) => setP({ typeColors })} label="按作业类型上色（个人 / 小组 / 课堂 / 考试）" className="flex" />
          </div>
        </Card>
        <Button
          kind="primary"
          className="w-full justify-center py-2 text-base"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            try {
              const { downloadWorkbook } = await import('../lib/excel')
              await downloadWorkbook(calendar, courses, p, theme)
            } finally {
              setBusy(false)
            }
          }}
        >
          {busy ? '生成中…' : `导出 Excel（总览 + ${courses.length} 门课）`}
        </Button>
      </div>

      <Preview p={p} theme={theme} />
    </div>
  )
}

function Preview({ p, theme }: { p: ExportPrefs; theme: Theme }) {
  const { calendar, courses } = useStore()
  const L = p.lang
  const font = `"${p.fontEn}", "${p.fontZh}", serif`
  const size = { compact: 12, standard: 13.5, loose: 15 }[p.density]
  const rows = courses
    .flatMap((c) => c.assessments.filter((a) => isLeaf(c, a.id) && a.type !== 'Participation' && a.type !== 'FinalExam').map((a) => ({ c, a, d: resolveDue(calendar, c, a) })))
    .sort((x, y) => (x.d.date ?? '9999').localeCompare(y.d.date ?? '9999'))
    .slice(0, 9)
  const c0 = courses[0]
  const th = { background: theme.primary, color: '#fff', padding: '4px 6px', border: `1px solid ${theme.line}`, fontWeight: 700 }
  const td = (i: number) => ({ padding: '3px 6px', border: `1px solid ${theme.line}`, background: p.zebra && i % 2 ? theme.soft : '#fff', verticalAlign: 'top' as const, whiteSpace: 'pre-line' as const })
  const sub = L === 'bi' ? 'zh' : L

  return (
    <Card title="预览" extra={<span className="text-xs text-muted">实际文件里有 {courses.length + 1} 个工作表：总览 + {courses.map((c) => c.code).join(' / ')}</span>}>
      <div className="overflow-x-auto rounded border border-line bg-white p-4 text-[#222]" style={{ fontFamily: font, fontSize: size }}>
        <div style={{ color: theme.accent, fontSize: size + 8, fontWeight: 700 }}>{L === 'bi' ? `${calendar.name} 学期总览 Overview` : hx(`${calendar.name} Overview`, `${calendar.name} 学期总览`, L)}</div>
        <div style={{ color: '#777', fontStyle: 'italic', fontSize: size - 1, marginBottom: 10 }}>{hx('Exported', '导出于', L)} …</div>
        <div style={{ color: theme.accent, fontWeight: 700, fontSize: size + 2, borderBottom: `2px solid ${theme.primary}`, marginBottom: 4 }}>{hx('1. Deadlines', '一、截止事项', L)}</div>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              {[hx('Date', '日期', L), hx('Day', '星期', L), hx('Week', '教学周', L), hx('Course', '课程', L), hx('Item', '事项', L), hx('Type', '类型', L), hx('Weight', '占比', L), hx('Status', '状态', L)].map((h) => (
                <th key={h} style={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ c, a, d }, i) => (
              <tr key={a.id}>
                <td style={td(i)}>{d.date ?? 'TBA'}</td>
                <td style={td(i)}>{d.date ? (L === 'en' ? WEEKDAY_EN : WEEKDAY_ZH)[weekdayOf(d.date)] : ''}</td>
                <td style={td(i)}>{d.week ? `W${d.week}` : ''}</td>
                <td style={{ ...td(i), color: c.color, fontWeight: 700 }}>{c.short}</td>
                <td style={td(i)}>{tx(a.name, L)}</td>
                <td style={{ ...td(i), ...(p.typeColors ? { color: TYPE_COLOR[a.type], background: mix(TYPE_COLOR[a.type], '#ffffff', 0.85) } : {}) }}>{tx(TYPE_LABEL[a.type], sub)}</td>
                <td style={{ ...td(i), textAlign: 'center' }}>{a.weight}%</td>
                <td style={td(i)}>{tx(STATUS_LABEL[a.status], sub)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {c0 && (
          <>
            <div style={{ marginTop: 22, color: theme.accent, fontSize: size + 6, fontWeight: 700 }}>{c0.code}  {tx(c0.name, L).replace('\n', '  ')}</div>
            <div style={{ color: theme.accent, fontWeight: 700, fontSize: size + 2, borderBottom: `2px solid ${theme.primary}`, margin: '8px 0 4px' }}>{hx('3. Weekly teaching plan', '三、每周教学计划', L)}</div>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr>{[hx('Week', '教学周', L), hx('Dates', '日期', L), hx('Topic', '主题', L), hx('Class activity', '课堂活动', L), hx('This week', '本周事项', L)].map((h) => <th key={h} style={th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {c0.weekly.slice(3, 9).map((r, i) => {
                  const s = r.readingWeek ? { ...td(i), background: '#e6e6e6' } : td(i)
                  return (
                    <tr key={r.week}>
                      <td style={{ ...s, fontWeight: 700 }}>W{r.week}</td>
                      <td style={s}>{weekRangeLabel(calendar, r.week)}</td>
                      <td style={{ ...s, fontWeight: 700 }}>{tx(r.topic, L)}</td>
                      <td style={s}>{tx(r.activity, L)}</td>
                      <td style={{ ...s, color: theme.accent }}>{tx(r.events, L)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </>
        )}
      </div>
      <p className="mt-2 text-xs text-muted">预览只截取了一部分。导出的总览页还包含每周负荷热力图和各课总评构成；每门课的工作表包含课程信息、评分构成、完整周计划、重要时间点和教材。「距今天数」用公式，打开文件时自动更新。</p>
    </Card>
  )
}
