import { useVault } from '../vault'
import { Button } from './ui'

/** 读取权限过期时，明确说明为何没有显示待办，并直接提供恢复入口。 */
export function VaultNotice() {
  const { status, reauthorize } = useVault()
  if (status !== 'needs-permission') return null
  return (
    <div role="status" className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-panel px-4 py-2 text-sm">
      <span>Obsidian 日程尚未加载：浏览器需要重新授权读取。</span>
      <Button kind="primary" onClick={reauthorize}>恢复日程显示</Button>
    </div>
  )
}
