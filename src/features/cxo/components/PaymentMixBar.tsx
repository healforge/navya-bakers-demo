import { formatINRCompact, formatPct } from '@/lib/format'

const PARTS = [
  { key: 'cash', label: 'Cash', color: 'var(--chart-1)' },
  { key: 'upi', label: 'UPI', color: 'var(--chart-4)' },
  { key: 'card', label: 'Card', color: 'var(--chart-3)' },
] as const

export function PaymentMixBar({ mix }: { mix: { cash: number; upi: number; card: number; total: number } }) {
  if (!mix.total) return <p className="py-4 text-center text-sm text-muted-foreground">No sales in this period.</p>
  return (
    <div className="space-y-3">
      <div className="flex h-5 gap-[2px] overflow-hidden rounded-md">
        {PARTS.map((p) => (
          <div key={p.key} title={`${p.label}: ${formatINRCompact(mix[p.key])} (${formatPct((mix[p.key] / mix.total) * 100)})`} style={{ width: `${(mix[p.key] / mix.total) * 100}%`, background: p.color }} />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {PARTS.map((p) => (
          <div key={p.key} className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="size-2.5 rounded-sm" style={{ background: p.color }} />{p.label}</div>
            <div className="font-medium tabular-nums">{formatPct((mix[p.key] / mix.total) * 100, 0)}</div>
            <div className="text-xs tabular-nums text-muted-foreground">{formatINRCompact(mix[p.key])}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
