import { useLanguage } from '@/i18n/useLanguage'
import { useMemo } from 'react'
import { Coins, Package, Percent, Trash2 } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import { KpiCard } from '@/components/common/KpiCard'
import { PageHeader } from '@/components/common/PageHeader'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDateShort, formatINR, formatINRCompact, formatNumber, formatPct } from '@/lib/format'
import { cn } from '@/lib/utils'
import { productPerformance, salesSummary, wastageByReason, wastageSeries } from '@/store/analytics'
import { ChartCard, Legend } from '../components/ChartCard'
import { CxoFilterBar } from '../components/CxoFilterBar'
import { trendRange, useBranchColors, useCxoScope } from '../filters'

const rcfg = { value: { label: 'Value lost (MRP)', color: 'var(--chart-5)' } } satisfies ChartConfig

export default function CxoWastagePage() {
  const { t } = useLanguage()
  const { db, range, branchIds, scopeIds, branches } = useCxoScope()
  const colors = useBranchColors()
  const sum = useMemo(() => salesSummary(db, range, branchIds), [db, range, branchIds])
  const series = useMemo(() => wastageSeries(db, trendRange(range, 14), branchIds), [db, range, branchIds])
  const reasons = useMemo(() => wastageByReason(db, range, branchIds), [db, range, branchIds])
  const topWasted = useMemo(() => productPerformance(db, range, branchIds).filter((r) => r.wastageQty > 0).sort((a, b) => b.wastageValue - a.wastageValue).slice(0, 10), [db, range, branchIds])
  const flat = useMemo(() => series.map((p) => ({ date: p.date, ...Object.fromEntries(scopeIds.map((id) => [id, p.byBranch[id] ?? 0])) })), [series, scopeIds])
  const config = useMemo<ChartConfig>(() => Object.fromEntries(branches.filter((b) => scopeIds.includes(b.id)).map((b) => [b.id, { label: b.name, color: colors[b.id] ?? 'var(--chart-1)' }])), [branches, scopeIds, colors])
  const c = sum.current, d = sum.deltas
  const shown = branches.filter((b) => scopeIds.includes(b.id))

  return (
    <>
      <PageHeader title={t('Wastage')} description={t('Wastage % = value at MRP ÷ (sales + wastage value). Alert threshold {threshold}%.', { threshold: db.settings.wastageAlertPct })} actions={<CxoFilterBar />} />
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard label={t('Wastage %')} value={formatPct(c.wastagePct)} delta={d.wastagePct} deltaLabel="pp vs previous" goodWhen="down" icon={Percent} />
          <KpiCard label={t('Lost at MRP')} value={formatINRCompact(c.wastageValue)} icon={Trash2} />
          <KpiCard label={t('Lost at cost')} value={formatINRCompact(c.wastageCost)} icon={Coins} />
          <KpiCard label={t('Units wasted')} value={formatNumber(c.wastageQty)} icon={Package} />
        </div>
        <ChartCard title={t('Wastage % by branch')} description={t('Daily, one line per branch')}>
          <ChartContainer config={config} className="h-72 w-full">
            <LineChart data={flat} margin={{ left: 0, right: 8, top: 8 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={28} tickFormatter={(x: string) => formatDateShort(x).split(', ')[1] ?? x} />
              <YAxis tickLine={false} axisLine={false} width={36} tickFormatter={(v: number) => `${v.toFixed(0)}%`} />
              <ChartTooltip content={<ChartTooltipContent labelFormatter={(_, p) => formatDateShort(String(p?.[0]?.payload?.date ?? ''))} formatter={(v, n) => <span className="flex w-full justify-between gap-4"><span className="text-muted-foreground">{config[String(n)]?.label}</span><span className="font-mono font-medium tabular-nums">{formatPct(Number(v))}</span></span>} />} />
              {shown.map((b) => <Line key={b.id} dataKey={b.id} type="monotone" stroke={`var(--color-${b.id})`} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />)}
            </LineChart>
          </ChartContainer>
          <Legend items={shown.map((b) => ({ label: b.name, color: colors[b.id] ?? 'var(--chart-1)' }))} />
        </ChartCard>
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title={t('By reason')} description={t('Value lost at MRP')}>
            {reasons.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">{t('No wastage recorded.')}</p> : (
              <ChartContainer config={rcfg} className="h-64 w-full">
                <BarChart data={reasons} layout="vertical" margin={{ left: 0, right: 12 }}>
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                  <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={(v: number) => formatINRCompact(v)} />
                  <YAxis type="category" dataKey="reason" tickFormatter={(reason) => t(reason)} width={100} tickLine={false} axisLine={false} interval={0} />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent formatter={(v) => <span className="font-mono tabular-nums">{formatINR(Number(v))}</span>} />} />
                  <Bar dataKey="value" fill="var(--color-value)" radius={[0, 4, 4, 0]} maxBarSize={20} />
                </BarChart>
              </ChartContainer>
            )}
          </ChartCard>
          <ChartCard title={t('Top wasted products')}>
            {topWasted.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">{t('No wastage recorded.')}</p> : (
              <Table>
                <TableHeader><TableRow><TableHead>{t('Product')}</TableHead><TableHead className="text-right">{t('Qty')}</TableHead><TableHead className="text-right">{t('At MRP')}</TableHead><TableHead className="text-right">{t('Waste %')}</TableHead></TableRow></TableHeader>
                <TableBody>
                  {topWasted.map((r) => (
                    <TableRow key={r.productId}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(r.wastageQty)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatINR(r.wastageValue)}</TableCell>
                      <TableCell className={cn('text-right tabular-nums', r.wastagePct > db.settings.wastageAlertPct && 'font-medium text-danger')}>{formatPct(r.wastagePct)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </ChartCard>
        </div>
      </div>
    </>
  )
}
