// 极简 IndexedDB 键值存储：保存 vault 目录句柄与课程附件（localStorage 存不了这两样）。

const DB = 'stp-planner'
const STORE = 'kv'

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export const idbGet = <T>(key: string) => tx<T | undefined>('readonly', (s) => s.get(key))
export const idbSet = (key: string, value: unknown) => tx('readwrite', (s) => s.put(value, key))
export const idbDel = (key: string) => tx('readwrite', (s) => s.delete(key))
export const idbKeys = () => tx<IDBValidKey[]>('readonly', (s) => s.getAllKeys())
