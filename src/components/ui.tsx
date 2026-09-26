import type { ButtonHTMLAttributes, ReactNode } from 'react'

export function Card({ title, extra, children, className = '' }: { title?: ReactNode; extra?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-line bg-panel ${className}`}>
      {(title || extra) && (
        <header className="flex items-center justify-between gap-3 border-b border-line-soft px-4 py-2.5">
          <h2 className="text-base font-bold">{title}</h2>
          {extra}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  )
}

type BtnKind = 'primary' | 'ghost' | 'danger' | 'plain'
export function Button({ kind = 'plain', className = '', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { kind?: BtnKind }) {
  const k = {
    primary: 'bg-accent-soft text-accent border-accent/40 hover:border-accent',
    plain: 'bg-panel border-line hover:bg-panel-2',
    ghost: 'border-transparent hover:bg-panel-2',
    danger: 'bg-panel border-line text-danger hover:bg-panel-2',
  }[kind]
  return (
    <button
      {...p}
      className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1 text-sm transition disabled:cursor-not-allowed disabled:opacity-40 ${k} ${className}`}
    />
  )
}

export function Badge({ children, color, className = '' }: { children: ReactNode; color?: string; className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-px text-xs whitespace-nowrap ${className}`}
      style={color ? { color, background: `color-mix(in srgb, ${color} 13%, transparent)` } : undefined}
    >
      {children}
    </span>
  )
}

export function Check({ checked, onChange, label, className = '' }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; className?: string }) {
  return (
    <label className={`inline-flex cursor-pointer items-center gap-2 ${className}`}>
      <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  )
}

export function Num({ value, onChange, min = 0, max = 999, step = 1, className = 'w-14' }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; className?: string }) {
  return (
    <input
      type="number"
      className={`field text-center ${className}`}
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => {
        const v = Number(e.target.value)
        if (!Number.isNaN(v)) onChange(Math.min(max, Math.max(min, v)))
      }}
    />
  )
}

export function Segmented<T extends string>({ value, options, onChange, className = '' }: { value: T; options: { v: T; label: ReactNode }[]; onChange: (v: T) => void; className?: string }) {
  return (
    <div className={`inline-flex rounded-md border border-line bg-panel p-0.5 text-sm ${className}`}>
      {options.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={`rounded px-2.5 py-0.5 transition ${value === o.v ? 'bg-accent-soft text-accent ring-1 ring-accent/30' : 'hover:bg-accent-soft'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="py-6 text-center text-sm text-muted">{children}</div>
}

export const COURSE_DOT = ({ color }: { color: string }) => <span className="inline-block size-2.5 shrink-0 rounded-full" style={{ background: color }} />
