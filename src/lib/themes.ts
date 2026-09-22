export interface Theme {
  id: string
  name: string
  primary: string // 表头
  accent: string // 强调、标题文字
  soft: string // 隔行底色
  line: string // 边框
}

export const THEMES: Theme[] = [
  { id: 'obsidian', name: 'Obsidian 渐变', primary: '#006466', accent: '#4d194d', soft: '#eef5f5', line: '#c9dcdc' },
  { id: 'haze', name: '雾霾蓝', primary: '#355c7d', accent: '#2a4a66', soft: '#eef2f6', line: '#cdd8e3' },
  { id: 'morandi', name: '莫兰迪', primary: '#8e7f7f', accent: '#6b5b5b', soft: '#f5f1ef', line: '#ddd3cf' },
  { id: 'forest', name: '森林绿', primary: '#3f6f4f', accent: '#2d5239', soft: '#eef4ef', line: '#c8dbcd' },
  { id: 'crimson', name: '学院红', primary: '#8c2f39', accent: '#6d2029', soft: '#f7eeef', line: '#e3c8cc' },
  { id: 'mono', name: '极简黑白', primary: '#333333', accent: '#111111', soft: '#f4f4f4', line: '#d4d4d4' },
  { id: 'mint', name: '薄荷', primary: '#3b8f86', accent: '#2a6b64', soft: '#edf6f5', line: '#c6e0dd' },
  { id: 'lavender', name: '薰衣草', primary: '#6c5b9a', accent: '#4f4178', soft: '#f2f0f8', line: '#d6d0e8' },
  { id: 'orange', name: '暖橙', primary: '#c0652b', accent: '#944b1c', soft: '#fbf1ea', line: '#efd3c0' },
]

/** 色弱友好：蓝 / 橙 / 灰，避免红绿对比 */
export const CVD_THEME: Theme = { id: 'cvd', name: '色弱友好', primary: '#0f5c99', accent: '#b35900', soft: '#eef4fa', line: '#c9d9e8' }

const hex = (h: string) => h.replace('#', '')
const toRGB = (h: string) => [0, 2, 4].map((i) => parseInt(hex(h).slice(i, i + 2), 16))
const toHex = (rgb: number[]) => '#' + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')

export const mix = (a: string, b: string, t: number) => {
  const x = toRGB(a)
  const y = toRGB(b)
  return toHex(x.map((v, i) => v + (y[i] - v) * t))
}

/** 从一个自定义主色派生整套主题 */
export const deriveTheme = (primary: string): Theme => ({
  id: 'custom',
  name: '自定义',
  primary,
  accent: mix(primary, '#000000', 0.25),
  soft: mix(primary, '#ffffff', 0.92),
  line: mix(primary, '#ffffff', 0.75),
})

/** exceljs 用 ARGB */
export const argb = (h: string) => 'FF' + hex(h).toUpperCase()
