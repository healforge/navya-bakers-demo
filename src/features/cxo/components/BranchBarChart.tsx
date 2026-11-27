import { useLanguage } from '@/i18n/useLanguage'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import type { BranchRow } from '@/store/analytics'
import { formatINR, formatINRCompact } from '@/lib/format'
import { Legend } from './ChartCard'

const config = {
  revenue: { label: 'This period', color: 'var(--chart-1)' },
  previousRevenue: { label: 'Previous period', color: 'var(--muted-foreground)' },
} satisfies ChartConfig


/** Revenue by branch. `compare` adds the previous period as a muted second bar. */
export function BranchBarChart({ rows, compare = false, className = 'h-64 w-full' }: { rows: BranchRow[]; compare?: boolean; className?: string }) {
  const { t } = useLanguage()
  const fmt = (v: unknown, n: unknown) => <span className="flex w-full justify-between gap-4"><span className="text-muted-foreground">{t(config[n as keyof typeof config]?.label ?? '')}</span><span className="font-mono font-medium tabular-nums">{formatINR(Number(v))}</span></span>
  return (
    <>
      <ChartContainer config={config} className={className}>
        <BarChart data={rows} margin={{ left: 0, right: 8, top: 8 }} barGap={2}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="code" tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} width={48} tickFormatter={(v: number) => formatINRCompact(v)} />
          <ChartTooltip cursor={false} content={<ChartTooltipContent labelFormatter={(_, p) => String(p?.[0]?.payload?.name ?? '')} formatter={fmt} />} />
          {compare && <Bar dataKey="previousRevenue" fill="var(--color-previousRevenue)" fillOpacity={0.35} radius={[4, 4, 0, 0]} maxBarSize={28} />}
          <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[4, 4, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ChartContainer>
      {compare && <Legend items={[{ label: t('This period'), color: 'var(--chart-1)' }, { label: t('Previous period'), color: 'var(--muted-foreground)' }]} />}
    </>
  )
}
