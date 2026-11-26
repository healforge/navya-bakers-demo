import { useMemo } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeft, Percent, Receipt, ShoppingBag, Trash2, TrendingUp } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import { EmptyState } from '@/components/common/EmptyState'
import { KpiCard } from '@/components/common/KpiCard'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Button } from '@/components/ui/button'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate, formatDateShort, formatINR, formatINRCompact, formatNumber, formatPct } from '@/lib/format'
import { dailySeries, categoryMix, productPerformance, salesSummary, wastageByReason, wastageSeries } from '@/store/analytics'
import { CategoryBars } from '../components/CategoryBars'
import { ChartCard } from '../components/ChartCard'
import { CxoFilterBar } from '../components/CxoFilterBar'
import { RevenueTrendChart } from '../components/RevenueTrendChart'
import { trendRange, useCxoScope } from '../filters'
import { cn } from '@/lib/utils'

const wcfg = { pct: { label: 'Wastage %', color: 'var(--chart-5)' } } satisfies ChartConfig
const rcfg = { value: { label: 'Value lost (MRP)', color: 'var(--chart-5)' } } satisfies ChartConfig
const pcfg = { revenue: { label: 'Revenue', color: 'var(--chart-1)' } } satisfies ChartConfig

export default function CxoBranchDetailPage() {
  const { branchId = '' } = useParams()
  const { db, range } = useCxoScope()
  const branch = db.branches.find((b) => b.id === branchId)
  const ids = useMemo(() => [branchId], [branchId])
  const sum = useMemo(() => salesSummary(db, range, ids), [db, range, ids])
  const tr = useMemo(() => trendRange(range), [range])
  const series = useMemo(() => dailySeries(db, tr, ids), [db, tr, ids])
  const products = useMemo(() => productPerformance(db, range, ids).slice(0, 8), [db, range, ids])
  const wTrend = useMemo(() => wastageSeries(db, trendRange(range, 14), ids), [db, range, ids])
  const reasons = useMemo(() => wastageByReason(db, range, ids), [db, range, ids])
  const cats = useMemo(() => categoryMix(db, range, ids), [db, range, ids])
  const closes = useMemo(() => db.dayCloses.filter((d) => d.branchId === branchId).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 14), [db.dayCloses, branchId])

  if (!branch) return <EmptyState title="Branch not found" action={<Button asChild variant="outline"><Link to="/cxo/branches">Back to branches</Link></Button>} />
  const c = sum.current, d = sum.deltas
  return (
    <>
      <PageHeader
        title={branch.name}
        description={`${branch.area}, ${branch.city} · Manager ${branch.managerName}`}
        actions={<><Button asChild variant="ghost" size="sm"><Link to="/cxo/branches"><ArrowLeft /> Branches</Link></Button><CxoFilterBar /></>}
      />
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <KpiCard label="Revenue" value={formatINRCompact(c.revenue)} delta={d.revenue} icon={TrendingUp} className="col-span-2 lg:col-span-1" />
          <KpiCard label="Bills" value={formatNumber(c.bills)} delta={d.bills} icon={Receipt} />
          <KpiCard label="Avg bill value" value={formatINR(c.abv)} delta={d.abv} icon={ShoppingBag} />
          <KpiCard label="Gross margin" value={formatPct(c.grossMarginPct)} delta={d.grossMarginPct} deltaLabel="pp vs previous" icon={Percent} />
          <KpiCard label="Wastage" value={formatPct(c.wastagePct)} delta={d.wastagePct} deltaLabel="pp vs previous" goodWhen="down" icon={Trash2} />
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <ChartCard title="Revenue trend" className="lg:col-span-2"><RevenueTrendChart data={series} /></ChartCard>
          <ChartCard title="Category mix"><CategoryBars rows={cats} /></ChartCard>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="Top products" description="By revenue">
            <ChartContainer config={pcfg} className="h-72 w-full">
              <BarChart data={products} layout="vertical" margin={{ left: 0, right: 12 }}>
                <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={(v: number) => formatINRCompact(v)} />
                <YAxis type="category" dataKey="name" width={110} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} interval={0} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent formatter={(v) => <span className="font-mono tabular-nums">{formatINR(Number(v))}</span>} />} />
                <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[0, 4, 4, 0]} maxBarSize={18} />
              </BarChart>
            </ChartContainer>
          </ChartCard>
          <ChartCard title="Wastage trend" description="Daily wastage as % of sales + wastage">
            <ChartContainer config={wcfg} className="h-72 w-full">
              <LineChart data={wTrend} margin={{ left: 0, right: 8, top: 8 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={28} tickFormatter={(x: string) => formatDateShort(x).split(', ')[1] ?? x} />
                <YAxis tickLine={false} axisLine={false} width={36} tickFormatter={(v: number) => `${v.toFixed(0)}%`} />
                <ChartTooltip content={<ChartTooltipContent labelFormatter={(_, p) => formatDateShort(String(p?.[0]?.payload?.date ?? ''))} formatter={(v) => <span className="font-mono tabular-nums">{formatPct(Number(v))}</span>} />} />
                <Line dataKey="pct" type="monotone" stroke="var(--color-pct)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ChartContainer>
          </ChartCard>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="Wastage by reason" description="Value lost at MRP">
            {reasons.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No wastage recorded.</p> : (
              <ChartContainer config={rcfg} className="h-56 w-full">
                <BarChart data={reasons} layout="vertical" margin={{ left: 0, right: 12 }}>
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                  <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={(v: number) => formatINRCompact(v)} />
                  <YAxis type="category" dataKey="reason" width={100} tickLine={false} axisLine={false} interval={0} />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent formatter={(v) => <span className="font-mono tabular-nums">{formatINR(Number(v))}</span>} />} />
                  <Bar dataKey="value" fill="var(--color-value)" radius={[0, 4, 4, 0]} maxBarSize={18} />
                </BarChart>
              </ChartContainer>
            )}
          </ChartCard>
          <ChartCard title="Day-close & cash variance" description="Most recent 14 closes">
            {closes.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No day-closes yet.</p> : (
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead className="text-right">Expected</TableHead><TableHead className="text-right">Counted</TableHead><TableHead className="text-right">Variance</TableHead></TableRow></TableHeader>
                <TableBody>
                  {closes.map((x) => (
                    <TableRow key={x.id}>
                      <TableCell className="whitespace-nowrap">{formatDate(x.date)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatINR(x.expectedCash)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatINR(x.countedCash)}</TableCell>
                      <TableCell className={cn('text-right tabular-nums', x.variance < 0 && 'font-medium text-danger', x.variance > 0 && 'text-warning-foreground dark:text-warning')}>
                        {x.variance === 0 ? <StatusBadge status="ok" label="Tally" /> : formatINR(x.variance)}
                      </TableCell>
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
