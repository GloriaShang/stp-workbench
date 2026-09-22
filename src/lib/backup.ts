/**
 * 自动备份到 Obsidian vault：<vault>/.stp-workbench/backup.json
 * 另外每天留一份 backup-YYYY-MM-DD.json 快照（同一天覆盖）。
 * 文件夹以点开头，Obsidian 不会显示它。
 */
import { todayISO } from './dates'

const DIR = '.stp-workbench'

export interface VaultBackup {
  savedAt: number
  json: string
}

async function dir(vault: FileSystemDirectoryHandle, create: boolean) {
  return vault.getDirectoryHandle(DIR, { create })
}

async function write(d: FileSystemDirectoryHandle, name: string, text: string) {
  const w = await (await d.getFileHandle(name, { create: true })).createWritable()
  await w.write(text)
  await w.close()
}

export async function readBackup(vault: FileSystemDirectoryHandle): Promise<VaultBackup | null> {
  try {
    const f = await (await (await dir(vault, false)).getFileHandle('backup.json')).getFile()
    const json = await f.text()
    const savedAt = Number(JSON.parse(json).savedAt) || f.lastModified
    return { savedAt, json }
  } catch {
    return null
  }
}

export async function writeBackup(vault: FileSystemDirectoryHandle, json: string) {
  const d = await dir(vault, true)
  await write(d, 'backup.json', json)
  await write(d, `backup-${todayISO()}.json`, json)
}
