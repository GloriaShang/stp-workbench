import { useState } from 'react'
import { Button, Card, Num, Segmented } from '../components/ui'
import { todayISO } from '../lib/dates'
import { backupJSON, DEFAULT_FONT_SIZE, MIN_FONT_SIZE, MAX_FONT_SIZE, useStore, type ThemeMode } from '../store'
import { useVault } from '../vault'

export default function Settings() {
  const { obsidian, setObsidian, themeMode, fontSize, fontBold, set, resetCourses, importBackup } = useStore()
  const vault = useVault()
  const [msg, setMsg] = useState('')

  const statusText = {
    unsupported: '当前浏览器不支持直接读写本地文件夹。请用 Chrome 或 Edge 打开工作台。',
    none: '还没有连接。',
    'needs-permission': 'Chrome 需要你重新确认一次读写权限（每次重启浏览器后可能都要点一下）。',
    'no-daily-dir': `已选择文件夹，但里面没有「${obsidian.dailyPath}」。请确认选的是 vault 根目录，或修改下面的每日笔记路径。`,
    ready: `已连接：${vault.handle?.name}`,
  }[vault.status]

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-3 sm:p-5">
      <Card title="Obsidian 同步">
        <p className={`mb-3 text-sm ${vault.status === 'ready' ? 'text-ok' : 'text-muted'}`}>{statusText}</p>
        <div className="mb-4 flex flex-wrap gap-2">
          {vault.status !== 'unsupported' && <Button kind="primary" onClick={vault.connect}>{vault.handle ? '重新选择 vault 文件夹' : '选择 vault 文件夹'}</Button>}
          {vault.status === 'needs-permission' && <Button onClick={vault.reauthorize}>授权读写</Button>}
          {vault.handle && <Button kind="danger" onClick={vault.disconnect}>断开</Button>}
        </div>
        <div className="grid grid-cols-1 items-center gap-2 text-sm sm:grid-cols-[8rem_1fr]">
          <span className="text-muted">每日笔记路径</span>
          <input className="field" value={obsidian.dailyPath} onChange={(e) => setObsidian({ dailyPath: e.target.value })} onBlur={() => vault.handle && vault.reauthorize()} />
          <span className="text-muted">时间线标题</span>
          <div className="flex items-center gap-2">
            <select className="field" value={obsidian.headingLevel} onChange={(e) => setObsidian({ headingLevel: Number(e.target.value) })}>
              {[1, 2, 3].map((n) => <option key={n} value={n}>{'#'.repeat(n)}</option>)}
            </select>
            <input className="field flex-1" value={obsidian.plannerHeading} onChange={(e) => setObsidian({ plannerHeading: e.target.value })} />
          </div>
          <span className="text-muted">没写结束时间时</span>
          <span className="flex items-center gap-2">默认 <Num value={obsidian.defaultDurationMinutes} min={5} max={240} step={5} onChange={(v) => setObsidian({ defaultDurationMinutes: v })} /> 分钟</span>
        </div>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-xs text-muted">
          <li>请选择 vault 的根目录（Mac 上默认是 <code>~/Documents/Obsidian Vault</code>）。</li>
          <li>默认值已经和你的 Day Planner 设置对齐（<code># Day planner</code>、24 小时制、默认 30 分钟）。</li>
          <li>工作台只改动目标那一行；写入前会重读文件，如果那一行已在 Obsidian 里被改过，会放弃写入并提示。</li>
          <li>在 Obsidian 里的修改，工作台每 4 秒、以及切回窗口时自动读取。</li>
        </ul>
      </Card>

      <Card title="外观">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          明暗
          <Segmented<ThemeMode> value={themeMode} onChange={(v) => set({ themeMode: v })} options={[{ v: 'system', label: '跟随系统' }, { v: 'light', label: '浅色' }, { v: 'dark', label: '深色' }]} />
        </div>
        <div className="mt-4 space-y-3 text-sm">
          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor="app-font-size">全局字号</label>
            <input
              id="app-font-size"
              type="range"
              min={MIN_FONT_SIZE}
              max={MAX_FONT_SIZE}
              step={1}
              value={fontSize}
              onChange={(e) => set({ fontSize: Number(e.target.value) })}
              aria-valuetext={`${fontSize} 像素`}
              aria-describedby="font-size-help"
              className="min-w-32 max-w-64 flex-1 cursor-pointer accent-accent"
            />
            <output htmlFor="app-font-size" className="w-12 tabular-nums">{fontSize} px</output>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <label className="inline-flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={fontBold} onChange={(e) => set({ fontBold: e.target.checked })} className="accent-accent" />
              全局粗体
            </label>
            <Button onClick={() => set({ fontSize: DEFAULT_FONT_SIZE, fontBold: false })}>恢复默认字号与字重</Button>
          </div>
          <p className="rounded-md border border-line px-3 py-2">字体预览：雅思与课程日程 · IELTS 2026 · 15:00–23:30</p>
        </div>
        <p id="font-size-help" className="mt-2 text-xs text-muted">拖动滑块即时调整整个工作台（12–22 px），设置自动保存。关闭粗体后恢复原有标题层级；不影响 Excel 导出字体。</p>
        <p className="mt-1 text-xs text-muted">英文和数字 Times New Roman，中文宋体-简。</p>
      </Card>

      <Card title="数据与备份">
        <p className="mb-2 text-sm text-muted">
          课程、编辑和所有设置都自动保存在这个浏览器里，关掉重开不会丢。
        </p>
        <p className={`mb-3 text-sm ${vault.status === 'ready' ? 'text-ok' : 'text-muted'}`}>
          {vault.status === 'ready'
            ? `已开启自动备份到 vault：每次改动都会写入 .stp-workbench/backup.json，并按天保留快照。${vault.lastBackupAt ? `上次备份 ${new Date(vault.lastBackupAt).toLocaleTimeString('zh-CN')}。` : ''}`
            : '连接 Obsidian vault 后会自动备份到 vault；换网址、换浏览器或清了缓存，重新连上 vault 就能恢复。'}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => {
              const a = document.createElement('a')
              a.href = URL.createObjectURL(new Blob([backupJSON()], { type: 'application/json' }))
              a.download = `stp-planner-backup-${todayISO()}.json`
              a.click()
            }}
          >
            导出备份（JSON）
          </Button>
          <label className="inline-flex cursor-pointer items-center rounded-md border border-line bg-panel px-3 py-1 text-sm hover:bg-panel-2">
            从备份恢复
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0]
                if (!f) return
                try {
                  importBackup(await f.text())
                  setMsg('已从备份恢复')
                } catch (err) {
                  setMsg(`恢复失败：${(err as Error).message}`)
                }
                e.target.value = ''
              }}
            />
          </label>
          <Button kind="danger" onClick={() => confirm('把 6 门课恢复成内置的初始数据？你在工作台里做的编辑会丢失（Obsidian 里的内容不受影响）。') && resetCourses()}>
            恢复内置课程数据
          </Button>
        </div>
        {msg && <p className="mt-2 text-sm text-accent">{msg}</p>}
      </Card>
    </div>
  )
}
