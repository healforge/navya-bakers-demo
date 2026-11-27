import { useLanguage } from '@/i18n/useLanguage'
import { useMemo } from 'react'
import { WEEKDAY_LABELS } from '@/lib/dates'
import { formatINR } from '@/lib/format'
import type { HeatmapCell } from '@/store/analytics'

const hourLabel = (h: number) => (h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`)
const ORDER = [1, 2, 3, 4, 5, 6, 0] // Mon..Sun

/** Weekday × hour heatmap (average ₹ per day for that slot). Single hue, light → dark. */
export function PeakHoursHeatmap({ data }: { data: { cells: HeatmapCell[]; max: number } }) {
  const { t } = useLanguage()
  const hours = useMemo(() => {
    const used = data.cells.filter((c) => c.value > 0).map((c) => c.hour)
    if (!used.length) return [] as number[]
    const lo = Math.min(...used), hi = Math.max(...used)
    return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)
  }, [data])
  if (!hours.length) return <p className="py-8 text-center text-sm text-muted-foreground">{t('No sales in this period.')}</p>
  const at = (wd: number, h: number) => data.cells.find((c) => c.weekday === wd && c.hour === h)?.value ?? 0
  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[420px] gap-[2px]" style={{ gridTemplateColumns: `2.25rem repeat(${hours.length}, minmax(0, 1fr))` }}>
        <div />
        {hours.map((h) => <div key={h} className="text-center text-[10px] text-muted-foreground">{h % 2 === 0 ? hourLabel(h) : ''}</div>)}
        {ORDER.map((wd) => (
          <div key={wd} className="contents">
            <div className="pr-1 text-xs leading-6 text-muted-foreground">{t(WEEKDAY_LABELS[wd])}</div>
            {hours.map((h) => {
              const v = at(wd, h)
              const p = data.max ? Math.round((v / data.max) * 100) : 0
              return (
                <div
                  key={h}
                  title={t('{day} {time}: {amount} avg', { day: t(WEEKDAY_LABELS[wd]), time: hourLabel(h), amount: formatINR(v) })}
                  className="h-6 rounded-[3px] bg-muted/60 transition-transform hover:scale-110 hover:ring-2 hover:ring-foreground/40"
                  style={v > 0 ? { background: `color-mix(in oklab, var(--chart-1) ${Math.max(8, p)}%, var(--card))` } : undefined}
                />
              )
            })}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
        {t('Low')}
        <span className="h-2 w-24 rounded-full" style={{ background: 'linear-gradient(to right, color-mix(in oklab, var(--chart-1) 8%, var(--card)), var(--chart-1))' }} />
        {t('High · avg ₹ per day')}
      </div>
    </div>
  )
}
