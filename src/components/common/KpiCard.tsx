import type { LucideIcon } from 'lucide-react'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { formatDelta } from '@/lib/format'
import { cn } from '@/lib/utils'

export function Sparkline({ data, className }: { data: number[]; className?: string }) {
  if (data.length < 2) return null
  const max = Math.max(...data), min = Math.min(...data)
  const span = max - min || 1
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${28 - ((v - min) / span) * 26 - 1}`).join(' ')
  return (
    <svg viewBox="0 0 100 28" preserveAspectRatio="none" className={cn('h-7 w-full text-chart-1', className)} aria-hidden>
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export interface KpiCardProps {
  label: string
  /** preformatted value */
  value: string
  /** % change (or pp change) vs previous period */
  delta?: number
  deltaLabel?: string
  /** 'down' when lower is better (e.g. wastage) */
  goodWhen?: 'up' | 'down'
  sparkline?: number[]
  icon?: LucideIcon
  className?: string
}

export function KpiCard({ label, value, delta, deltaLabel = 'vs previous', goodWhen = 'up', sparkline, icon: Icon, className }: KpiCardProps) {
  const good = delta === undefined ? true : goodWhen === 'up' ? delta >= 0 : delta <= 0
  return (
    <Card className={className}>
      <CardContent className="space-y-1.5">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{label}</span>
          {Icon && <Icon className="size-4" />}
        </div>
        <div className="font-heading text-2xl font-semibold tabular-nums">{value}</div>
        {delta !== undefined && (
          <div className={cn('flex items-center gap-1 text-xs font-medium', good ? 'text-success' : 'text-danger')}>
            {delta >= 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
            {formatDelta(delta)} <span className="font-normal text-muted-foreground">{deltaLabel}</span>
          </div>
        )}
        {sparkline && <Sparkline data={sparkline} />}
      </CardContent>
    </Card>
  )
}
