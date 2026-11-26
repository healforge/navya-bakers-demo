import type { CategoryMixRow } from '@/store/analytics'
import { formatINRCompact, formatPct } from '@/lib/format'

/** Category mix as ranked horizontal bars (7 categories: a donut would exceed the 5-colour palette). */
export function CategoryBars({ rows }: { rows: CategoryMixRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.revenue))
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.category} title={`${r.category}: ${formatINRCompact(r.revenue)} (${formatPct(r.sharePct)})`}>
          <div className="mb-1 flex justify-between gap-2 text-sm">
            <span className="truncate">{r.category}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">{formatINRCompact(r.revenue)} · {formatPct(r.sharePct, 0)}</span>
          </div>
          <div className="h-2 rounded-full bg-muted">
            <div className="h-2 rounded-full bg-chart-1" style={{ width: `${(r.revenue / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}
