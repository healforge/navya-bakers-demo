import { Badge } from '@/components/ui/badge'
import { formatINR } from '@/lib/format'
import { cn } from '@/lib/utils'

export function ProductTile({ name, price, onHand, expiringToday, inCart, onAdd }: {
  name: string
  price: number
  onHand: number
  expiringToday: boolean
  inCart: number
  onAdd: () => void
}) {
  const out = onHand <= 0
  const maxed = inCart >= onHand
  return (
    <button
      type="button"
      disabled={out || maxed}
      onClick={onAdd}
      className={cn(
        'relative flex min-h-28 flex-col justify-between rounded-xl border bg-card p-3 text-left shadow-xs transition active:scale-[0.98]',
        'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
        out ? 'opacity-50' : maxed ? 'opacity-70' : 'hover:border-primary/50',
        inCart > 0 && 'border-primary ring-1 ring-primary/40',
        expiringToday && !out && 'border-warning/60 bg-warning/10',
      )}
    >
      {inCart > 0 && (
        <span className="absolute -top-2 -right-2 flex size-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{inCart}</span>
      )}
      <span className="line-clamp-2 min-w-0 text-sm leading-snug font-medium break-words">{name}</span>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-x-2 gap-y-1">
        <span className="font-heading text-base font-semibold tabular-nums">{formatINR(price)}</span>
        {out ? (
          <Badge variant="outline" className="max-w-full border-transparent bg-danger/15 text-danger">Out</Badge>
        ) : (
          <Badge variant="outline" className={cn('max-w-full border-transparent', expiringToday ? 'bg-warning/30 text-warning-foreground dark:text-warning' : 'bg-muted text-muted-foreground')}>
            {expiringToday ? `Exp · ${onHand}` : onHand}
          </Badge>
        )}
      </div>
    </button>
  )
}
