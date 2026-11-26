import { ShoppingBag, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/common/EmptyState'
import { formatINR } from '@/lib/format'
import { Stepper } from './Stepper'

export interface CartLine { productId: string; name: string; price: number; qty: number; max: number }

export function CartPanel({ lines, total, disabled, onQty, onRemove, onClear, onPay }: {
  lines: CartLine[]
  total: number
  disabled?: boolean
  onQty: (productId: string, qty: number) => void
  onRemove: (productId: string) => void
  onClear: () => void
  onPay: () => void
}) {
  const units = lines.reduce((s, l) => s + l.qty, 0)
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between pb-2">
        <div className="font-heading text-lg font-semibold">Current bill</div>
        {lines.length > 0 && (
          <Button variant="ghost" className="h-11 text-muted-foreground" onClick={onClear}><Trash2 /> Clear</Button>
        )}
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {lines.length === 0 ? (
          <EmptyState icon={ShoppingBag} title="Cart is empty" description="Tap a product to add it." className="p-6" />
        ) : (
          lines.map((l) => (
            <div key={l.productId} className="rounded-lg border bg-background p-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{l.name}</div>
                  <div className="text-xs text-muted-foreground">{formatINR(l.price)} each</div>
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-semibold tabular-nums">{formatINR(l.price * l.qty)}</span>
                  <Button variant="ghost" className="size-9 text-muted-foreground" onClick={() => onRemove(l.productId)} aria-label={`Remove ${l.name}`}><X /></Button>
                </div>
              </div>
              <Stepper className="mt-2" value={l.qty} min={1} max={l.max} onChange={(q) => onQty(l.productId, q)} ariaLabel={l.name} />
              {l.qty >= l.max && <div className="mt-1 text-xs text-warning-foreground dark:text-warning">Max available: {l.max}</div>}
            </div>
          ))
        )}
      </div>
      <div className="mt-3 space-y-3 border-t pt-3">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted-foreground">{units} item{units === 1 ? '' : 's'}</span>
          <span className="font-heading text-2xl font-bold tabular-nums">{formatINR(total, { decimals: true })}</span>
        </div>
        <Button className="h-14 w-full text-base" disabled={disabled || lines.length === 0} onClick={onPay}>Pay {lines.length > 0 && formatINR(total)}</Button>
      </div>
    </div>
  )
}
