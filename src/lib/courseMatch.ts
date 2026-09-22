import type { Course } from '../types'

/** 待办文字里认不出课程时用的中性色 */
export const NEUTRAL = '#64748b'

const SEP = /[\s\-_–—·:：]/g
const escape = (ch: string) => ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * 把别名变成正则：字符之间允许空格或连字符（"DA-NM" "DA- NM" "da nm" 都算），
 * 纯英文别名要求前后不是英文字母（"MIS" 不会匹配到 "mission"，但 "FM lecture4" 能匹配）。
 */
function toRegex(alias: string) {
  const chars = [...alias.replace(SEP, '')]
  if (chars.length < 2) return null
  const body = chars.map(escape).join('[\\s\\-_–—·]*')
  const ascii = /^[A-Za-z0-9]+$/.test(chars.join(''))
  return { re: new RegExp(ascii ? `(?<![A-Za-z])${body}(?![A-Za-z])` : body, 'i'), len: chars.length }
}

const cache = new WeakMap<Course, { re: RegExp; len: number }[]>()
function patterns(c: Course) {
  let p = cache.get(c)
  if (!p) {
    const aliases = [c.short, c.code, c.name.zh, c.name.en.split(':')[0]]
    p = aliases.map(toRegex).filter((x): x is { re: RegExp; len: number } => !!x)
    cache.set(c, p)
  }
  return p
}

/** 从待办文字里认出是哪门课：匹配简称、课程代码、中英文名称，取最长的匹配 */
export function matchCourse(text: string, courses: Course[]): Course | undefined {
  let best: { c: Course; len: number } | undefined
  for (const c of courses) {
    for (const { re, len } of patterns(c)) {
      if (re.test(text) && (!best || len > best.len)) best = { c, len }
    }
  }
  return best?.c
}
