import { useLanguage } from '@/i18n/useLanguage'
import { Area, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import type { DailyPoint } from '@/store/analytics'
import { formatDateShort, formatINR, formatINRCompact } from '@/lib/format'
import { Legend } from './ChartCard'

const config = {
  revenue: { label: 'Revenue', color: 'var(--chart-1)' },
  ma7: { label: '7-day average', color: 'var(--chart-4)' },
} satisfies ChartConfig

export function RevenueTrendChart({ data, className = 'h-64 w-full' }: { data: DailyPoint[]; className?: string }) {
  const { t } = useLanguage()
  return (
    <>
      <ChartContainer config={config} className={className}>
        <ComposedChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
          <defs>
            <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-revenue)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--color-revenue)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={28} tickFormatter={(d: string) => formatDateShort(d).split(', ')[1] ?? d} />
          <YAxis tickLine={false} axisLine={false} width={48} tickFormatter={(v: number) => formatINRCompact(v)} />
          <ChartTooltip content={<ChartTooltipContent labelFormatter={(_, p) => formatDateShort(String(p?.[0]?.payload?.date ?? ''))} formatter={(v, n) => <span className="flex w-full justify-between gap-4"><span className="text-muted-foreground">{t(config[n as keyof typeof config]?.label ?? '')}</span><span className="font-mono font-medium tabular-nums">{formatINR(Number(v))}</span></span>} />} />
          <Area dataKey="revenue" type="monotone" stroke="var(--color-revenue)" strokeWidth={2} fill="url(#revFill)" dot={false} activeDot={{ r: 4, strokeWidth: 2 }} />
          <Line dataKey="ma7" type="monotone" stroke="var(--color-ma7)" strokeWidth={2} strokeDasharray="5 4" dot={false} />
        </ComposedChart>
      </ChartContainer>
      <Legend items={[{ label: t('Daily revenue'), color: 'var(--chart-1)' }, { label: t('7-day moving average'), color: 'var(--chart-4)' }]} />
    </>
  )
}
